import React, { useContext, useState } from 'react';
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

const Sidebar = () => {

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
  const [showMenu, setShowMenu] = useState(false);

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
    <div className="w-full md:w-[320px] lg:w-[360px] h-[50vh] md:h-full bg-slate-900 border-r border-slate-700/50 flex flex-col flex-shrink-0 transition-all">
      
      {/* Top Header */}
      <div className="p-4 border-b border-slate-700/50">
        <div className="flex items-center justify-between mb-4">
          <img src={assets.logo} className="h-8" alt="Logo" />
          <div className="relative">
            <img
              src={userData?.avatar || assets.menu_icon}
              alt="Menu"
              className="w-10 h-10 rounded-full cursor-pointer border-2 border-slate-700 hover:border-indigo-500 transition-colors object-cover"
              onClick={() => setShowMenu(!showMenu)}
            />
            {showMenu && (
              <div className="absolute right-0 top-12 w-48 bg-slate-800 border border-slate-700 rounded-xl shadow-xl py-2 z-50 animate-fadeIn">
                <button onClick={() => navigate('/profile')} className="w-full text-left px-4 py-2 hover:bg-slate-700 text-slate-200 transition-colors">Edit Profile</button>
                <div className="border-t border-slate-700 my-1"></div>
                <button onClick={() => logout()} className="w-full text-left px-4 py-2 hover:bg-slate-700 text-red-400 transition-colors">Logout</button>
              </div>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex bg-slate-800/50 p-1 rounded-lg mb-4 gap-1">
          <button
            className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-all ${activeTab === 'chats' ? 'bg-indigo-600 shadow text-white' : 'text-slate-400 hover:text-white'}`}
            onClick={() => { setActiveTab('chats'); localStorage.setItem('ls-tab', 'chats'); }}
          >
            Chats
          </button>
          <button
            className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-all ${activeTab === 'rooms' ? 'bg-indigo-600 shadow text-white' : 'text-slate-400 hover:text-white'}`}
            onClick={() => { setActiveTab('rooms'); localStorage.setItem('ls-tab', 'rooms'); }}
          >
            Rooms
          </button>
          <button
            className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-all ${activeTab === 'status' ? 'bg-indigo-600 shadow text-white' : 'text-slate-400 hover:text-white'}`}
            onClick={() => { setActiveTab('status'); localStorage.setItem('ls-tab', 'status'); }}
          >
            Status
          </button>
        </div>

        {/* Search */}
        {activeTab === 'chats' ? (
          <div className="relative flex items-center bg-slate-800 rounded-lg overflow-hidden border border-slate-700 focus-within:border-indigo-500 transition-colors">
            <img src={assets.search_icon} alt="Search" className="w-4 h-4 ml-3 opacity-50" />
            <input onChange={inputHandler} type="text" placeholder="Search users..." className="w-full bg-transparent border-none text-slate-200 px-3 py-2 text-sm focus:outline-none placeholder-slate-500" />
          </div>
        ) : activeTab === 'rooms' ? (
          <div className="relative flex items-center bg-slate-800 rounded-lg overflow-hidden border border-slate-700 focus-within:border-indigo-500 transition-colors">
            <img src={assets.search_icon} alt="Search" className="w-4 h-4 ml-3 opacity-50" />
            <input
              value={roomSearch}
              onChange={searchRooms}
              type="text"
              placeholder="Find rooms to join..."
              className="w-full bg-transparent border-none text-slate-200 px-3 py-2 text-sm focus:outline-none placeholder-slate-500"
            />
          </div>
        ) : null}
      </div>

      {/* List Area */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar">
        {activeTab === 'status' ? (
          <StatusTab />
        ) : activeTab === 'chats' ? (
          <>
            {searchResults !== null ? (
              searchResults.length > 0 ? (
                searchResults.map((user) => (
                  <div key={user.id} className="flex items-center gap-3 p-3 mx-2 my-1 hover:bg-slate-800 rounded-xl cursor-pointer transition-colors" onClick={() => setChat(user)}>
                    <div className="relative">
                      <img src={user.avatar || assets.profile_img} className="w-12 h-12 rounded-full object-cover" alt="" />
                      {isOnline(user.lastSeen) && <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-slate-900 rounded-full"></span>}
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <p className="font-semibold text-slate-200 truncate">{user.name || user.username}</p>
                      <p className="text-sm text-slate-400 truncate">{user.bio || 'Hey there!'}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center text-slate-500 mt-6 text-sm">No users found</div>
              )
            ) : (
              chatData.length > 0 ? (
                chatData.map((item, index) => (
                  <div
                    key={index}
                    className={`flex items-center gap-3 p-3 mx-2 my-1 rounded-xl cursor-pointer transition-colors ${chatType === 'user' && chatUser?.uid === item.rId ? 'bg-indigo-600/20 border border-indigo-500/30' : 'hover:bg-slate-800 border border-transparent'}`}
                    onClick={() => setChat(item)}
                  >
                    <div className="relative">
                      <img src={item.userData?.avatar || assets.profile_img} className="w-12 h-12 rounded-full object-cover" alt="" />
                      {isOnline(item.userData?.lastSeen) && <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-slate-900 rounded-full"></span>}
                    </div>
                    <div className="flex-1 overflow-hidden flex flex-col justify-center">
                      <div className="flex justify-between items-baseline mb-0.5">
                        <p className="font-semibold text-slate-200 truncate pr-2">{item.userData?.name || item.userData?.username || 'User'}</p>
                        <span className="text-[11px] text-slate-400 whitespace-nowrap">{formatChatTime(item.updatedAt)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <p className={`text-sm truncate pr-2 ${!item.messageSeen ? 'text-indigo-300 font-medium' : 'text-slate-400'}`}>
                          {item.lastMessage || 'Start a conversation'}
                        </p>
                        {!item.messageSeen && <span className="w-2.5 h-2.5 bg-indigo-500 rounded-full shrink-0"></span>}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center text-slate-500 mt-6 text-sm">Search for users to start chatting</div>
              )
            )}
          </>
        ) : (
          <>
            {/* Create Room Button */}
            <div className="p-3 mx-2 mt-2">
              {showCreateRoom ? (
                <div className="bg-slate-800 p-3 rounded-xl border border-slate-700">
                  <input
                    type="text"
                    value={roomName}
                    onChange={(e) => setRoomName(e.target.value)}
                    placeholder="Room name..."
                    onKeyDown={(e) => e.key === 'Enter' && createRoom()}
                    className="w-full bg-slate-900 border border-slate-700 text-slate-200 px-3 py-2 rounded-lg text-sm mb-3 focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                  <div className="flex gap-2">
                    <button className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white text-sm py-1.5 rounded-lg transition-colors" onClick={createRoom}>Create</button>
                    <button className="flex-1 bg-slate-700 hover:bg-slate-600 text-white text-sm py-1.5 rounded-lg transition-colors" onClick={() => { setShowCreateRoom(false); setRoomName(''); }}>Cancel</button>
                  </div>
                </div>
              ) : (
                <button className="w-full flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 border-dashed text-slate-300 py-2.5 rounded-xl transition-colors text-sm font-medium" onClick={() => setShowCreateRoom(true)}>
                  <span className="text-lg leading-none">+</span> Create Room
                </button>
              )}
            </div>

            {/* Room search results */}
            {roomSearchResults !== null && (
              <>
                {roomSearchResults.length > 0 ? (
                  roomSearchResults.map((room) => (
                    <div key={room.id} className="flex items-center gap-3 p-3 mx-2 my-1 hover:bg-slate-800 rounded-xl cursor-pointer transition-colors" onClick={() => joinRoom(room)}>
                      <div className="w-12 h-12 bg-indigo-900/50 text-indigo-300 rounded-full flex items-center justify-center text-xl shrink-0">👥</div>
                      <div className="flex-1 overflow-hidden">
                        <p className="font-semibold text-slate-200 truncate">{room.name}</p>
                        <p className="text-sm text-indigo-400 truncate">Click to join ({room.members?.length || 0} members)</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center text-slate-500 mt-4 text-sm">No rooms found</div>
                )}
                <div className="mx-4 my-2 border-t border-slate-700/50"></div>
              </>
            )}

            {/* User's rooms */}
            {rooms.length > 0 ? (
              rooms.map((room) => (
                <div
                  key={room.id}
                  className={`flex items-center gap-3 p-3 mx-2 my-1 rounded-xl cursor-pointer transition-colors ${chatType === 'room' && roomData?.id === room.id ? 'bg-indigo-600/20 border border-indigo-500/30' : 'hover:bg-slate-800 border border-transparent'}`}
                  onClick={() => selectRoom(room)}
                >
                  <div className="w-12 h-12 bg-slate-800 text-slate-300 rounded-full flex items-center justify-center text-xl shrink-0">👥</div>
                  <div className="flex-1 overflow-hidden">
                    <p className="font-semibold text-slate-200 truncate">{room.name}</p>
                    <p className="text-sm text-slate-400 truncate">{room.members?.length || 0} members</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center text-slate-500 mt-6 text-sm">
                {roomSearchResults === null ? 'Create or search for rooms' : ''}
              </div>
            )}
          </>
        )}
      </div>

    </div>
  );
};

export default Sidebar;
