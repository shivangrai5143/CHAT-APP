import { createContext, useState, useEffect, useRef, useCallback } from "react";
import {
  doc,
  getDoc,
  onSnapshot,
  updateDoc,
  collection,
  query,
  orderBy,
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

        const data = {
          uid: userSnap.id,
          ...userSnap.data()
        };

        setUserData(data);

        if (data.avatar && data.name) {
          navigate("/chat");
        } else {
          navigate("/profile");
        }

        await updateDoc(userRef, {
          lastSeen: Date.now()
        });

      }

    } catch (error) {
      console.error("Error loading user data:", error);
    }

  };

  // Chat list listener — listens to chats/{uid} doc for contact list
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

          return {
            ...item,
            userData: user,
          };

        })

      );

      setChatData(tempData.sort((a, b) => b.updatedAt - a.updatedAt));

    });

    return () => unSubscribe();

  }, [userData]);

  // Messages listener — listens to messages/{messagesId}/messages sub-collection
  useEffect(() => {

    if (!messagesId) {
      setMessages([]);
      return;
    }

    const msgRef = collection(db, "messages", messagesId, "messages");
    const q = query(msgRef, orderBy("createdAt", "asc"));

    const unSubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setMessages(msgs);
    });

    return () => unSubscribe();

  }, [messagesId]);

  // Update lastSeen on tab close
  useEffect(() => {

    const handleUnload = async () => {

      if (!auth.currentUser) return;

      try {

        const userRef = doc(db, "users", auth.currentUser.uid);

        await updateDoc(userRef, {
          lastSeen: Date.now()
        });

      } catch (error) {
        console.log("Error updating lastSeen:", error);
      }

    };

    window.addEventListener("beforeunload", handleUnload);

    return () => {
      window.removeEventListener("beforeunload", handleUnload);
    };

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
  };

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );

};

export default AppContextProvider;