import { createContext, useState } from "react"; 
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "../config/firebase";
import { useNavigate } from "react-router-dom";


export const AppContext = createContext();

const AppContextProvider = ({ children }) => {
  const navigate = useNavigate();

  const [userData, setUserData] = useState(null);
  const [chatData, setChatData] = useState(null);

  const loadUserData = async (uid) => {
    try {
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
        
        // Update last seen (optional but common in chat apps)
        await updateDoc(userRef, {
            lastSeen: Date.now()
        });

      } else {
        console.warn("User not found in Firestore");
        navigate("/profile");
      }
    } catch (error) {
      console.error("Error loading user data:", error);
    }
  };

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