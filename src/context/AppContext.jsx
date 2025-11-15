import { doc, getDoc } from "firebase/firestore";
import { createContext, useState } from "react";
import { db } from "../config/firebase";

// Always give createContext a default value (even empty object)
export const AppContext = createContext({});

const AppContextProvider = (props) => {
  const [userData, setUserData] = useState(null);
  const [chatData, setChatData] = useState(null);

const loadUserData = async (uid) => {
  try {
    const userRef = doc(db, 'users', uid);
    const userSnap = await getDoc(userRef);
    const userData = userSnap.data();
    if (userSnap.exists()) {
      console.log("User data:", userData);
      setUserData(userData); // store in context
    } else {
      console.log("No user data found!");
    }

  } catch (error) {
    console.log("Error loading user data:", error);
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
      {props.children}
    </AppContext.Provider>
  );
};

export default AppContextProvider;
export { AppContextProvider };