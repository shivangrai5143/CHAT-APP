
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth"; 
import { getFirestore } from "firebase/firestore"; 

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


export { app, analytics, auth, db };
