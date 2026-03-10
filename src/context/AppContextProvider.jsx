import { createContext, useState, useEffect, useRef, useCallback } from "react";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { auth, db } from "../config/firebase";
import { useNavigate } from "react-router-dom";

export const AppContext = createContext();

const AppContextProvider = ({ children }) => {

  const navigate = useNavigate();

  const [userData, setUserDataState] = useState(null);
  const [chatData, setChatData] = useState(null);
  const userDataRef = useRef(null);

  // Wrap setUserData to keep the ref in sync SYNCHRONOUSLY
  const setUserData = useCallback((valueOrUpdater) => {
    setUserDataState((prev) => {
      const next =
        typeof valueOrUpdater === "function"
          ? valueOrUpdater(prev)
          : valueOrUpdater;
      userDataRef.current = next;            // sync ref immediately
      return next;
    });
  }, []);

  const loadUserData = async (uid, skipIfLoaded = false) => {
    try {
      // Skip re-fetch if data already loaded (prevents overwriting fresh updates)
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

        const data = userSnap.data();
        setUserData(data);


        if (data.avatar && data.name) {
          navigate("/chat");
        } else {
          navigate("/profile");
        }

        await updateDoc(userRef, {
          lastSeen: Date.now(),
        });

      }

    } catch (error) {
      console.error("Error loading user data:", error);
    }
  };

  useEffect(() => {

    const handleUnload = async () => {

      if (!auth.currentUser) return;

      try {
        const userRef = doc(db, "users", auth.currentUser.uid);

        await updateDoc(userRef, {
          lastSeen: Date.now(),
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
  };

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
};

export default AppContextProvider;