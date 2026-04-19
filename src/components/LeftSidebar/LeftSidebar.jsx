import React, { useContext, useState } from 'react';
import './LeftSidebar.css';
import assets from '../../assets/assets';
import { AppContext } from '../../context/AppContextProvider';
import { useNavigate } from 'react-router-dom';
import { logout } from '../../config/firebase';
import { toast } from 'react-toastify';
import StatusTab from '../Status/StatusTab';

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
  const [activeTab, setActiveTab] = useState(() => localStorage.getItem('ls-tab') || 'chats'); // 'chats' | 'rooms' | 'status'
  const [showCreateRoom, setShowCreateRoom] = useState(false);
  const [roomName, setRoomName] = useState('');
  const [roomSearch, setRoomSearch] = useState('');
  const [roomSearchResults, setRoomSearchResults] = useState(null);

  // Theme toggle
  const themes = ['dark', 'light', 'gradient', 'modern'];
  const [currentTheme, setCurrentTheme] = useState(() => {
    const saved = localStorage.getItem('theme');
    return themes.includes(saved) ? saved : 'dark';
  });

  const [accent, setAccent] = useState(() => {
    return localStorage.getItem('accent') || '';
  });

  const ACCENT_OPTIONS = [
    { id: '', label: 'Default', color: '#6366f1' },
    { id: 'ocean', label: 'Ocean', color: '#0ea5e9' },
    { id: 'emerald', label: 'Emerald', color: '#10b981' },
    { id: 'rose', label: 'Rose', color: '#f43f5e' },
    { id: 'amber', label: 'Amber', color: '#f59e0b' },
  ];

  const toggleTheme = () => {
    const currentIndex = themes.indexOf(currentTheme);
    const newTheme = themes[(currentIndex + 1) % themes.length];
    setCurrentTheme(newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
  };

  const getThemeIcon = () => {
    switch (currentTheme) {
      case 'light': return '☀️';
      case 'dark': return '🌙';
      case 'gradient': return '🌅';
      case 'modern': return '🏙️';
      default: return '🌙';
    }
  };

  const setAccentColor = (id) => {
    setAccent(id);
    if (id) {
      document.documentElement.setAttribute('data-accent', id);
    } else {
      document.documentElement.removeAttribute('data-accent');
    }
    localStorage.setItem('accent', id);
  };

  React.useEffect(() => {
    const saved = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', saved);
    const savedAccent = localStorage.getItem('accent');
    if (savedAccent) {
      document.documentElement.setAttribute('data-accent', savedAccent);
    }
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

      // Mark as seen when opening chat
      const updatedCurrentChat = currentChatData.map((item) => {
        if (item.rId === otherUid) {
          return { ...item, messageSeen: true };
        }
        return item;
      });
      if (currentChatData.find((c) => c.rId === otherUid && !c.messageSeen)) {
        await updateDoc(currentUserChatRef, { chatData: updatedCurrentChat });
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
        admins: [userData.uid],
      });

      toast.success(`Room "${roomName.trim()}" created!`);
      setRoomName('');
      setShowCreateRoom(false);

      // Auto-select the new room
      setChatType("room");
      setChatUser(null);
      setRoomData({ id: roomRef.id, name: roomName.trim(), members: [userData.uid], admins: [userData.uid] });
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

  const formatChatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;

    if (diff < 86400000 && date.getDate() === now.getDate()) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    if (diff < 604800000) {
      return date.toLocaleDateString([], { weekday: 'short' });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  return (
    <div className='ls'>

      <div className="ls-top">

        <div className="ls-nav">
          <img src={assets.logo} className='logo' alt="Logo" />
          <div className="nav-right">
            <button className="theme-toggle" onClick={toggleTheme} title="Toggle theme">
              {getThemeIcon()}
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
                <p className="sub-menu-label">Theme Colors</p>
                <div className="accent-picker">
                  {ACCENT_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      className={`accent-swatch ${accent === opt.id ? 'active' : ''}`}
                      style={{ background: opt.color }}
                      onClick={() => setAccentColor(opt.id)}
                      title={opt.label}
                    />
                  ))}
                </div>
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
            onClick={() => { setActiveTab('chats'); localStorage.setItem('ls-tab', 'chats'); }}
          >
            💬 Chats
          </button>
          <button
            className={`ls-tab ${activeTab === 'rooms' ? 'active' : ''}`}
            onClick={() => { setActiveTab('rooms'); localStorage.setItem('ls-tab', 'rooms'); }}
          >
            👥 Rooms
          </button>
          <button
            className={`ls-tab ${activeTab === 'status' ? 'active' : ''}`}
            onClick={() => { setActiveTab('status'); localStorage.setItem('ls-tab', 'status'); }}
          >
            📸 Status
          </button>
        </div>

        {/* Search — only shown for chats & rooms tabs */}
        {activeTab === 'chats' ? (
          <div className="ls-search">
            <img src={assets.search_icon} alt="Search Icon" />
            <input onChange={inputHandler} type="text" placeholder='Search users...' />
          </div>
        ) : activeTab === 'rooms' ? (
          <div className="ls-search">
            <img src={assets.search_icon} alt="Search Icon" />
            <input
              value={roomSearch}
              onChange={searchRooms}
              type="text"
              placeholder='Find rooms to join...'
            />
          </div>
        ) : null}

      </div>

      <div className="ls-list">

        {activeTab === 'status' ? (
          <StatusTab />
        ) : activeTab === 'chats' ? (
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
                    <div className="friend-info">
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
                    <div className="friend-info">
                      <div className="friend-top-row">
                        <p>{item.userData?.name || item.userData?.username || 'User'}</p>
                        <span className="chat-time">{formatChatTime(item.updatedAt)}</span>
                      </div>
                      <div className="friend-bottom-row">
                        <span className={`last-msg ${!item.messageSeen ? 'unread' : ''}`}>
                          {item.lastMessage || 'Start a conversation'}
                        </span>
                        {!item.messageSeen && <span className="unread-badge"></span>}
                      </div>
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
