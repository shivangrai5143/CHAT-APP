import { createContext, useState } from "react";

// Always give createContext a default value (even empty object)
export const AppContext = createContext({});

const AppContextProvider = (props) => {
  const [userData, setUserData] = useState(null);
  const [chatData, setChatData] = useState(null);

  const loadUserData = async (uid)=>{

  }

  const value = {
    userData,
    setUserData,
    chatData,
    setChatData,
  };

  return (
    <AppContext.Provider value={value}>
      {props.children}
    </AppContext.Provider>
  );
};

export default AppContextProvider;
export { AppContextProvider };