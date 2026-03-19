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
} from "firebase/firestore";
import { auth, db } from "../config/firebase";
import { useNavigate } from "react-router-dom";

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
  const userDataRef = useRef(null);

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
  };

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
};

export default AppContextProvider;