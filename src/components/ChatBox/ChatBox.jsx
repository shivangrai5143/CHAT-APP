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
  getDocs,
  serverTimestamp,
  Timestamp,
  writeBatch,
  query,
  orderBy,
} from 'firebase/firestore';
import { db } from '../../config/firebase';
import { toast } from 'react-toastify';
import EmojiPicker from 'emoji-picker-react';

const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🔥'];

const WALLPAPERS = [
  { id: 'none', label: 'None', style: {} },
  { id: 'gradient1', label: 'Sunset', style: { background: 'linear-gradient(135deg, #667eea22, #764ba222)' } },
  { id: 'gradient2', label: 'Ocean', style: { background: 'linear-gradient(135deg, #0ea5e922, #06b6d422)' } },
  { id: 'gradient3', label: 'Forest', style: { background: 'linear-gradient(135deg, #10b98122, #06543422)' } },
  { id: 'gradient4', label: 'Rose', style: { background: 'linear-gradient(135deg, #f43f5e22, #ec489922)' } },
  { id: 'gradient5', label: 'Amber', style: { background: 'linear-gradient(135deg, #f59e0b22, #ea580c22)' } },
  { id: 'pattern', label: 'Dots', style: { backgroundImage: 'radial-gradient(circle, var(--accent-glow) 1px, transparent 1px)', backgroundSize: '20px 20px' } },
];

const ACCENT_OPTIONS = [
  { id: '', label: 'Default', color: '#6366f1' },
  { id: 'ocean', label: 'Ocean', color: '#0ea5e9' },
  { id: 'emerald', label: 'Emerald', color: '#10b981' },
  { id: 'rose', label: 'Rose', color: '#f43f5e' },
  { id: 'amber', label: 'Amber', color: '#f59e0b' },
];

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
    isBlocked,
    isBlockedBy,
  } = useContext(AppContext);

  const [input, setInput] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchDate, setSearchDate] = useState('');
  const [searchIndex, setSearchIndex] = useState(0);
  const [activeReactionMsg, setActiveReactionMsg] = useState(null);
  const [showWallpaperPicker, setShowWallpaperPicker] = useState(false);
  const [wallpaper, setWallpaper] = useState(() => {
    return localStorage.getItem('chatWallpaper') || 'none';
  });
  const [customWallpaperUrl, setCustomWallpaperUrl] = useState(() => {
    return localStorage.getItem('chatWallpaperCustomUrl') || '';
  });

  // Options menu state
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const [optionsSubMenu, setOptionsSubMenu] = useState(null); // 'theme' | 'wallpaper' | null
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const themes = ['dark', 'light', 'gradient', 'modern'];
  const [currentTheme, setCurrentTheme] = useState(() => {
    const saved = localStorage.getItem('theme');
    return themes.includes(saved) ? saved : 'dark';
  });
  const [accent, setAccent] = useState(() => {
    return localStorage.getItem('accent') || '';
  });

  const scrollRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const emojiRef = useRef(null);
  const wallpaperRef = useRef(null);
  const optionsRef = useRef(null);
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

  // Close wallpaper picker on outside click
  useEffect(() => {
    const handleClick = (e) => {
      if (wallpaperRef.current && !wallpaperRef.current.contains(e.target)) {
        setShowWallpaperPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Close options menu on outside click
  useEffect(() => {
    const handleClick = (e) => {
      if (optionsRef.current && !optionsRef.current.contains(e.target)) {
        setShowOptionsMenu(false);
        setOptionsSubMenu(null);
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
    if (chatType === "room") return;

    const parentCollection = "messages";
    const batch = writeBatch(db);
    let hasUpdates = false;

    messages.forEach((msg) => {
      if (msg.sId !== userData.uid) {
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

  // ─── Block check ───
  const blockedThem = chatType === "user" && chatUser ? isBlocked(chatUser.uid) : false;
  const blockedByThem = chatType === "user" && chatUser ? isBlockedBy(chatUser) : false;
  const chatDisabled = blockedThem || blockedByThem;

  // ─── Send message ───
  const sendMessage = async () => {
    try {
      if (!input.trim() || !messagesId || chatDisabled) return;

      const messageText = input.trim();
      setInput('');
      setShowEmojiPicker(false);

      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      setTyping(messagesId, false);

      const parentCollection = chatType === "room" ? "rooms" : "messages";

      const msgData = {
        sId: userData.uid,
        text: messageText,
        createdAt: serverTimestamp(),
        status: 'sent',
      };

      if (chatType === "room") {
        msgData.sName = userData.name || userData.username || 'User';
        msgData.sAvatar = userData.avatar || '';
        delete msgData.status;
      }

      await addDoc(collection(db, parentCollection, messagesId, "messages"), msgData);

      if (chatType === "user" && chatUser) {
        await updateChatData(messageText);
      }

      if (chatType === "room") {
        const roomRef = doc(db, "rooms", messagesId);
        await updateDoc(roomRef, { updatedAt: Date.now() });
      }

    } catch (error) {
      console.error("Error sending message:", error);
      toast.error("Failed to send message");
    }
  };

  // ─── Send file ───
  const sendFile = async (e) => {
    try {
      const file = e.target.files[0];
      if (!file || !messagesId || chatDisabled) return;

      const isImage = file.type.startsWith('image/');
      const formData = new FormData();
      formData.append("file", file);
      formData.append("upload_preset", "Chat_Images");

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
    if (diff < 70000) return null;
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

  // ─── Wallpaper ───
  const selectWallpaper = (id) => {
    setWallpaper(id);
    localStorage.setItem('chatWallpaper', id);
    if (id !== 'custom') {
      setCustomWallpaperUrl('');
      localStorage.removeItem('chatWallpaperCustomUrl');
    }
  };

  const handleCustomWallpaper = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const url = reader.result;
      setCustomWallpaperUrl(url);
      setWallpaper('custom');
      localStorage.setItem('chatWallpaper', 'custom');
      localStorage.setItem('chatWallpaperCustomUrl', url);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const getWallpaperStyle = () => {
    if (wallpaper === 'custom' && customWallpaperUrl) {
      return { backgroundImage: `url(${customWallpaperUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' };
    }
    const wp = WALLPAPERS.find((w) => w.id === wallpaper);
    return wp ? wp.style : {};
  };

  // ─── Theme helpers ───
  const toggleTheme = () => {
    const currentIndex = themes.indexOf(currentTheme);
    const newTheme = themes[(currentIndex + 1) % themes.length];
    setCurrentTheme(newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
  };

  const getThemeIcon = () => {
    switch (currentTheme) {
      case 'light': return '☀️ Light';
      case 'dark': return '🌙 Dark';
      case 'gradient': return '🌅 Gradient';
      case 'modern': return '🏙️ Modern';
      default: return '🌙 Dark';
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

  // ─── Clear Chat ───
  const clearChat = async () => {
    if (!messagesId) return;
    try {
      const parentCollection = chatType === "room" ? "rooms" : "messages";
      const msgRef = collection(db, parentCollection, messagesId, "messages");
      const q = query(msgRef, orderBy("createdAt", "asc"));
      const snapshot = await getDocs(q);

      const batch = writeBatch(db);
      snapshot.docs.forEach((d) => {
        batch.delete(d.ref);
      });
      await batch.commit();

      setShowClearConfirm(false);
      setShowOptionsMenu(false);
      setOptionsSubMenu(null);
      toast.success('Chat cleared successfully');
    } catch (error) {
      console.error('Error clearing chat:', error);
      toast.error('Failed to clear chat');
    }
  };

  // ─── Export & Backup ───
  const exportChatTxt = () => {
    if (!messages.length) return toast.info("No messages to export.");
    let txt = `Chat Export - ${headerName}\nDate: ${new Date().toLocaleString()}\n\n`;
    messages.forEach(msg => {
      const sender = msg.sId === userData.uid ? "You" : (msg.sName || chatUser?.name || "User");
      const time = formatTime(msg.createdAt);
      const text = msg.text || (msg.image ? "[Image]" : msg.fileName ? `[File: ${msg.fileName}]` : "");
      txt += `[${time}] ${sender}: ${text}\n`;
    });
    const blob = new Blob([txt], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Chat_Export_${headerName.replace(/\s+/g, '_')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    setShowOptionsMenu(false);
  };

  const backupChatJson = () => {
    if (!messages.length) return toast.info("No messages to backup.");
    const data = {
      chatName: headerName,
      chatType,
      exportedAt: new Date().toISOString(),
      messages: messages.map(msg => ({...msg, createdAt: msg.createdAt ? getMessageDate(msg).toISOString() : null}))
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Chat_Backup_${headerName.replace(/\s+/g, '_')}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setShowOptionsMenu(false);
  };

  // ─── Search logic (text + date) ───
  const getMessageDate = (msg) => {
    if (!msg.createdAt) return null;
    const date = msg.createdAt instanceof Timestamp
      ? msg.createdAt.toDate()
      : new Date(msg.createdAt);
    return date;
  };

  const searchResults = (showSearch && (searchQuery || searchDate))
    ? messages
      .map((msg, idx) => ({ msg, idx }))
      .filter(({ msg }) => {
        let matchText = true;
        let matchDate = true;

        if (searchQuery) {
          matchText = msg.text && msg.text.toLowerCase().includes(searchQuery.toLowerCase());
        }

        if (searchDate) {
          const msgDate = getMessageDate(msg);
          if (msgDate) {
            const selectedDate = new Date(searchDate);
            matchDate = msgDate.getFullYear() === selectedDate.getFullYear()
              && msgDate.getMonth() === selectedDate.getMonth()
              && msgDate.getDate() === selectedDate.getDate();
          } else {
            matchDate = false;
          }
        }

        return matchText && matchDate;
      })
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
    if (status === 'read') return <span className="msg-receipt read" title="Read">✓✓</span>;
    if (status === 'delivered') return <span className="msg-receipt delivered" title="Delivered">✓✓</span>;
    return <span className="msg-receipt sent" title="Sent">✓</span>;
  };

  const getDateKey = (msg) => {
    if (!msg.createdAt) return '';
    const date = msg.createdAt instanceof Timestamp
      ? msg.createdAt.toDate()
      : new Date(msg.createdAt);
    return date.toDateString();
  };

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
          <div className="avatar-wrapper">
            <img src={headerAvatar} alt="" />
            {chatType === "user" && isOnline(chatUser?.lastSeen) && (
              <span className="online-dot"></span>
            )}
          </div>
        )}
        <div className="chat-user-info">
          <p>
            {headerName}
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
          <div className="options-menu-wrapper" ref={optionsRef}>
            <button
              className={`header-action-btn options-btn ${showOptionsMenu ? 'active' : ''}`}
              onClick={() => { setShowOptionsMenu(!showOptionsMenu); setOptionsSubMenu(null); }}
              title="Options"
            >⋮</button>
            {showOptionsMenu && (
              <div className="options-dropdown">
                {/* ─── Change Theme ─── */}
                <button
                  className={`options-item ${optionsSubMenu === 'theme' ? 'expanded' : ''}`}
                  onClick={() => setOptionsSubMenu(optionsSubMenu === 'theme' ? null : 'theme')}
                >
                  <span className="options-icon">🎨</span>
                  <span>Change Theme</span>
                  <span className="options-chevron">{optionsSubMenu === 'theme' ? '▾' : '▸'}</span>
                </button>
                {optionsSubMenu === 'theme' && (
                  <div className="options-submenu theme-panel">
                    <div className="theme-toggle-row">
                      <span>{getThemeIcon()}</span>
                      <button className="theme-switch" onClick={toggleTheme} style={{background: 'var(--accent)', color: '#fff', padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold'}}>
                        Switch
                      </button>
                    </div>
                    <div className="accent-row">
                      {ACCENT_OPTIONS.map((opt) => (
                        <button
                          key={opt.id}
                          className={`accent-dot ${accent === opt.id ? 'active' : ''}`}
                          style={{ background: opt.color }}
                          onClick={() => setAccentColor(opt.id)}
                          title={opt.label}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* ─── Change Wallpaper ─── */}
                <button
                  className={`options-item ${optionsSubMenu === 'wallpaper' ? 'expanded' : ''}`}
                  onClick={() => setOptionsSubMenu(optionsSubMenu === 'wallpaper' ? null : 'wallpaper')}
                >
                  <span className="options-icon">🖼️</span>
                  <span>Change Wallpaper</span>
                  <span className="options-chevron">{optionsSubMenu === 'wallpaper' ? '▾' : '▸'}</span>
                </button>
                {optionsSubMenu === 'wallpaper' && (
                  <div className="options-submenu">
                    <div className="wallpaper-grid">
                      {WALLPAPERS.map((wp) => (
                        <button
                          key={wp.id}
                          className={`wallpaper-tile ${wallpaper === wp.id ? 'active' : ''}`}
                          onClick={() => selectWallpaper(wp.id)}
                          style={wp.style}
                          title={wp.label}
                        >
                          {wp.id === 'none' && '✕'}
                        </button>
                      ))}
                      <label className={`wallpaper-tile custom-upload ${wallpaper === 'custom' ? 'active' : ''}`} title="Upload image">
                        📷
                        <input type="file" accept="image/*" hidden onChange={handleCustomWallpaper} />
                      </label>
                    </div>
                  </div>
                )}

                {/* ─── Search by Date ─── */}
                <button
                  className="options-item"
                  onClick={() => {
                    setShowOptionsMenu(false);
                    setOptionsSubMenu(null);
                    setShowSearch(true);
                    setSearchQuery('');
                    setSearchDate('');
                    setSearchIndex(0);
                  }}
                >
                  <span className="options-icon">📅</span>
                  <span>Search by Date</span>
                </button>

                {/* ─── Export & Backup ─── */}
                <button className="options-item" onClick={exportChatTxt}>
                  <span className="options-icon">📄</span>
                  <span>Export Chat (TXT)</span>
                </button>
                <button className="options-item" onClick={backupChatJson}>
                  <span className="options-icon">💾</span>
                  <span>Backup Chat (JSON)</span>
                </button>

                {/* ─── Clear Chat ─── */}
                <button
                  className="options-item options-item-danger"
                  onClick={() => {
                    setShowOptionsMenu(false);
                    setOptionsSubMenu(null);
                    setShowClearConfirm(true);
                  }}
                >
                  <span className="options-icon">🗑️</span>
                  <span>Clear Chat</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─── Search Bar ─── */}
      {showSearch && (
        <div className="chat-search-bar">
          <input
            type="text"
            placeholder="Search messages..."
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setSearchIndex(0); }}
            autoFocus
          />
          <input
            type="date"
            className="search-date-input"
            value={searchDate}
            onChange={(e) => { setSearchDate(e.target.value); setSearchIndex(0); }}
            title="Filter by date"
          />
          {searchDate && (
            <button className="date-clear" onClick={() => setSearchDate('')} title="Clear date">✕</button>
          )}
          {(searchQuery || searchDate) && (
            <div className="search-nav">
              <span className="search-count">
                {searchResults.length > 0 ? `${searchIndex + 1}/${searchResults.length}` : '0 results'}
              </span>
              <button onClick={() => navigateSearch(-1)} disabled={searchIndex <= 0}>▲</button>
              <button onClick={() => navigateSearch(1)} disabled={searchIndex >= searchResults.length - 1}>▼</button>
            </div>
          )}
          <button className="search-close" onClick={() => { setShowSearch(false); setSearchQuery(''); setSearchDate(''); }}>✕</button>
        </div>
      )}

      {/* ─── Messages ─── */}
      <div className="chat-msg" ref={scrollRef} style={getWallpaperStyle()}>
        {messages.map((msg, index) => {
          const isSelf = msg.sId === userData.uid;
          const prevMsg = index > 0 ? messages[index - 1] : null;
          const showDateSep = !prevMsg || getDateKey(msg) !== getDateKey(prevMsg);
          const isGrouped = prevMsg && prevMsg.sId === msg.sId && !showDateSep;
          const isSearchMatch = showSearch && (searchQuery || searchDate) && searchResults.some(r => r.msg.id === msg.id);
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
                      <a href={msg.fileUrl} target="_blank" rel="noopener noreferrer" className="file-download" title="Download">⬇️</a>
                    </div>
                  ) : (
                    <p className="msg">
                      {showSearch && searchQuery ? highlightText(msg.text, searchQuery) : msg.text}
                    </p>
                  )}

                  {activeReactionMsg === msg.id && (
                    <div className="reaction-picker" onMouseDown={(e) => e.stopPropagation()}>
                      {QUICK_REACTIONS.map((emoji) => (
                        <button key={emoji} onClick={() => addReaction(msg.id, emoji)}>{emoji}</button>
                      ))}
                    </div>
                  )}

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

      {/* ─── Blocked Banner ─── */}
      {/* ─── Clear Chat Confirmation ─── */}
      {showClearConfirm && (
        <div className="clear-confirm-overlay">
          <div className="clear-confirm-dialog">
            <span className="clear-confirm-icon">🗑️</span>
            <h4>Clear Chat</h4>
            <p>Are you sure you want to delete all messages? This cannot be undone.</p>
            <div className="clear-confirm-actions">
              <button className="clear-cancel-btn" onClick={() => setShowClearConfirm(false)}>Cancel</button>
              <button className="clear-confirm-btn" onClick={clearChat}>Clear All</button>
            </div>
          </div>
        </div>
      )}

      {chatDisabled && chatType === "user" && (
        <div className="blocked-banner">
          {blockedThem
            ? "🚫 You blocked this user. Unblock from the sidebar to chat."
            : "🚫 You can't send messages to this user."
          }
        </div>
      )}

      {/* ─── Input Area ─── */}
      {!chatDisabled && (
        <div className="chat-input">
          <div className="input-actions-left" ref={emojiRef}>
            <button className="emoji-toggle" onClick={() => setShowEmojiPicker(!showEmojiPicker)} title="Emoji">😊</button>
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
      )}
    </div>
  );
};

export default ChatBox;
