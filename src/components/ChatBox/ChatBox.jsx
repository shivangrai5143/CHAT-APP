import React, { useContext, useState, useEffect, useRef } from 'react';
import './ChatBox.css';
import assets from '../../assets/assets';
import { AppContext } from '../../context/AppContextProvider';
import {
  doc,
  collection,
  addDoc,
  updateDoc,
  getDoc,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../../config/firebase';
import { toast } from 'react-toastify';

const ChatBox = () => {
  const {
    userData,
    chatUser,
    messagesId,
    messages,
  } = useContext(AppContext);

  const [input, setInput] = useState('');
  const scrollRef = useRef(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = async () => {
    try {
      if (!input.trim() || !messagesId) return;

      const messageText = input.trim();
      setInput('');

      // Add message to sub-collection
      await addDoc(collection(db, "messages", messagesId, "messages"), {
        sId: userData.uid,
        text: messageText,
        createdAt: serverTimestamp(),
      });

      // Update lastMessage for both users' chatData
      await updateChatData(messageText);

    } catch (error) {
      console.error("Error sending message:", error);
      toast.error("Failed to send message");
    }
  };

  const sendImage = async (e) => {
    try {
      const file = e.target.files[0];
      if (!file || !messagesId) return;

      // Upload to Cloudinary
      const formData = new FormData();
      formData.append("file", file);
      formData.append("upload_preset", "chat-app");

      const res = await fetch(
        "https://api.cloudinary.com/v1_1/dqhjge4ng/image/upload",
        { method: "POST", body: formData }
      );
      const data = await res.json();

      if (data.secure_url) {
        await addDoc(collection(db, "messages", messagesId, "messages"), {
          sId: userData.uid,
          image: data.secure_url,
          createdAt: serverTimestamp(),
        });

        await updateChatData("📷 Image");
      }

    } catch (error) {
      console.error("Error sending image:", error);
      toast.error("Failed to send image");
    }
  };

  const updateChatData = async (lastMessage) => {
    try {
      // Update current user's chatData
      const currentChatRef = doc(db, "chats", userData.uid);
      const currentChatSnap = await getDoc(currentChatRef);
      const currentChatData = currentChatSnap.data()?.chatData || [];

      const updatedCurrentChat = currentChatData.map((item) => {
        if (item.rId === chatUser.uid) {
          return {
            ...item,
            lastMessage,
            updatedAt: Date.now(),
            messageSeen: true,
          };
        }
        return item;
      });

      await updateDoc(currentChatRef, { chatData: updatedCurrentChat });

      // Update other user's chatData
      const otherChatRef = doc(db, "chats", chatUser.uid);
      const otherChatSnap = await getDoc(otherChatRef);
      const otherChatData = otherChatSnap.data()?.chatData || [];

      const updatedOtherChat = otherChatData.map((item) => {
        if (item.rId === userData.uid) {
          return {
            ...item,
            lastMessage,
            updatedAt: Date.now(),
            messageSeen: false,
          };
        }
        return item;
      });

      await updateDoc(otherChatRef, { chatData: updatedOtherChat });

    } catch (error) {
      console.error("Error updating chat data:", error);
    }
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = timestamp instanceof Timestamp
      ? timestamp.toDate()
      : new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      sendMessage();
    }
  };

  // Empty state when no chat is selected
  if (!chatUser) {
    return (
      <div className='chat-box'>
        <div className="chat-welcome">
          <img src={assets.logo_icon} alt="Logo" />
          <p>Select a chat or search for a user to start messaging</p>
        </div>
      </div>
    );
  }

  return (
    <div className='chat-box'>
      <div className="chat-user">
        <img src={chatUser.avatar || assets.profile_img} alt="" />
        <p>
          {chatUser.name || chatUser.username || 'User'}
          {chatUser.lastSeen && Date.now() - chatUser.lastSeen < 70000 && (
            <img className='dot' src={assets.green_dot} alt="" />
          )}
        </p>
        <img src={assets.help_icon} className='Help' alt="" />
      </div>

      <div className="chat-msg" ref={scrollRef}>
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={msg.sId === userData.uid ? "s-msg" : "r-msg"}
          >
            {msg.image ? (
              <img className='msg-img' src={msg.image} alt="" />
            ) : (
              <p className="msg">{msg.text}</p>
            )}
            <div>
              <img
                src={
                  msg.sId === userData.uid
                    ? (userData.avatar || assets.profile_img)
                    : (chatUser.avatar || assets.profile_img)
                }
                alt=""
              />
              <p>{formatTime(msg.createdAt)}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="chat-input">
        <input
          type="text"
          placeholder='Send a message'
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyPress}
        />
        <input
          type="file"
          id="image"
          accept='image/png, image/jpeg'
          hidden
          onChange={sendImage}
        />
        <label htmlFor='image'>
          <img src={assets.gallery_icon} alt="" />
        </label>
        <img src={assets.send_button} alt="" onClick={sendMessage} />
      </div>
    </div>
  );
};

export default ChatBox;
