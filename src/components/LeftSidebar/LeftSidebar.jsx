import React, { useContext, useState } from 'react';
import './LeftSidebar.css';
import assets from '../../assets/assets';
import { AppContext } from '../../context/AppContextProvider';
import { useNavigate } from 'react-router-dom';
import { logout } from '../../config/firebase';

import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  arrayUnion,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../config/firebase';

const LeftSidebar = () => {

  const {
    userData,
    chatData,
    chatUser,
    setChatUser,
    setMessagesId,
  } = useContext(AppContext);

  const navigate = useNavigate();
  const [searchResults, setSearchResults] = useState(null);

  // Generate a consistent conversation ID from two UIDs
  const getMessagesId = (uid1, uid2) => {
    return uid1 < uid2 ? `${uid1}_${uid2}` : `${uid2}_${uid1}`;
  };

  // Set up a chat with a user (from search result or contact list)
  const setChat = async (user) => {
    try {
      const msgId = getMessagesId(userData.uid, user.id || user.rId);
      const otherUid = user.id || user.rId;

      // Check if the messages conversation doc exists, create if not
      const msgDocRef = doc(db, "messages", msgId);
      const msgDocSnap = await getDoc(msgDocRef);

      if (!msgDocSnap.exists()) {
        await setDoc(msgDocRef, {
          createdAt: serverTimestamp(),
          users: [userData.uid, otherUid],
        });
      }

      // Add to both users' chatData if not already there
      const currentUserChatRef = doc(db, "chats", userData.uid);
      const otherUserChatRef = doc(db, "chats", otherUid);

      const currentUserChatSnap = await getDoc(currentUserChatRef);
      const currentChatData = currentUserChatSnap.data()?.chatData || [];

      if (!currentChatData.find((c) => c.rId === otherUid)) {
        await updateDoc(currentUserChatRef, {
          chatData: arrayUnion({
            rId: otherUid,
            messageId: msgId,
            lastMessage: "",
            messageSeen: true,
            updatedAt: Date.now(),
          }),
        });

        await updateDoc(otherUserChatRef, {
          chatData: arrayUnion({
            rId: userData.uid,
            messageId: msgId,
            lastMessage: "",
            messageSeen: true,
            updatedAt: Date.now(),
          }),
        });
      }

      // Set the active chat in context
      const otherUserRef = doc(db, "users", otherUid);
      const otherUserSnap = await getDoc(otherUserRef);
      const otherUserData = otherUserSnap.data();

      setChatUser({
        ...otherUserData,
        uid: otherUid,
      });
      setMessagesId(msgId);
      setSearchResults(null);

    } catch (error) {
      console.error("Error setting up chat:", error);
    }
  };

  const inputHandler = async (e) => {
    try {
      const input = e.target.value.trim();

      if (!input) {
        setSearchResults(null);
        return;
      }

      const userRef = collection(db, "users");

      const q = query(
        userRef,
        where("username", ">=", input.toLowerCase()),
        where("username", "<=", input.toLowerCase() + '\uf8ff')
      );

      const querySnap = await getDocs(q);

      if (!querySnap.empty) {
        const results = querySnap.docs
          .filter((doc) => doc.id !== userData?.uid)
          .map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));
        setSearchResults(results);
      } else {
        setSearchResults([]);
      }
    } catch (error) {
      console.error("Search error:", error);
    }
  };

  return (
    <div className='ls'>

      <div className="ls-top">

        <div className="ls-nav">

          <img src={assets.logo} className='logo' alt="Logo" />

          <div className="menu">

            <img
              src={userData?.avatar || assets.menu_icon}
              alt=""
              className="user-avatar"
            />

            <div className="sub-menu">
              <p onClick={() => navigate('/profile')}>Edit Profile</p>
              <hr />
              <p onClick={() => logout()}>Logout</p>
            </div>

          </div>

        </div>

        <div className="ls-search">
          <img src={assets.search_icon} alt="Search Icon" />
          <input
            onChange={inputHandler}
            type="text"
            placeholder='Search here...'
          />
        </div>

      </div>

      <div className="ls-list">

        {searchResults !== null ? (
          // Show search results
          searchResults.length > 0 ? (
            searchResults.map((user) => (
              <div
                key={user.id}
                className="friends"
                onClick={() => setChat(user)}
              >
                <img src={user.avatar || assets.profile_img} alt="Profile" />
                <div>
                  <p>{user.name || user.username}</p>
                  <span>{user.bio || 'Hey there!'}</span>
                </div>
              </div>
            ))
          ) : (
            <div className="no-results" style={{ padding: '20px', textAlign: 'center', color: '#aaa', fontSize: '13px' }}>
              No users found
            </div>
          )
        ) : (
          // Show real contact list from chatData
          chatData.length > 0 ? (
            chatData.map((item, index) => (
              <div
                key={index}
                className={`friends ${chatUser?.uid === item.rId ? 'active' : ''}`}
                onClick={() => setChat(item)}
              >
                <img src={item.userData?.avatar || assets.profile_img} alt="Profile" />
                <div>
                  <p>{item.userData?.name || item.userData?.username || 'User'}</p>
                  <span className={!item.messageSeen ? 'unread' : ''}>
                    {item.lastMessage || 'Start a conversation'}
                  </span>
                </div>
              </div>
            ))
          ) : (
            <div className="no-results" style={{ padding: '20px', textAlign: 'center', color: '#aaa', fontSize: '13px' }}>
              Search for users to start chatting
            </div>
          )
        )}

      </div>

    </div>
  );

};

export default LeftSidebar;