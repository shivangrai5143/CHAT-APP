import React, { useContext, useState } from 'react';
import './LeftSidebar.css';
import assets from '../../assets/assets';
import { AppContext } from '../../context/AppContextProvider';
import { useNavigate } from 'react-router-dom';
import { logout } from '../../config/firebase';
import { toast } from 'react-toastify';

import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  addDoc,
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
    chatType,
    setChatType,
    roomData,
    setRoomData,
    rooms,
  } = useContext(AppContext);

  const navigate = useNavigate();
  const [searchResults, setSearchResults] = useState(null);
  const [activeTab, setActiveTab] = useState('chats'); // 'chats' or 'rooms'
  const [showCreateRoom, setShowCreateRoom] = useState(false);
  const [roomName, setRoomName] = useState('');
  const [roomSearch, setRoomSearch] = useState('');
  const [roomSearchResults, setRoomSearchResults] = useState(null);

  // Theme toggle
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem('theme');
    return saved ? saved === 'dark' : true;
  });

  const toggleTheme = () => {
    const newTheme = isDark ? 'light' : 'dark';
    setIsDark(!isDark);
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
  };

  React.useEffect(() => {
    const saved = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', saved);
  }, []);

  // ─── 1-on-1 Chat Helpers ───

  const getMessagesId = (uid1, uid2) => {
    return uid1 < uid2 ? `${uid1}_${uid2}` : `${uid2}_${uid1}`;
  };

  const setChat = async (user) => {
    try {
      const msgId = getMessagesId(userData.uid, user.id || user.rId);
      const otherUid = user.id || user.rId;

      const msgDocRef = doc(db, "messages", msgId);
      const msgDocSnap = await getDoc(msgDocRef);

      if (!msgDocSnap.exists()) {
        await setDoc(msgDocRef, {
          createdAt: serverTimestamp(),
          users: [userData.uid, otherUid],
        });
      }

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

        toast.success(`Connected with ${user.name || user.username || 'user'}!`);
      }

      const otherUserRef = doc(db, "users", otherUid);
      const otherUserSnap = await getDoc(otherUserRef);
      const otherUserData = otherUserSnap.data();

      setChatType("user");
      setRoomData(null);
      setChatUser({ ...otherUserData, uid: otherUid });
      setMessagesId(msgId);
      setSearchResults(null);

    } catch (error) {
      console.error("Error setting up chat:", error);
    }
  };

  const inputHandler = async (e) => {
    try {
      const input = e.target.value.trim();
      if (!input) { setSearchResults(null); return; }

      const userRef = collection(db, "users");
      const q = query(
        userRef,
        where("username", ">=", input.toLowerCase()),
        where("username", "<=", input.toLowerCase() + '\uf8ff')
      );

      const querySnap = await getDocs(q);
      if (!querySnap.empty) {
        const results = querySnap.docs
          .filter((d) => d.id !== userData?.uid)
          .map((d) => ({ id: d.id, ...d.data() }));
        setSearchResults(results);
      } else {
        setSearchResults([]);
      }
    } catch (error) {
      console.error("Search error:", error);
    }
  };

  // ─── Room Helpers ───

  const createRoom = async () => {
    if (!roomName.trim()) return;
    try {
      const roomRef = await addDoc(collection(db, "rooms"), {
        name: roomName.trim(),
        createdBy: userData.uid,
        createdAt: serverTimestamp(),
        updatedAt: Date.now(),
        members: [userData.uid],
      });

      toast.success(`Room "${roomName.trim()}" created!`);
      setRoomName('');
      setShowCreateRoom(false);

      // Auto-select the new room
      setChatType("room");
      setChatUser(null);
      setRoomData({ id: roomRef.id, name: roomName.trim(), members: [userData.uid] });
      setMessagesId(roomRef.id);

    } catch (error) {
      console.error("Error creating room:", error);
      toast.error("Failed to create room");
    }
  };

  const selectRoom = (room) => {
    setChatType("room");
    setChatUser(null);
    setRoomData(room);
    setMessagesId(room.id);
  };

  const searchRooms = async (e) => {
    const input = e.target.value.trim();
    setRoomSearch(input);
    if (!input) { setRoomSearchResults(null); return; }

    try {
      const roomsRef = collection(db, "rooms");
      const q = query(
        roomsRef,
        where("name", ">=", input),
        where("name", "<=", input + '\uf8ff')
      );
      const snap = await getDocs(q);

      if (!snap.empty) {
        const results = snap.docs
          .filter((d) => {
            const data = d.data();
            return !data.members?.includes(userData.uid);
          })
          .map((d) => ({ id: d.id, ...d.data() }));
        setRoomSearchResults(results);
      } else {
        setRoomSearchResults([]);
      }
    } catch (error) {
      console.error("Room search error:", error);
    }
  };

  const joinRoom = async (room) => {
    try {
      const roomRef = doc(db, "rooms", room.id);
      await updateDoc(roomRef, {
        members: arrayUnion(userData.uid),
      });

      toast.success(`Joined "${room.name}"!`);
      setRoomSearchResults(null);
      setRoomSearch('');

      setChatType("room");
      setChatUser(null);
      setRoomData({ ...room, members: [...(room.members || []), userData.uid] });
      setMessagesId(room.id);

    } catch (error) {
      console.error("Error joining room:", error);
    }
  };

  const isOnline = (lastSeen) => lastSeen && Date.now() - lastSeen < 70000;

  return (
    <div className='ls'>

      <div className="ls-top">

        <div className="ls-nav">
          <img src={assets.logo} className='logo' alt="Logo" />
          <div className="nav-right">
            <button className="theme-toggle" onClick={toggleTheme} title="Toggle theme">
              {isDark ? '☀️' : '🌙'}
            </button>
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
        </div>

        {/* Tabs */}
        <div className="ls-tabs">
          <button
            className={`ls-tab ${activeTab === 'chats' ? 'active' : ''}`}
            onClick={() => setActiveTab('chats')}
          >
            💬 Chats
          </button>
          <button
            className={`ls-tab ${activeTab === 'rooms' ? 'active' : ''}`}
            onClick={() => setActiveTab('rooms')}
          >
            👥 Rooms
          </button>
        </div>

        {/* Search */}
        {activeTab === 'chats' ? (
          <div className="ls-search">
            <img src={assets.search_icon} alt="Search Icon" />
            <input onChange={inputHandler} type="text" placeholder='Search users...' />
          </div>
        ) : (
          <div className="ls-search">
            <img src={assets.search_icon} alt="Search Icon" />
            <input
              value={roomSearch}
              onChange={searchRooms}
              type="text"
              placeholder='Find rooms to join...'
            />
          </div>
        )}

      </div>

      <div className="ls-list">

        {activeTab === 'chats' ? (
          // ─── CHATS TAB ───
          <>
            {searchResults !== null ? (
              searchResults.length > 0 ? (
                searchResults.map((user) => (
                  <div key={user.id} className="friends" onClick={() => setChat(user)}>
                    <div className="avatar-wrapper">
                      <img src={user.avatar || assets.profile_img} alt="" />
                      {isOnline(user.lastSeen) && <span className="online-dot"></span>}
                    </div>
                    <div>
                      <p>{user.name || user.username}</p>
                      <span>{user.bio || 'Hey there!'}</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="no-results">No users found</div>
              )
            ) : (
              chatData.length > 0 ? (
                chatData.map((item, index) => (
                  <div
                    key={index}
                    className={`friends ${chatType === 'user' && chatUser?.uid === item.rId ? 'active' : ''}`}
                    onClick={() => setChat(item)}
                  >
                    <div className="avatar-wrapper">
                      <img src={item.userData?.avatar || assets.profile_img} alt="" />
                      {isOnline(item.userData?.lastSeen) && <span className="online-dot"></span>}
                    </div>
                    <div>
                      <p>{item.userData?.name || item.userData?.username || 'User'}</p>
                      <span className={!item.messageSeen ? 'unread' : ''}>
                        {item.lastMessage || 'Start a conversation'}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="no-results">Search for users to start chatting</div>
              )
            )}
          </>
        ) : (
          // ─── ROOMS TAB ───
          <>
            {/* Create Room Button */}
            <div className="create-room-section">
              {showCreateRoom ? (
                <div className="create-room-form">
                  <input
                    type="text"
                    value={roomName}
                    onChange={(e) => setRoomName(e.target.value)}
                    placeholder="Room name..."
                    onKeyDown={(e) => e.key === 'Enter' && createRoom()}
                  />
                  <div className="create-room-actions">
                    <button className="create-btn" onClick={createRoom}>Create</button>
                    <button className="cancel-btn" onClick={() => { setShowCreateRoom(false); setRoomName(''); }}>Cancel</button>
                  </div>
                </div>
              ) : (
                <button className="create-room-btn" onClick={() => setShowCreateRoom(true)}>
                  ＋ Create Room
                </button>
              )}
            </div>

            {/* Room search results (rooms to join) */}
            {roomSearchResults !== null && (
              <>
                {roomSearchResults.length > 0 ? (
                  roomSearchResults.map((room) => (
                    <div key={room.id} className="friends room-item" onClick={() => joinRoom(room)}>
                      <div className="room-icon">👥</div>
                      <div>
                        <p>{room.name}</p>
                        <span>{room.members?.length || 0} members · Click to join</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="no-results">No rooms found</div>
                )}
                <hr className="search-divider" />
              </>
            )}

            {/* User's rooms */}
            {rooms.length > 0 ? (
              rooms.map((room) => (
                <div
                  key={room.id}
                  className={`friends room-item ${chatType === 'room' && roomData?.id === room.id ? 'active' : ''}`}
                  onClick={() => selectRoom(room)}
                >
                  <div className="room-icon">👥</div>
                  <div>
                    <p>{room.name}</p>
                    <span>{room.members?.length || 0} members</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="no-results">
                {roomSearchResults === null ? 'Create or search for rooms' : ''}
              </div>
            )}
          </>
        )}

      </div>

    </div>
  );
};

export default LeftSidebar;