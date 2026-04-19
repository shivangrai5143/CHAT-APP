import { createContext, useState, useEffect, useRef, useCallback } from "react";
import {
  doc,
  getDoc,
  onSnapshot,
  updateDoc,
  collection,
  query,
  orderBy,
  where,
  setDoc,
  deleteField,
  arrayUnion,
  arrayRemove,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import { auth, db } from "../config/firebase";
import { useNavigate } from "react-router-dom";
import { generateKeyPair, exportPublicKey } from "../services/cryptoService";
import { getPrivateKey, savePrivateKey } from "../services/keyManager";

export const AppContext = createContext();

const AppContextProvider = ({ children }) => {

  const navigate = useNavigate();

  const [userData, setUserDataState] = useState(null);
  const [chatData, setChatData] = useState([]);
  const [chatUser, setChatUser] = useState(null);
  const [messagesId, setMessagesId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [chatType, setChatType] = useState("user"); // "user" or "room"
  const [roomData, setRoomData] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [typingUsers, setTypingUsers] = useState({}); // { chatId: { uid: timestamp } }
  const [statuses, setStatuses] = useState([]); // active status updates
  const [userPrivateKey, setUserPrivateKey] = useState(null); // RSA CryptoKey
  const userDataRef = useRef(null);
  const tabFocusedRef = useRef(true);

  // Sync ref with state
  const setUserData = useCallback((valueOrUpdater) => {
    setUserDataState((prev) => {
      const next =
        typeof valueOrUpdater === "function"
          ? valueOrUpdater(prev)
          : valueOrUpdater;
      userDataRef.current = next;
      return next;
    });
  }, []);

  // Load user data
  const loadUserData = async (uid, skipIfLoaded = false) => {
    try {
      if (skipIfLoaded && userDataRef.current) {
        if (userDataRef.current.avatar && userDataRef.current.name) {
          navigate("/chat");
        } else {
          navigate("/profile");
        }
        return;
      }

      const userRef = doc(db, "users", uid);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        const data = { uid: userSnap.id, ...userSnap.data() };
        setUserData(data);

        if (data.avatar && data.name) {
          navigate("/chat");
        } else {
          navigate("/profile");
        }

        await updateDoc(userRef, { lastSeen: Date.now() });
      }

      // Request notification permission
      if ("Notification" in window && Notification.permission === "default") {
        Notification.requestPermission();
      }
    } catch (error) {
      console.error("Error loading user data:", error);
    }
  };

  // ─── Heartbeat: update lastSeen every 60s ───
  useEffect(() => {
    if (!userData?.uid) return;

    const updateLastSeen = async () => {
      try {
        const userRef = doc(db, "users", userData.uid);
        await updateDoc(userRef, { lastSeen: Date.now() });
      } catch (e) {
        console.log("Heartbeat error:", e);
      }
    };

    updateLastSeen(); // fire immediately
    const interval = setInterval(updateLastSeen, 60000);

    return () => clearInterval(interval);
  }, [userData?.uid]);

  // ─── Visibility change: update lastSeen on tab focus/blur ───
  useEffect(() => {
    if (!userData?.uid) return;

    const handleVisibility = async () => {
      tabFocusedRef.current = !document.hidden;
      try {
        const userRef = doc(db, "users", userData.uid);
        await updateDoc(userRef, { lastSeen: Date.now() });
      } catch (e) {
        console.log("Visibility update error:", e);
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [userData?.uid]);

  // ─── Real-time listener on chatUser's doc (for live online status) ───
  useEffect(() => {
    if (!chatUser?.uid || chatType !== "user") return;

    const userRef = doc(db, "users", chatUser.uid);
    const unsub = onSnapshot(userRef, (snap) => {
      if (snap.exists()) {
        setChatUser((prev) => prev ? { ...prev, ...snap.data() } : prev);
      }
    });

    return () => unsub();
  }, [chatUser?.uid, chatType]);

  // ─── Typing indicator listener ───
  useEffect(() => {
    if (!messagesId) return;

    const typingRef = doc(db, "typing", messagesId);
    const unsub = onSnapshot(typingRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data() || {};
        // Filter out stale typing indicators (> 4 seconds old)
        const now = Date.now();
        const active = {};
        Object.entries(data).forEach(([uid, timestamp]) => {
          if (now - timestamp < 4000) {
            active[uid] = timestamp;
          }
        });
        setTypingUsers((prev) => ({ ...prev, [messagesId]: active }));
      } else {
        setTypingUsers((prev) => ({ ...prev, [messagesId]: {} }));
      }
    });

    return () => unsub();
  }, [messagesId]);

  // ─── Chat list listener ───
  useEffect(() => {
    if (!userData?.uid) return;

    const chatRef = doc(db, "chats", userData.uid);

    const unSubscribe = onSnapshot(chatRef, async (res) => {
      const chatItems = res.data()?.chatData || [];

      const tempData = await Promise.all(
        chatItems.map(async (item) => {
          const userRef = doc(db, "users", item.rId);
          const userSnap = await getDoc(userRef);
          const user = userSnap.data();
          return { ...item, userData: user };
        })
      );

      setChatData(tempData.sort((a, b) => b.updatedAt - a.updatedAt));
    });

    return () => unSubscribe();
  }, [userData]);

  // ─── Rooms listener: rooms where user is a member ───
  useEffect(() => {
    if (!userData?.uid) return;

    const roomsRef = collection(db, "rooms");
    const q = query(roomsRef, where("members", "array-contains", userData.uid));

    const unsub = onSnapshot(q, (snapshot) => {
      const roomsList = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));
      setRooms(roomsList.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)));
    });

    return () => unsub();
  }, [userData?.uid]);

  // ─── Messages listener (works for both 1-on-1 and rooms) ───
  useEffect(() => {
    if (!messagesId) {
      setMessages([]);
      return;
    }

    const parentCollection = chatType === "room" ? "rooms" : "messages";
    const msgRef = collection(db, parentCollection, messagesId, "messages");
    const q = query(msgRef, orderBy("createdAt", "asc"));

    const unSubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));
      setMessages(msgs);

      // Browser notification for new messages when tab not focused
      if (!tabFocusedRef.current && "Notification" in window && Notification.permission === "granted") {
        const lastMsg = msgs[msgs.length - 1];
        if (lastMsg && lastMsg.sId !== userData?.uid) {
          const senderName = lastMsg.sName || chatUser?.name || chatUser?.username || "Someone";
          const body = lastMsg.text || (lastMsg.image ? "📷 Image" : (lastMsg.fileName ? `📎 ${lastMsg.fileName}` : "New message"));
          new Notification(`${senderName}`, {
            body,
            icon: lastMsg.sAvatar || chatUser?.avatar || "/favicon.ico",
            tag: messagesId, // prevent duplicate notifications
          });
        }
      }
    });

    return () => unSubscribe();
  }, [messagesId, chatType]);

  // ─── Update lastSeen on tab close ───
  useEffect(() => {
    const handleUnload = async () => {
      if (!auth.currentUser) return;
      try {
        const userRef = doc(db, "users", auth.currentUser.uid);
        await updateDoc(userRef, { lastSeen: Date.now() });
      } catch (error) {
        console.log("Error updating lastSeen:", error);
      }
    };

    window.addEventListener("beforeunload", handleUnload);
    return () => window.removeEventListener("beforeunload", handleUnload);
  }, []);

  // ─── Typing helpers ───
  const setTyping = async (chatId, isTyping) => {
    if (!userData?.uid || !chatId) return;
    try {
      const typingRef = doc(db, "typing", chatId);
      if (isTyping) {
        await setDoc(typingRef, { [userData.uid]: Date.now() }, { merge: true });
      } else {
        await setDoc(typingRef, { [userData.uid]: deleteField() }, { merge: true });
      }
    } catch (e) {
      // silently fail typing updates
    }
  };

  const getTypingUsers = (chatId) => {
    if (!chatId || !typingUsers[chatId]) return [];
    const now = Date.now();
    return Object.entries(typingUsers[chatId])
      .filter(([uid, ts]) => uid !== userData?.uid && now - ts < 4000)
      .map(([uid]) => uid);
  };

  // ─── Block / Unblock helpers ───
  const blockUser = async (uid) => {
    if (!userData?.uid || !uid) return;
    try {
      const userRef = doc(db, "users", userData.uid);
      await updateDoc(userRef, { blockedUsers: arrayUnion(uid) });
      setUserData((prev) => ({
        ...prev,
        blockedUsers: [...(prev.blockedUsers || []), uid],
      }));
    } catch (e) {
      console.error("Block error:", e);
    }
  };

  const unblockUser = async (uid) => {
    if (!userData?.uid || !uid) return;
    try {
      const userRef = doc(db, "users", userData.uid);
      await updateDoc(userRef, { blockedUsers: arrayRemove(uid) });
      setUserData((prev) => ({
        ...prev,
        blockedUsers: (prev.blockedUsers || []).filter((id) => id !== uid),
      }));
    } catch (e) {
      console.error("Unblock error:", e);
    }
  };

  const isBlocked = (uid) => {
    return (userData?.blockedUsers || []).includes(uid);
  };

  const isBlockedBy = (otherUser) => {
    return (otherUser?.blockedUsers || []).includes(userData?.uid);
  };

  // ─── Report user helper ───
  const reportUser = async (uid, reason, description) => {
    if (!userData?.uid || !uid) return;
    try {
      await addDoc(collection(db, "reports"), {
        reporterUid: userData.uid,
        reportedUid: uid,
        reason,
        description: description || '',
        createdAt: serverTimestamp(),
      });
    } catch (e) {
      console.error("Report error:", e);
    }
  };

  // ─── E2EE Key Initialisation ───
  const initEncryption = useCallback(async (uid) => {
    if (!uid) return;
    try {
      // Try to load existing private key from IndexedDB
      let privKey = await getPrivateKey(uid);
      if (privKey) {
        setUserPrivateKey(privKey);
        return;
      }
      // No key on this device — generate a fresh key pair
      const keyPair = await generateKeyPair();
      const jwkPublic = await exportPublicKey(keyPair.publicKey);
      // Store public key in Firestore
      const userRef = doc(db, "users", uid);
      await updateDoc(userRef, { publicKey: jwkPublic });
      // Store private key in IndexedDB
      await savePrivateKey(uid, keyPair.privateKey);
      setUserPrivateKey(keyPair.privateKey);
    } catch (e) {
      console.error("E2EE init error:", e);
    }
  }, []);

  // ─── Status Listener (live, filtered to last 24h) ───
  useEffect(() => {
    if (!userData?.uid) return;

    const now = Date.now();
    const yesterday = now - 24 * 60 * 60 * 1000;

    const q = query(
      collection(db, "status"),
      where("expiresAt", ">", now),
      orderBy("expiresAt", "desc")
    );

    const unsub = onSnapshot(q, async (snap) => {
      const raw = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      // Attach user display info
      const withUsers = await Promise.all(
        raw.map(async (s) => {
          if (s.userId === userData.uid) {
            return {
              ...s,
              userName: userData.name || userData.username || "Me",
              userAvatar: userData.avatar || "",
            };
          }
          try {
            const uSnap = await getDoc(doc(db, "users", s.userId));
            const u = uSnap.data() || {};
            return { ...s, userName: u.name || u.username || "User", userAvatar: u.avatar || "" };
          } catch {
            return { ...s, userName: "User", userAvatar: "" };
          }
        })
      );
      setStatuses(withUsers);
    });

    return () => unsub();
  }, [userData?.uid]);

  // ─── Post a new status ───
  const postStatus = async ({ type, mediaUrl, text, textBg }) => {
    if (!userData?.uid) return;
    const now = Date.now();
    await addDoc(collection(db, "status"), {
      userId: userData.uid,
      type,
      ...(mediaUrl ? { mediaUrl } : {}),
      ...(text ? { text, textBg: textBg ?? 0 } : {}),
      createdAt: now,
      expiresAt: now + 24 * 60 * 60 * 1000,
      viewers: [],
    });
  };

  // ─── Mark a status as viewed ───
  const markStatusViewed = async (statusId) => {
    if (!statusId || !userData?.uid) return;
    try {
      const ref = doc(db, "status", statusId);
      await updateDoc(ref, { viewers: arrayUnion(userData.uid) });
    } catch (e) {
      // silently fail — non-critical
    }
  };

  const value = {
    userData,
    setUserData,
    chatData,
    setChatData,
    loadUserData,
    chatUser,
    setChatUser,
    messagesId,
    setMessagesId,
    messages,
    setMessages,
    chatType,
    setChatType,
    roomData,
    setRoomData,
    rooms,
    setRooms,
    setTyping,
    getTypingUsers,
    tabFocusedRef,
    blockUser,
    unblockUser,
    isBlocked,
    isBlockedBy,
    reportUser,
    statuses,
    postStatus,
    markStatusViewed,
    userPrivateKey,
    setUserPrivateKey,
    initEncryption,
  };

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
};

export default AppContextProvider;