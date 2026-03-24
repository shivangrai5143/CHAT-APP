import React, { useContext, useState, useEffect, useRef, useCallback } from 'react';
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
  writeBatch,
} from 'firebase/firestore';
import { db } from '../../config/firebase';
import { toast } from 'react-toastify';
import EmojiPicker from 'emoji-picker-react';

const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🔥'];

const ChatBox = () => {
  const {
    userData,
    chatUser,
    messagesId,
    messages,
    chatType,
    roomData,
    setTyping,
    getTypingUsers,
    tabFocusedRef,
  } = useContext(AppContext);

  const [input, setInput] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchIndex, setSearchIndex] = useState(0);
  const [activeReactionMsg, setActiveReactionMsg] = useState(null);
  const scrollRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const emojiRef = useRef(null);
  const searchInputRef = useRef(null);
  const msgRefs = useRef({});

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (scrollRef.current && !showSearch) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, showSearch]);

  // Close emoji picker on outside click
  useEffect(() => {
    const handleClick = (e) => {
      if (emojiRef.current && !emojiRef.current.contains(e.target)) {
        setShowEmojiPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Close reaction picker on outside click
  useEffect(() => {
    const handleClick = () => setActiveReactionMsg(null);
    if (activeReactionMsg) {
      document.addEventListener('mousedown', handleClick);
      return () => document.removeEventListener('mousedown', handleClick);
    }
  }, [activeReactionMsg]);

  // ─── Mark messages as delivered/read ───
  useEffect(() => {
    if (!messagesId || !userData?.uid || !messages.length) return;
    if (chatType === "room") return; // receipts only for 1-on-1

    const parentCollection = "messages";
    const batch = writeBatch(db);
    let hasUpdates = false;

    messages.forEach((msg) => {
      if (msg.sId !== userData.uid) {
        // Mark others' messages as read (since we're viewing them)
        if (msg.status && msg.status !== 'read') {
          const msgRef = doc(db, parentCollection, messagesId, "messages", msg.id);
          batch.update(msgRef, { status: 'read' });
          hasUpdates = true;
        }
      }
    });

    if (hasUpdates) {
      batch.commit().catch((e) => console.log("Receipt update error:", e));
    }
  }, [messages, messagesId, userData?.uid, chatType]);

  // ─── Typing handlers ───
  const handleTyping = useCallback(() => {
    if (!messagesId) return;
    setTyping(messagesId, true);

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    typingTimeoutRef.current = setTimeout(() => {
      setTyping(messagesId, false);
    }, 2000);
  }, [messagesId, setTyping]);

  const handleInputChange = (e) => {
    setInput(e.target.value);
    handleTyping();
  };

  // ─── Send message ───
  const sendMessage = async () => {
    try {
      if (!input.trim() || !messagesId) return;

      const messageText = input.trim();
      setInput('');
      setShowEmojiPicker(false);

      // Clear typing
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      setTyping(messagesId, false);

      const parentCollection = chatType === "room" ? "rooms" : "messages";

      const msgData = {
        sId: userData.uid,
        text: messageText,
        createdAt: serverTimestamp(),
        status: 'sent',
      };

      // For rooms, include sender name and avatar
      if (chatType === "room") {
        msgData.sName = userData.name || userData.username || 'User';
        msgData.sAvatar = userData.avatar || '';
        delete msgData.status; // no receipts in rooms
      }

      await addDoc(collection(db, parentCollection, messagesId, "messages"), msgData);

      // Update lastMessage for 1-on-1 chats only
      if (chatType === "user" && chatUser) {
        await updateChatData(messageText);
      }

      // Update room's updatedAt
      if (chatType === "room") {
        const roomRef = doc(db, "rooms", messagesId);
        await updateDoc(roomRef, { updatedAt: Date.now() });
      }

    } catch (error) {
      console.error("Error sending message:", error);
      toast.error("Failed to send message");
    }
  };

  // ─── Send file (images + documents) ───
  const sendFile = async (e) => {
    try {
      const file = e.target.files[0];
      if (!file || !messagesId) return;

      const isImage = file.type.startsWith('image/');
      const formData = new FormData();
      formData.append("file", file);
      formData.append("upload_preset", "Chat_Images");

      // Use auto resource_type for non-images
      const resourceType = isImage ? 'image' : 'auto';
      const res = await fetch(
        `https://api.cloudinary.com/v1_1/du3hiflqj/${resourceType}/upload`,
        { method: "POST", body: formData }
      );
      const data = await res.json();

      if (data.secure_url) {
        const parentCollection = chatType === "room" ? "rooms" : "messages";

        const msgData = {
          sId: userData.uid,
          createdAt: serverTimestamp(),
          status: 'sent',
        };

        if (isImage) {
          msgData.image = data.secure_url;
        } else {
          msgData.fileUrl = data.secure_url;
          msgData.fileName = file.name;
          msgData.fileType = file.type || 'application/octet-stream';
          msgData.fileSize = file.size;
        }

        if (chatType === "room") {
          msgData.sName = userData.name || userData.username || 'User';
          msgData.sAvatar = userData.avatar || '';
          delete msgData.status;
        }

        await addDoc(collection(db, parentCollection, messagesId, "messages"), msgData);

        const previewText = isImage ? "📷 Image" : `📎 ${file.name}`;
        if (chatType === "user" && chatUser) {
          await updateChatData(previewText);
        }

        if (chatType === "room") {
          const roomRef = doc(db, "rooms", messagesId);
          await updateDoc(roomRef, { updatedAt: Date.now() });
        }
      }

      e.target.value = '';

    } catch (error) {
      console.error("Error sending file:", error);
      toast.error("Failed to send file");
    }
  };

  // ─── Add reaction ───
  const addReaction = async (msgId, emoji) => {
    try {
      const parentCollection = chatType === "room" ? "rooms" : "messages";
      const msgRef = doc(db, parentCollection, messagesId, "messages", msgId);
      const msgSnap = await getDoc(msgRef);
      const msgData = msgSnap.data();

      const reactions = msgData?.reactions || {};
      const users = reactions[emoji] || [];

      if (users.includes(userData.uid)) {
        // Remove reaction
        const updated = users.filter((u) => u !== userData.uid);
        if (updated.length === 0) {
          delete reactions[emoji];
        } else {
          reactions[emoji] = updated;
        }
      } else {
        reactions[emoji] = [...users, userData.uid];
      }

      await updateDoc(msgRef, { reactions });
      setActiveReactionMsg(null);
    } catch (error) {
      console.error("Error adding reaction:", error);
    }
  };

  const updateChatData = async (lastMessage) => {
    try {
      const currentChatRef = doc(db, "chats", userData.uid);
      const currentChatSnap = await getDoc(currentChatRef);
      const currentChatData = currentChatSnap.data()?.chatData || [];

      const updatedCurrentChat = currentChatData.map((item) => {
        if (item.rId === chatUser.uid) {
          return { ...item, lastMessage, updatedAt: Date.now(), messageSeen: true };
        }
        return item;
      });
      await updateDoc(currentChatRef, { chatData: updatedCurrentChat });

      const otherChatRef = doc(db, "chats", chatUser.uid);
      const otherChatSnap = await getDoc(otherChatRef);
      const otherChatData = otherChatSnap.data()?.chatData || [];

      const updatedOtherChat = otherChatData.map((item) => {
        if (item.rId === userData.uid) {
          return { ...item, lastMessage, updatedAt: Date.now(), messageSeen: false };
        }
        return item;
      });
      await updateDoc(otherChatRef, { chatData: updatedOtherChat });

    } catch (error) {
      console.error("Error updating chat data:", error);
    }
  };

  // ─── Utilities ───
  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = timestamp instanceof Timestamp
      ? timestamp.toDate()
      : new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatLastSeen = (lastSeen) => {
    if (!lastSeen) return 'Offline';
    const diff = Date.now() - lastSeen;
    if (diff < 70000) return null; // online
    if (diff < 60000) return 'Last seen just now';
    if (diff < 3600000) return `Last seen ${Math.floor(diff / 60000)} min ago`;
    if (diff < 86400000) return `Last seen ${Math.floor(diff / 3600000)}h ago`;
    const d = new Date(lastSeen);
    return `Last seen ${d.toLocaleDateString([], { month: 'short', day: 'numeric' })}`;
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return '';
    const date = timestamp instanceof Timestamp
      ? timestamp.toDate()
      : new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return date.toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' });
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  };

  const getFileIcon = (type) => {
    if (!type) return '📄';
    if (type.includes('pdf')) return '📕';
    if (type.includes('word') || type.includes('doc')) return '📘';
    if (type.includes('excel') || type.includes('sheet') || type.includes('xls')) return '📗';
    if (type.includes('zip') || type.includes('rar') || type.includes('7z')) return '📦';
    if (type.includes('text')) return '📝';
    return '📄';
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') sendMessage();
  };

  const isOnline = (lastSeen) => lastSeen && Date.now() - lastSeen < 70000;

  const onEmojiClick = (emojiData) => {
    setInput((prev) => prev + emojiData.emoji);
  };

  // ─── Search logic ───
  const searchResults = showSearch && searchQuery
    ? messages
      .map((msg, idx) => ({ msg, idx }))
      .filter(({ msg }) => msg.text && msg.text.toLowerCase().includes(searchQuery.toLowerCase()))
    : [];

  const navigateSearch = (direction) => {
    const newIndex = searchIndex + direction;
    if (newIndex >= 0 && newIndex < searchResults.length) {
      setSearchIndex(newIndex);
      const targetMsg = searchResults[newIndex].msg;
      const el = msgRefs.current[targetMsg.id];
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const highlightText = (text, query) => {
    if (!query || !text) return text;
    const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
    return parts.map((part, i) =>
      part.toLowerCase() === query.toLowerCase()
        ? <mark key={i} className="search-mark">{part}</mark>
        : part
    );
  };

  // ─── Render receipt ticks ───
  const renderReceipt = (msg) => {
    if (chatType === "room" || msg.sId !== userData.uid) return null;
    const status = msg.status || 'sent';
    if (status === 'read') {
      return <span className="msg-receipt read" title="Read">✓✓</span>;
    }
    if (status === 'delivered') {
      return <span className="msg-receipt delivered" title="Delivered">✓✓</span>;
    }
    return <span className="msg-receipt sent" title="Sent">✓</span>;
  };

  // ─── Determine date separators and message grouping ───
  const getDateKey = (msg) => {
    if (!msg.createdAt) return '';
    const date = msg.createdAt instanceof Timestamp
      ? msg.createdAt.toDate()
      : new Date(msg.createdAt);
    return date.toDateString();
  };

  // Get typing indicator text
  const typingUserIds = getTypingUsers(messagesId);

  // ─── Welcome state ───
  if (!chatUser && chatType !== "room") {
    return (
      <div className='chat-box'>
        <div className="chat-welcome">
          <img src={assets.logo_icon} alt="Logo" />
          <p>Select a chat or search for a user to start messaging</p>
        </div>
      </div>
    );
  }

  // ─── Room header info ───
  const headerName = chatType === "room"
    ? roomData?.name || 'Room'
    : (chatUser?.name || chatUser?.username || 'User');

  const headerAvatar = chatType === "room"
    ? null
    : (chatUser?.avatar || assets.profile_img);

  const lastSeenText = chatType === "user" ? formatLastSeen(chatUser?.lastSeen) : null;

  return (
    <div className='chat-box'>
      {/* ─── Header ─── */}
      <div className="chat-user">
        {chatType === "room" ? (
          <div className="room-header-icon">👥</div>
        ) : (
          <img src={headerAvatar} alt="" />
        )}
        <div className="chat-user-info">
          <p>
            {headerName}
            {chatType === "user" && isOnline(chatUser?.lastSeen) && (
              <img className='dot' src={assets.green_dot} alt="" />
            )}
            {chatType === "room" && (
              <span className="room-member-count">
                {roomData?.members?.length || 0} members
              </span>
            )}
          </p>
          {chatType === "user" && lastSeenText && (
            <span className="last-seen-text">{lastSeenText}</span>
          )}
          {chatType === "user" && isOnline(chatUser?.lastSeen) && (
            <span className="last-seen-text online-text">Online</span>
          )}
        </div>
        <div className="chat-header-actions">
          <button
            className={`search-toggle ${showSearch ? 'active' : ''}`}
            onClick={() => {
              setShowSearch(!showSearch);
              setSearchQuery('');
              setSearchIndex(0);
            }}
            title="Search messages"
          >
            🔍
          </button>
          <img src={assets.help_icon} className='Help' alt="" />
        </div>
      </div>

      {/* ─── Search Bar ─── */}
      {showSearch && (
        <div className="chat-search-bar">
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search messages..."
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setSearchIndex(0); }}
            autoFocus
          />
          {searchQuery && (
            <div className="search-nav">
              <span className="search-count">
                {searchResults.length > 0 ? `${searchIndex + 1}/${searchResults.length}` : '0 results'}
              </span>
              <button onClick={() => navigateSearch(-1)} disabled={searchIndex <= 0}>▲</button>
              <button onClick={() => navigateSearch(1)} disabled={searchIndex >= searchResults.length - 1}>▼</button>
            </div>
          )}
          <button className="search-close" onClick={() => { setShowSearch(false); setSearchQuery(''); }}>✕</button>
        </div>
      )}

      {/* ─── Messages ─── */}
      <div className="chat-msg" ref={scrollRef}>
        {messages.map((msg, index) => {
          const isSelf = msg.sId === userData.uid;
          const prevMsg = index > 0 ? messages[index - 1] : null;
          const showDateSep = !prevMsg || getDateKey(msg) !== getDateKey(prevMsg);
          const isGrouped = prevMsg && prevMsg.sId === msg.sId && !showDateSep;
          const isSearchMatch = showSearch && searchQuery && msg.text
            && msg.text.toLowerCase().includes(searchQuery.toLowerCase());
          const isCurrentResult = searchResults[searchIndex]?.msg.id === msg.id;

          return (
            <React.Fragment key={msg.id}>
              {showDateSep && msg.createdAt && (
                <div className="date-separator">
                  <span>{formatDate(msg.createdAt)}</span>
                </div>
              )}
              <div
                ref={(el) => { msgRefs.current[msg.id] = el; }}
                className={`${isSelf ? "s-msg" : "r-msg"} ${isGrouped ? "grouped" : ""} ${isSearchMatch ? "search-match" : ""} ${isCurrentResult ? "search-current" : ""}`}
              >
                <div className="msg-content"
                  onMouseEnter={() => setActiveReactionMsg(msg.id)}
                  onMouseLeave={() => setActiveReactionMsg(null)}
                >
                  {/* Sender name for room messages */}
                  {chatType === "room" && !isSelf && !isGrouped && (
                    <span className="msg-sender-name">{msg.sName || 'User'}</span>
                  )}
                  {msg.image ? (
                    <img className='msg-img' src={msg.image} alt="" onClick={() => window.open(msg.image, '_blank')} />
                  ) : msg.fileUrl ? (
                    <div className="msg-file">
                      <span className="file-icon">{getFileIcon(msg.fileType)}</span>
                      <div className="file-info">
                        <span className="file-name">{msg.fileName || 'File'}</span>
                        <span className="file-size">{formatFileSize(msg.fileSize)}</span>
                      </div>
                      <a href={msg.fileUrl} target="_blank" rel="noopener noreferrer" className="file-download" title="Download">
                        ⬇️
                      </a>
                    </div>
                  ) : (
                    <p className="msg">
                      {showSearch && searchQuery ? highlightText(msg.text, searchQuery) : msg.text}
                    </p>
                  )}

                  {/* Reaction picker */}
                  {activeReactionMsg === msg.id && (
                    <div className="reaction-picker" onMouseDown={(e) => e.stopPropagation()}>
                      {QUICK_REACTIONS.map((emoji) => (
                        <button key={emoji} onClick={() => addReaction(msg.id, emoji)}>{emoji}</button>
                      ))}
                    </div>
                  )}

                  {/* Reaction badges */}
                  {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                    <div className="reaction-badges">
                      {Object.entries(msg.reactions).map(([emoji, users]) => (
                        <button
                          key={emoji}
                          className={`reaction-badge ${users.includes(userData.uid) ? 'active' : ''}`}
                          onClick={() => addReaction(msg.id, emoji)}
                        >
                          {emoji} {users.length}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="msg-meta">
                  {!isGrouped && (
                    <img
                      src={
                        isSelf
                          ? (userData.avatar || assets.profile_img)
                          : chatType === "room"
                            ? (msg.sAvatar || assets.profile_img)
                            : (chatUser?.avatar || assets.profile_img)
                      }
                      alt=""
                    />
                  )}
                  <div className="msg-time-receipt">
                    <p>{formatTime(msg.createdAt)}</p>
                    {renderReceipt(msg)}
                  </div>
                </div>
              </div>
            </React.Fragment>
          );
        })}

        {/* Typing indicator */}
        {typingUserIds.length > 0 && (
          <div className="typing-indicator">
            <div className="typing-dots">
              <span></span><span></span><span></span>
            </div>
            <span className="typing-text">
              {chatType === "room" ? "Someone is" : (chatUser?.name || chatUser?.username || "User") + " is"} typing…
            </span>
          </div>
        )}
      </div>

      {/* ─── Input Area ─── */}
      <div className="chat-input">
        <div className="input-actions-left" ref={emojiRef}>
          <button className="emoji-toggle" onClick={() => setShowEmojiPicker(!showEmojiPicker)} title="Emoji">
            😊
          </button>
          {showEmojiPicker && (
            <div className="emoji-picker-container">
              <EmojiPicker
                onEmojiClick={onEmojiClick}
                theme={document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark'}
                width={300}
                height={350}
                searchDisabled={false}
                skinTonesDisabled
                previewConfig={{ showPreview: false }}
              />
            </div>
          )}
        </div>

        <input
          type="text"
          placeholder='Send a message'
          value={input}
          onChange={handleInputChange}
          onKeyDown={handleKeyPress}
        />

        <input
          type="file"
          id="fileUpload"
          accept='image/*,.pdf,.doc,.docx,.txt,.zip,.xls,.xlsx,.ppt,.pptx'
          hidden
          onChange={sendFile}
        />
        <label htmlFor='fileUpload' title="Attach file">
          <img src={assets.gallery_icon} alt="" />
        </label>
        <img src={assets.send_button} alt="" onClick={sendMessage} className="send-btn" />
      </div>
    </div>
  );
};

export default ChatBox;
