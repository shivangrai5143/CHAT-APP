import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { createUserWithEmailAndPassword, getAuth } from "firebase/auth"; 
import { getFirestore, setDoc, doc } from "firebase/firestore"; 
import { toast } from "react-toastify";

const firebaseConfig = {
  apiKey: "AIzaSyBqVECzSRda8_JP6b9zRQhzHbi0Xv2zm_U",
  authDomain: "chat-app-71395.firebaseapp.com",
  projectId: "chat-app-71395",
  storageBucket: "chat-app-71395.appspot.com", 
  messagingSenderId: "729508397283",
  appId: "1:729508397283:web:43624bbbd3a8295c71c5d6",
  measurementId: "G-S2KNCFBBQY"
};

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);
const db = getFirestore(app);

const signup = async (username, email, password) => {
  try {
    const res = await createUserWithEmailAndPassword(auth, email, password);
    const user = res.user;

    await setDoc(doc(db, "users", user.uid), {
      id: user.uid,
      username: username.toLowerCase(),
      email,
      name: "",
      avatar: "",
      bio: "Hey, there! I am using chat-app",
      lastseen: Date.now(),
    });

    await setDoc(doc(db, "chats", user.uid), {
      chatData: [],
    });

    toast.success("Signup successful! 🎉");
  } catch (error) {
    console.error(error);
    toast.error(error.code);
  }
}; 

export { app, analytics, auth, db, signup };
