import { doc, getDoc } from "firebase/firestore";
import { createContext, useState } from "react";
import { db } from "../config/firebase";
import { useNavigate } from "react-router-dom";

export const AppContext = createContext({});

const AppContextProvider = (props) => {
  const navigate = useNavigate();

  const [userData, setUserData] = useState(null);
  const [chatData, setChatData] = useState(null);

  const loadUserData = async (uid) => {
    try {
      const userRef = doc(db, "users", uid);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        console.log("User doc not found");
        navigate("/profile");
        return;
      }

      const data = userSnap.data();
      setUserData(data);

      // Redirect logic
      if (data.avatar && data.name) {
        navigate("/chat");
      } else {
        navigate("/profile");
      }

    } catch (error) {
      console.error("Error loading user data: ", error);
      navigate("/profile");
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
