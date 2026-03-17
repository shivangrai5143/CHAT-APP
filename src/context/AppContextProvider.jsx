import { createContext, useState, useEffect, useRef, useCallback } from "react";
import { doc, getDoc, onSnapshot, updateDoc } from "firebase/firestore";
import { auth, db } from "../config/firebase";
import { useNavigate } from "react-router-dom";

export const AppContext = createContext();

const AppContextProvider = ({ children }) => {

  const navigate = useNavigate();

  const [userData, setUserDataState] = useState(null);
  const [chatData, setChatData] = useState([]);
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

  // Chat listener
  useEffect(() => {

    if (!userData?.uid) return;

    const chatRef = doc(db, "chats", userData.uid);

    const unSubscribe = onSnapshot(chatRef, async (res) => {

      const chatItems = res.data()?.chats || [];

      const tempData = await Promise.all(

        chatItems.map(async (item) => {

          const userRef = doc(db, "users", item.uid);
          const userSnap = await getDoc(userRef);
          const user = userSnap.data();

          return {
            ...item,
            name: user?.name,
            avatar: user?.avatar,
            lastSeen: user?.lastSeen
          };

        })

      );

      setChatData(tempData.sort((a, b) => b.lastSeen - a.lastSeen));

    });

    return () => unSubscribe();

  }, [userData]);

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
    loadUserData
  };

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );

};

export default AppContextProvider;