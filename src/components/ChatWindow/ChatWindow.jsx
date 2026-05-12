import React, { useContext, useState, useEffect, useRef, useCallback } from 'react';
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
import { encryptMessage, decryptMessage, importPublicKey } from '../../services/cryptoService';
import { getSmartReplies, summarizeChat, translateText, SUPPORTED_LANGS, transcribeVoiceNote, semanticSearch, getConversationInsights } from '../../services/aiService';
import { useVoiceRecorder } from '../../hooks/useVoiceRecorder';
import VoiceNotePlayer from './VoiceNotePlayer';

const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🔥'];

const ChatWindow = () => {
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
    userPrivateKey,
    startCall,              // WebRTC
    callState,              // WebRTC
    wallpaperStyle,         // Theme
    blur,                   // Theme
    opacity,                // Theme
    getUserPresenceStatus,  // Presence
  } = useContext(AppContext);

  const [input, setInput] = useState('');
  const [decryptedTexts, setDecryptedTexts] = useState({});
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchDate, setSearchDate] = useState('');
  const [searchIndex, setSearchIndex] = useState(0);
  const [activeReactionMsg, setActiveReactionMsg] = useState(null);
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  // ── New features ──
  const [replyingTo, setReplyingTo] = useState(null); // { id, displayText, senderName }
  const [disappearTimer, setDisappearTimer] = useState(0); // seconds; 0 = off
  const [smartReplies, setSmartReplies] = useState([]);
  const [chatSummary, setChatSummary] = useState('');
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [translatedMsgs, setTranslatedMsgs] = useState({});
  const [showDisappearPicker, setShowDisappearPicker] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [searchMode, setSearchMode] = useState('text'); // 'text' | 'ai'
  const [aiSearchLoading, setAiSearchLoading] = useState(false);
  const [aiSearchMatchIds, setAiSearchMatchIds] = useState(null); // null = not run
  const [showInsightsModal, setShowInsightsModal] = useState(false);
  const [insights, setInsights] = useState('');
  const [isInsightsLoading, setIsInsightsLoading] = useState(false);
  const [translatePickerMsg,  setTranslatePickerMsg]  = useState(null); // msgId with open lang picker

  // Voice recorder
  const { isRecording, audioBlob, audioUrl, duration, startRecording, stopRecording, cancelRecording, clearRecording } = useVoiceRecorder();

  const scrollRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const emojiRef = useRef(null);
  const optionsRef = useRef(null);
  const msgRefs = useRef({});
  const decryptionCacheRef = useRef({});

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (scrollRef.current && !showSearch) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, showSearch]);

  // Decrypt incoming encrypted messages
  useEffect(() => {
    if (!userPrivateKey || chatType !== 'user') return;
    const encrypted = messages.filter(
      (m) => m.encryptedMessage && !decryptionCacheRef.current[m.id]
    );
    if (!encrypted.length) return;

    (async () => {
      const updates = {};
      await Promise.all(
        encrypted.map(async (msg) => {
          try {
            const isSender = msg.sId === userData?.uid;
            // Multi-device: prefer the key encrypted for this specific device
            const encAESKey    = msg.deviceKeys?.[myDeviceId] ?? msg.encryptedAESKey;
            const senderEncKey = msg.deviceKeys?.[myDeviceId] ?? msg.senderEncryptedAESKey;
            const plain = await decryptMessage(
              { encryptedMessage: msg.encryptedMessage, encryptedAESKey: encAESKey, senderEncryptedAESKey: senderEncKey, iv: msg.iv },
              userPrivateKey,
              isSender
            );
            updates[msg.id] = plain;
          } catch {
            updates[msg.id] = '🔒 [Encrypted message]';
          }
        })
      );
      decryptionCacheRef.current = { ...decryptionCacheRef.current, ...updates };
      setDecryptedTexts((prev) => ({ ...prev, ...updates }));
    })();
  }, [messages, userPrivateKey, chatType]);

  // Smart replies — fire when last message is from the other person
  useEffect(() => {
    if (chatType !== 'user' || !messages.length || !import.meta.env.VITE_GEMINI_API_KEY) return;
    const last = messages[messages.length - 1];
    if (last?.sId === userData?.uid) { setSmartReplies([]); return; }
    const history = messages.slice(-6).map((m) => ({
      sender: m.sId === userData?.uid ? 'me' : 'them',
      text: m.text || decryptedTexts[m.id] || '',
    })).filter((m) => m.text);
    if (!history.length) return;
    getSmartReplies(history).then((r) => { if (r?.length) setSmartReplies(r); }).catch(() => {});
  }, [messages]); // eslint-disable-line

  // Click outside handlers
  useEffect(() => {
    const handleClick = (e) => {
      if (emojiRef.current && !emojiRef.current.contains(e.target)) setShowEmojiPicker(false);
      if (optionsRef.current && !optionsRef.current.contains(e.target)) setShowOptionsMenu(false);
      if (activeReactionMsg && !e.target.closest('.reaction-picker')) setActiveReactionMsg(null);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [activeReactionMsg]);

  // Mark messages as delivered/read
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

  // Typing handlers
  const handleTyping = useCallback(() => {
    if (!messagesId) return;
    setTyping(messagesId, true);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => setTyping(messagesId, false), 2000);
  }, [messagesId, setTyping]);

  const handleInputChange = (e) => {
    setInput(e.target.value);
    handleTyping();
  };

  // Block check
  const blockedThem = chatType === "user" && chatUser ? isBlocked(chatUser.uid) : false;
  const blockedByThem = chatType === "user" && chatUser ? isBlockedBy(chatUser) : false;
  const chatDisabled = blockedThem || blockedByThem;

  // Send message
  const sendMessage = async () => {
    try {
      if (!input.trim() || !messagesId || chatDisabled) return;

      const messageText = input.trim();
      setInput('');
      setShowEmojiPicker(false);
      setReplyingTo(null);
      setSmartReplies([]);

      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      setTyping(messagesId, false);

      const parentCollection = chatType === "room" ? "rooms" : "messages";

      let msgData = {
        sId: userData.uid,
        createdAt: serverTimestamp(),
        status: 'sent',
        ...(replyingTo ? { replyTo: { id: replyingTo.id, text: replyingTo.displayText, senderName: replyingTo.senderName } } : {}),
        ...(disappearTimer > 0 ? { expiresAt: Date.now() + disappearTimer * 1000 } : {}),
      };

      if (chatType === "user" && chatUser && userPrivateKey) {
        try {
          // Multi-device: encrypt AES key for every registered device on both sides
          const recipientSnap = await getDoc(doc(db, "users", chatUser.uid));
          const recipientData = recipientSnap.data() || {};
          const recipientKeys = recipientData.publicKeys ||
            (recipientData.publicKey ? { [chatUser.uid]: recipientData.publicKey } : {});

          const senderSnap = await getDoc(doc(db, "users", userData.uid));
          const senderData = senderSnap.data() || {};
          const senderKeys = senderData.publicKeys ||
            (senderData.publicKey ? { [myDeviceId]: senderData.publicKey } : {});

          const allKeys = { ...recipientKeys, ...senderKeys };

          if (Object.keys(allKeys).length === 0) {
            msgData.text = messageText;
          } else {
            const { encryptedMessage, iv, deviceKeys } = await encryptMessageMultiDevice(messageText, allKeys);
            msgData.e2ee             = true;
            msgData.encryptedMessage = encryptedMessage;
            msgData.iv               = iv;
            msgData.deviceKeys       = deviceKeys;
            // Legacy compat fields so old clients can still decrypt
            const recipientFirstKey = Object.keys(recipientKeys)[0];
            msgData.encryptedAESKey       = deviceKeys[recipientFirstKey] ?? Object.values(deviceKeys)[0] ?? null;
            msgData.senderEncryptedAESKey = deviceKeys[myDeviceId] ?? Object.values(deviceKeys)[0] ?? null;
          }
        } catch (cryptoErr) {
          console.error('Encryption error — falling back to plaintext:', cryptoErr);
          msgData.text = messageText;
        }
      } else {
        msgData.text = messageText;
      }

      if (chatType === "room") {
        msgData.sName = userData.name || userData.username || 'User';
        msgData.sAvatar = userData.avatar || '';
        delete msgData.status;
      }

      const docRef = await addDoc(collection(db, parentCollection, messagesId, "messages"), msgData);

      if (msgData.e2ee) {
        decryptionCacheRef.current[docRef.id] = messageText;
        setDecryptedTexts((prev) => ({ ...prev, [docRef.id]: messageText }));
      }

      if (chatType === "user" && chatUser) {
        await updateChatData(msgData.text || '🔒 Encrypted message');
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

  // Send file
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

  // Send voice note (with optional transcription)
  const sendVoiceNote = async () => {
    if (!audioBlob || !messagesId) return;
    try {
      setIsTranscribing(true);
      // Attempt transcription before uploading
      let transcript = null;
      if (import.meta.env.VITE_GEMINI_API_KEY) {
        transcript = await transcribeVoiceNote(audioBlob).catch(() => null);
      }
      setIsTranscribing(false);

      const fd = new FormData();
      fd.append('file', audioBlob, 'voice.webm');
      fd.append('upload_preset', 'Chat_Images');
      const res = await fetch('https://api.cloudinary.com/v1_1/du3hiflqj/auto/upload', { method: 'POST', body: fd });
      const data = await res.json();
      if (!data.secure_url) throw new Error('Upload failed');
      const parentCollection = chatType === 'room' ? 'rooms' : 'messages';
      const msgData = {
        sId: userData.uid,
        createdAt: serverTimestamp(),
        status: 'sent',
        voiceUrl: data.secure_url,
        voiceDuration: duration,
        ...(transcript ? { voiceTranscription: transcript } : {}),
        ...(chatType === 'room' ? { sName: userData.name || 'User', sAvatar: userData.avatar || '' } : {}),
      };
      await addDoc(collection(db, parentCollection, messagesId, 'messages'), msgData);
      if (chatType === 'user' && chatUser) await updateChatData('🎤 Voice message');
      clearRecording();
    } catch (err) {
      setIsTranscribing(false);
      console.error('Voice send error:', err);
      toast.error('Failed to send voice note');
    }
  };

  // Summarize chat
  const handleSummarize = async () => {
    setIsSummarizing(true);
    setShowSummaryModal(true);
    const msgs = messages.map((m) => ({ senderName: m.sName || (m.sId === userData?.uid ? 'Me' : chatUser?.name || 'Them'), text: m.text || decryptedTexts[m.id] || '' }));
    const summary = await summarizeChat(msgs).catch(() => 'Could not generate summary.');
    setChatSummary(summary || 'No content to summarize.');
    setIsSummarizing(false);
  };

  // AI Insights
  const handleInsights = async () => {
    setIsInsightsLoading(true);
    setShowInsightsModal(true);
    const msgs = messages.map((m) => ({ senderName: m.sName || (m.sId === userData?.uid ? 'Me' : chatUser?.name || 'Them'), text: m.text || decryptedTexts[m.id] || '' }));
    const result = await getConversationInsights(msgs).catch(() => 'Could not generate insights.');
    setInsights(result || 'No insights available.');
    setIsInsightsLoading(false);
  };

  // AI Semantic Search
  const handleAiSearch = async () => {
    if (!searchQuery.trim()) return;
    setAiSearchLoading(true);
    setAiSearchMatchIds(null);
    const msgs = messages.map((m) => ({
      id: m.id,
      text: m.text || decryptedTexts[m.id] || '',
      senderName: m.sName || (m.sId === userData?.uid ? 'Me' : chatUser?.name || 'Them'),
    }));
    const ids = await semanticSearch(searchQuery, msgs).catch(() => []);
    setAiSearchMatchIds(ids);
    setAiSearchLoading(false);
  };

  // Translate a message
  const handleTranslate = async (msgId, text, lang) => {
    if (!text) return;
    const translated = await translateText(text, lang).catch(() => null);
    if (translated) setTranslatedMsgs((prev) => ({ ...prev, [msgId]: translated }));
  };

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
        if (updated.length === 0) delete reactions[emoji];
        else reactions[emoji] = updated;
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
      // Update sender's own chat list (we always have permission for our own doc)
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

      // Update recipient's chat list — wrap separately since Firestore rules
      // only allow users to write their own /chats/{uid} document.
      // This write only succeeds if the recipient is also authenticated and
      // rules permit (e.g. if you relax them to allow writing via Cloud Functions).
      // For now we attempt it and silently skip on permission error.
      try {
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
      } catch (permErr) {
        // Expected: we can't write to another user's /chats doc.
        // The recipient's chat list will update when they receive the message.
        console.log('Could not update recipient chat list (permission expected):', permErr.code);
      }
    } catch (error) {
      console.error("Error updating chat data:", error);
    }
  };

  // Utilities
  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = timestamp instanceof Timestamp ? timestamp.toDate() : new Date(timestamp);
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
    const date = timestamp instanceof Timestamp ? timestamp.toDate() : new Date(timestamp);
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
  const isAway = (user) => getUserPresenceStatus && user ? getUserPresenceStatus(user) === 'away' : false;

  const onEmojiClick = (emojiData) => setInput((prev) => prev + emojiData.emoji);

  const clearChat = async () => {
    if (!messagesId) return;
    try {
      const parentCollection = chatType === "room" ? "rooms" : "messages";
      const msgRef = collection(db, parentCollection, messagesId, "messages");
      const q = query(msgRef, orderBy("createdAt", "asc"));
      const snapshot = await getDocs(q);

      const batch = writeBatch(db);
      snapshot.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();

      setShowClearConfirm(false);
      setShowOptionsMenu(false);
      toast.success('Chat cleared successfully');
    } catch (error) {
      console.error('Error clearing chat:', error);
      toast.error('Failed to clear chat');
    }
  };

  // Search logic
  const getMessageDate = (msg) => {
    if (!msg.createdAt) return null;
    return msg.createdAt instanceof Timestamp ? msg.createdAt.toDate() : new Date(msg.createdAt);
  };

  // Computed search results — supports both text and AI mode
  const effectiveAiMatchIds = aiSearchMatchIds; // may be null (not searched) or []
  const searchResults = (showSearch && (searchQuery || searchDate))
    ? messages.map((msg, idx) => ({ msg, idx })).filter(({ msg }) => {
        if (searchMode === 'ai' && effectiveAiMatchIds !== null) {
          return effectiveAiMatchIds.includes(msg.id);
        }
        let matchText = true;
        let matchDate = true;
        if (searchQuery) {
          const plain = msg.text || decryptedTexts[msg.id] || '';
          matchText = plain.toLowerCase().includes(searchQuery.toLowerCase());
        }
        if (searchDate) {
          const msgDate = getMessageDate(msg);
          if (msgDate) {
            const [year, month, day] = searchDate.split('-').map(Number);
            matchDate = msgDate.getFullYear() === year
              && msgDate.getMonth() === month - 1
              && msgDate.getDate() === day;
          } else matchDate = false;
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
        ? <mark key={i} className="bg-yellow-500/30 text-yellow-300 rounded px-1">{part}</mark>
        : part
    );
  };

  const renderReceipt = (msg) => {
    if (chatType === "room" || msg.sId !== userData.uid) return null;
    const status = msg.status || 'sent';
    if (status === 'read') return <span className="text-blue-400 text-xs tracking-tighter" title="Read">✓✓</span>;
    if (status === 'delivered') return <span className="text-slate-400 text-xs tracking-tighter" title="Delivered">✓✓</span>;
    return <span className="text-slate-400 text-xs" title="Sent">✓</span>;
  };

  const getDateKey = (msg) => {
    if (!msg.createdAt) return '';
    const date = msg.createdAt instanceof Timestamp ? msg.createdAt.toDate() : new Date(msg.createdAt);
    return date.toDateString();
  };

  const typingUserIds = getTypingUsers(messagesId);

  // Welcome state
  if (!chatUser && chatType !== "room") {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-slate-900 border-x border-slate-700/50">
        <img src={assets.logo_icon} alt="Logo" className="w-20 mb-6 opacity-80 mix-blend-screen" />
        <p className="text-slate-400 text-lg font-medium">Select a chat or search for a user to start messaging</p>
      </div>
    );
  }

  const headerName = chatType === "room" ? roomData?.name || 'Room' : (chatUser?.name || chatUser?.username || 'User');
  const headerAvatar = chatType === "room" ? null : (chatUser?.avatar || assets.profile_img);
  const lastSeenText = chatType === "user" ? formatLastSeen(chatUser?.lastSeen) : null;

  return (
    <div className="flex-1 flex flex-col bg-slate-900 border-x border-slate-700/50 relative">
      {/* Header */}
      <div className="relative z-20 h-[72px] flex items-center justify-between px-6 bg-slate-800/80 backdrop-blur-md border-b border-slate-700/50">
        <div className="flex items-center gap-4">
          {chatType === "room" ? (
            <div className="w-11 h-11 bg-indigo-900/50 text-indigo-300 rounded-full flex items-center justify-center text-xl shadow-inner">👥</div>
          ) : (
            <div className="relative">
              <img src={headerAvatar} alt="Avatar" className="w-11 h-11 rounded-full object-cover shadow-sm" />
              {isOnline(chatUser?.lastSeen) && <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-slate-800 rounded-full"></span>}
            </div>
          )}
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-slate-100 text-lg">{headerName}</h3>
              {chatType === "room" && <span className="text-xs bg-indigo-600/20 text-indigo-300 px-2 py-0.5 rounded-full">{roomData?.members?.length || 0} members</span>}
            </div>
          {chatType === "user" && (
              <p className={`text-sm font-medium ${
                isOnline(chatUser?.lastSeen) ? 'text-green-400'
                : isAway(chatUser) ? 'text-yellow-400'
                : 'text-slate-400'
              }`}>
                {isOnline(chatUser?.lastSeen)
                  ? (isAway(chatUser) ? '🌙 Away' : '🟢 Online')
                  : lastSeenText}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Call buttons — only for 1-on-1 chats */}
          {chatType === "user" && chatUser && (
            <>
              {/* Voice call */}
              <button
                id="voice-call-btn"
                className="p-2 rounded-full hover:bg-slate-700 text-slate-300 transition-colors disabled:opacity-40"
                title="Voice call"
                disabled={callState !== 'idle'}
                onClick={() => startCall(chatUser.uid, 'audio')}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                    d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
              </button>
              {/* Video call */}
              <button
                id="video-call-btn"
                className="p-2 rounded-full hover:bg-slate-700 text-slate-300 transition-colors disabled:opacity-40"
                title="Video call"
                disabled={callState !== 'idle'}
                onClick={() => startCall(chatUser.uid, 'video')}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                    d="M15 10l4.553-2.276A1 1 0 0121 8.723v6.554a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
                </svg>
              </button>
            </>
          )}
          <div className="relative" ref={optionsRef}>
            <button
              className="p-2 rounded-full hover:bg-slate-700 text-slate-300 transition-colors"
              onClick={() => setShowOptionsMenu(!showOptionsMenu)}
              title="Options"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"></path></svg>
            </button>
            {showOptionsMenu && (
              <div className="absolute right-0 top-12 w-56 bg-slate-800 border border-slate-700 rounded-xl shadow-xl py-2 z-50">
                <button className="w-full text-left px-4 py-2 hover:bg-slate-700 text-slate-200 transition-colors flex items-center gap-3" onClick={() => { setShowOptionsMenu(false); setShowSearch(true); }}>
                  <span>🔍</span> Search Messages
                </button>
                {chatType === 'user' && (
                  <button className="w-full text-left px-4 py-2 hover:bg-slate-700 text-slate-200 transition-colors flex items-center gap-3" onClick={() => { setShowOptionsMenu(false); handleSummarize(); }}>
                    <span>🤖</span> AI Summary
                  </button>
                )}
                {chatType === 'user' && (
                  <button className="w-full text-left px-4 py-2 hover:bg-slate-700 text-slate-200 transition-colors flex items-center gap-3" onClick={() => { setShowOptionsMenu(false); handleInsights(); }}>
                    <span>💡</span> AI Insights
                  </button>
                )}
                <button className="w-full text-left px-4 py-2 hover:bg-slate-700 text-slate-200 transition-colors flex items-center gap-3" onClick={() => { setShowDisappearPicker((v) => !v); }}>
                  <span>⏱</span> {disappearTimer > 0 ? `Disappear: ${disappearTimer}s` : 'Disappearing Msgs'}
                </button>
                {showDisappearPicker && (
                  <div className="px-4 py-2 flex flex-wrap gap-1">
                    {[0,30,60,300,3600].map((v) => (
                      <button key={v} onClick={() => { setDisappearTimer(v); setShowDisappearPicker(false); setShowOptionsMenu(false); }}
                        className={`text-xs px-2 py-1 rounded-full border transition-colors ${disappearTimer === v ? 'bg-indigo-600 border-indigo-500 text-white' : 'border-slate-600 text-slate-300 hover:bg-slate-700'}`}>
                        {v === 0 ? 'Off' : v < 60 ? `${v}s` : v < 3600 ? `${v/60}m` : '1h'}
                      </button>
                    ))}
                  </div>
                )}
                <div className="border-t border-slate-700/50 my-1" />
                <button className="w-full text-left px-4 py-2 hover:bg-slate-700 text-red-400 transition-colors flex items-center gap-3" onClick={() => { setShowOptionsMenu(false); setShowClearConfirm(true); }}>
                  <span>🗑️</span> Clear Chat
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Search Bar */}
      {showSearch && (
        <div className="relative z-20 bg-slate-800 border-b border-slate-700/50 p-3 flex flex-wrap items-center gap-3 shadow-inner">
          {/* Mode Toggle */}
          <div className="flex bg-slate-900 rounded-lg p-0.5 gap-0.5 flex-shrink-0">
            <button
              onClick={() => { setSearchMode('text'); setAiSearchMatchIds(null); }}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${searchMode === 'text' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
            >🔤 Text</button>
            <button
              onClick={() => setSearchMode('ai')}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${searchMode === 'ai' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
            >🧠 AI</button>
          </div>
          <input
            type="text"
            placeholder={searchMode === 'ai' ? 'Ask anything... e.g. "deployment issues"' : 'Search messages...'}
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setSearchIndex(0); if (searchMode === 'text') setAiSearchMatchIds(null); }}
            onKeyDown={(e) => searchMode === 'ai' && e.key === 'Enter' && handleAiSearch()}
            className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-indigo-500"
            autoFocus
          />
          {searchMode === 'text' && (
            <input
              type="date"
              value={searchDate}
              onChange={(e) => { setSearchDate(e.target.value); setSearchIndex(0); }}
              className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-indigo-500"
            />
          )}
          {searchMode === 'ai' && (
            <button
              onClick={handleAiSearch}
              disabled={aiSearchLoading || !searchQuery.trim()}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs rounded-lg font-medium transition-colors flex items-center gap-1.5"
            >
              {aiSearchLoading ? <span className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" /> : '🔍'}
              {aiSearchLoading ? 'Searching…' : 'Search'}
            </button>
          )}
          {(searchQuery || searchDate) && (
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <span className="bg-slate-900 px-2 py-1 rounded">
                {searchResults.length > 0 ? `${searchIndex + 1}/${searchResults.length}` : '0 results'}
              </span>
              <div className="flex gap-1">
                <button className="p-1.5 bg-slate-700 hover:bg-slate-600 rounded disabled:opacity-50" onClick={() => navigateSearch(-1)} disabled={searchIndex <= 0}>▲</button>
                <button className="p-1.5 bg-slate-700 hover:bg-slate-600 rounded disabled:opacity-50" onClick={() => navigateSearch(1)} disabled={searchIndex >= searchResults.length - 1}>▼</button>
              </div>
            </div>
          )}
          <button className="p-1.5 text-slate-400 hover:text-white" onClick={() => { setShowSearch(false); setSearchQuery(''); setSearchDate(''); setAiSearchMatchIds(null); }}>✕</button>
        </div>
      )}

      {/* Messages Area — wallpaper bg layer (blurred/transparent) + scrollable content layer */}
      <div className="flex-1 overflow-hidden relative">
        {/* Wallpaper background layer */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            ...wallpaperStyle,
            opacity:  opacity  ?? 1,
            filter:   (blur ?? 0) > 0 ? `blur(${blur}px)` : undefined,
          }}
        />
        {/* Scrollable content above wallpaper */}
        <div className="relative z-10 h-full overflow-y-auto p-4 custom-scrollbar">
        {messages.filter((m) => !m.expiresAt || m.expiresAt > Date.now()).map((msg, index) => {
          const isSelf = msg.sId === userData.uid;
          const prevMsg = index > 0 ? messages[index - 1] : null;
          const showDateSep = !prevMsg || getDateKey(msg) !== getDateKey(prevMsg);
          const isGrouped = prevMsg && prevMsg.sId === msg.sId && !showDateSep;
          const isSearchMatch = showSearch && (searchQuery || searchDate) && searchResults.some(r => r.msg.id === msg.id);
          const isCurrentResult = searchResults[searchIndex]?.msg.id === msg.id;

          // Toxic Message Check placeholder (assuming msg.isToxic property might exist in future)
          const isToxic = msg.isToxic === true;

          return (
            <React.Fragment key={msg.id}>
              {showDateSep && msg.createdAt && (
                <div className="flex justify-center my-6">
                  <span className="bg-slate-800/80 text-slate-400 text-xs font-medium px-4 py-1.5 rounded-full border border-slate-700/50 shadow-sm backdrop-blur-sm">
                    {formatDate(msg.createdAt)}
                  </span>
                </div>
              )}
              
              <div
                ref={(el) => { msgRefs.current[msg.id] = el; }}
                className={`flex ${isSelf ? 'justify-end' : 'justify-start'} ${isGrouped ? 'mt-1' : 'mt-4'} ${isSearchMatch ? 'opacity-100' : showSearch ? 'opacity-30' : ''} ${isCurrentResult ? 'ring-2 ring-yellow-500/50 rounded-2xl' : ''}`}
              >
                <div className={`flex flex-col max-w-[75%] ${isSelf ? 'items-end' : 'items-start'}`}>
                  
                  {/* Sender Name in Group Chat */}
                  {chatType === "room" && !isSelf && !isGrouped && (
                    <span className="text-xs text-slate-400 mb-1 ml-1">{msg.sName || 'User'}</span>
                  )}

                  {/* Reply Quote */}
                  {msg.replyTo && (
                    <div className={`text-xs px-3 py-1.5 mb-1 rounded-lg border-l-2 border-indigo-400 max-w-[90%] ${isSelf ? 'bg-indigo-900/40' : 'bg-slate-700/60'}`}>
                      <p className="font-medium text-indigo-300 truncate">{msg.replyTo.senderName}</p>
                      <p className="text-slate-400 truncate">{msg.replyTo.text || '🎤 Voice note'}</p>
                    </div>
                  )}
                  {/* Message Content */}
                  <div 
                    className="relative group"
                    onMouseEnter={() => setActiveReactionMsg(msg.id)}
                    onMouseLeave={() => setActiveReactionMsg(null)}
                  >
                    {msg.voiceUrl ? (
                      <div className={`px-3 py-2 rounded-2xl shadow-md ${isSelf ? 'bg-indigo-600' : 'bg-slate-800 border border-slate-700/50'}`}>
                        <VoiceNotePlayer url={msg.voiceUrl} duration={msg.voiceDuration || 0} isSelf={isSelf} />
                        {msg.voiceTranscription && <p className="text-xs mt-1.5 opacity-70 italic">{msg.voiceTranscription}</p>}
                      </div>
                    ) : msg.image ? (
                      <img src={msg.image} className="max-w-[240px] rounded-2xl cursor-pointer shadow-md hover:opacity-90 transition-opacity" alt="attachment" onClick={() => window.open(msg.image, '_blank')} />
                    ) : msg.fileUrl ? (
                      <div className={`flex items-center gap-3 p-3 rounded-2xl shadow-md ${isSelf ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-200'}`}>
                        <span className="text-2xl">{getFileIcon(msg.fileType)}</span>
                        <div className="flex flex-col max-w-[150px]">
                          <span className="text-sm font-medium truncate">{msg.fileName || 'File'}</span>
                          <span className="text-xs opacity-75">{formatFileSize(msg.fileSize)}</span>
                        </div>
                        <a href={msg.fileUrl} target="_blank" rel="noopener noreferrer" className="ml-2 p-1.5 bg-white/20 hover:bg-white/30 rounded-full transition-colors">⬇️</a>
                      </div>
                    ) : (
                      <div className={`px-4 py-2.5 shadow-md relative ${isSelf ? 'bg-indigo-600 text-white rounded-l-2xl rounded-tr-2xl' : 'bg-slate-800 text-slate-200 rounded-r-2xl rounded-tl-2xl border border-slate-700/50'} ${isToxic ? 'border-2 border-red-500 bg-red-900/20' : ''} ${isGrouped && isSelf ? 'rounded-tr-md' : ''} ${isGrouped && !isSelf ? 'rounded-tl-md' : ''}`}>
                        {isToxic && <span className="absolute -top-3 -right-2 text-xl" title="Warning: Toxic Content">⚠️</span>}
                        <p className="text-[15px] leading-relaxed break-words whitespace-pre-wrap">
                          {(() => {
                            if (msg.e2ee || msg.encryptedMessage) {
                              const decoded = decryptedTexts[msg.id];
                              if (decoded) {
                                return showSearch && searchQuery
                                  ? highlightText(decoded, searchQuery)
                                  : <>{decoded} <span className="ml-2 text-[10px] opacity-60" title="End-to-end encrypted">🔒</span></>;
                              }
                              return <span className="italic opacity-70">🔒 Decrypting…</span>;
                            }
                            return showSearch && searchQuery ? highlightText(msg.text, searchQuery) : msg.text;
                          })()}
                        </p>
                      </div>
                    )}

                    {/* Quick Reaction Picker */}
                    {activeReactionMsg === msg.id && (
                      <div className={`absolute top-1/2 -translate-y-1/2 ${isSelf ? '-left-8 -translate-x-full' : '-right-8 translate-x-full'} bg-slate-800 border border-slate-700 shadow-xl rounded-full px-2 py-1 flex gap-1 z-20`}>
                        {QUICK_REACTIONS.map((emoji) => (
                          <button key={emoji} className="hover:scale-125 transition-transform" onClick={() => addReaction(msg.id, emoji)}>{emoji}</button>
                        ))}
                      </div>
                    )}

                    {/* Reactions Display */}
                    {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                      <div className={`flex flex-wrap gap-1 mt-1 absolute -bottom-3 ${isSelf ? 'right-2' : 'left-2'} z-10`}>
                        {Object.entries(msg.reactions).map(([emoji, users]) => (
                          <button
                            key={emoji}
                            className={`flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded-full border shadow-sm ${users.includes(userData.uid) ? 'bg-indigo-600/30 border-indigo-500/50 text-indigo-200' : 'bg-slate-800 border-slate-700 text-slate-300'} hover:bg-slate-700 transition-colors`}
                            onClick={() => addReaction(msg.id, emoji)}
                          >
                            <span>{emoji}</span>
                            {users.length > 1 && <span>{users.length}</span>}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Meta: Time, Receipt, Reply + Translate buttons */}
                  <div className={`flex items-center gap-1 mt-1 text-[11px] text-slate-500 ${isSelf ? 'justify-end' : 'justify-start'} relative`}>
                    <p>{formatTime(msg.createdAt)}</p>
                    {renderReceipt(msg)}
                    {msg.expiresAt && <span className="text-amber-500 ml-1">⏱</span>}
                    {/* Reply */}
                    <button
                      className="ml-1 opacity-0 group-hover:opacity-100 transition-opacity text-slate-500 hover:text-indigo-400"
                      title="Reply"
                      onClick={() => setReplyingTo({ id: msg.id, displayText: msg.text || decryptedTexts[msg.id] || '🎤 Voice note', senderName: isSelf ? (userData?.name || 'Me') : (chatUser?.name || msg.sName || 'User') })}
                    >↩</button>
                    {/* Translate */}
                    {(msg.text || decryptedTexts[msg.id]) && (
                      <div className="relative">
                        <button
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-500 hover:text-emerald-400"
                          title="Translate"
                          onClick={() => setTranslatePickerMsg(translatePickerMsg === msg.id ? null : msg.id)}
                        >🌐</button>
                        {translatePickerMsg === msg.id && (
                          <div className={`absolute bottom-6 ${isSelf ? 'right-0' : 'left-0'} z-30 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl p-2 flex flex-wrap gap-1 w-52`}>
                            {[{c:'en',l:'English'},{c:'hi',l:'Hindi'},{c:'es',l:'Spanish'},{c:'fr',l:'French'},{c:'de',l:'German'},{c:'ja',l:'Japanese'},{c:'ar',l:'Arabic'},{c:'zh',l:'Chinese'}].map(({c,l}) => (
                              <button key={c}
                                className="text-[11px] px-2 py-1 rounded-lg bg-slate-700 hover:bg-indigo-600/60 text-slate-300 hover:text-white transition-colors"
                                onClick={() => { handleTranslate(msg.id, msg.text || decryptedTexts[msg.id] || '', c); setTranslatePickerMsg(null); }}
                              >{l}</button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Translated text */}
                  {translatedMsgs[msg.id] && (
                    <div className={`mt-1 px-3 py-1.5 rounded-xl text-xs italic border ${isSelf ? 'bg-indigo-900/30 border-indigo-700/30 text-indigo-200' : 'bg-slate-800/60 border-slate-700/40 text-slate-400'}`}>
                      <span className="text-[10px] not-italic text-emerald-400 block mb-0.5">🌐 Translation</span>
                      {translatedMsgs[msg.id]}
                      <button className="ml-2 text-[10px] text-slate-500 hover:text-white" onClick={() => setTranslatedMsgs(p => { const n={...p}; delete n[msg.id]; return n; })}>✕</button>
                    </div>
                  )}

                </div>
              </div>
            </React.Fragment>
          );
        })}

        {/* Typing Indicator */}
        {typingUserIds.length > 0 && (
          <div className="flex items-center gap-2 mt-4 text-sm text-indigo-400 font-medium">
            <div className="flex gap-1 items-center bg-slate-800/50 px-3 py-1.5 rounded-full border border-slate-700/50">
              <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce"></span>
              <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce" style={{animationDelay: '150ms'}}></span>
              <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce" style={{animationDelay: '300ms'}}></span>
            </div>
            <span>{chatType === "room" ? "Someone is" : (chatUser?.name || chatUser?.username || "User") + " is"} typing…</span>
          </div>
        )}
        </div>
      </div>{/* end wallpaper wrapper */}

      {/* Clear Chat Confirmation Modal */}
      {showClearConfirm && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-slate-800 border border-slate-700 p-6 rounded-2xl shadow-2xl max-w-sm w-full text-center mx-4">
            <div className="text-4xl mb-4 bg-red-500/20 text-red-500 w-16 h-16 rounded-full flex items-center justify-center mx-auto">🗑️</div>
            <h4 className="text-xl font-semibold text-white mb-2">Clear Chat</h4>
            <p className="text-slate-400 text-sm mb-6">Are you sure you want to delete all messages? This cannot be undone.</p>
            <div className="flex gap-3">
              <button className="flex-1 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl transition-colors font-medium" onClick={() => setShowClearConfirm(false)}>Cancel</button>
              <button className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl transition-colors font-medium shadow-lg shadow-red-500/20" onClick={clearChat}>Clear All</button>
            </div>
          </div>
        </div>
      )}

      {/* AI Insights Modal */}
      {showInsightsModal && (
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end justify-center sm:items-center">
          <div className="bg-slate-800 border border-slate-700 rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-md mx-0 sm:mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="text-xl">💡</span>
                <h4 className="text-lg font-semibold text-white">Conversation Insights</h4>
              </div>
              <button onClick={() => setShowInsightsModal(false)} className="text-slate-400 hover:text-white p-1">✕</button>
            </div>
            {isInsightsLoading ? (
              <div className="flex items-center gap-3 py-4 text-slate-400">
                <span className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                Analyzing conversation with Gemini...
              </div>
            ) : (
              <div className="text-slate-300 text-sm leading-relaxed whitespace-pre-line bg-slate-900/50 rounded-xl p-4">{insights}</div>
            )}
          </div>
        </div>
      )}

      {/* AI Summary Modal */}
      {showSummaryModal && (
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end justify-center sm:items-center">
          <div className="bg-slate-800 border border-slate-700 rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-md mx-0 sm:mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="text-xl">🤖</span>
                <h4 className="text-lg font-semibold text-white">AI Chat Summary</h4>
              </div>
              <button onClick={() => setShowSummaryModal(false)} className="text-slate-400 hover:text-white p-1">✕</button>
            </div>
            {isSummarizing ? (
              <div className="flex items-center gap-3 py-4 text-slate-400">
                <span className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                Generating summary with Gemini...
              </div>
            ) : (
              <div className="text-slate-300 text-sm leading-relaxed whitespace-pre-line bg-slate-900/50 rounded-xl p-4">{chatSummary}</div>
            )}
          </div>
        </div>
      )}

      {/* Blocked Banner */}
      {chatDisabled && chatType === "user" && (
        <div className="bg-red-900/30 border-t border-red-500/30 text-red-400 py-3 px-4 text-center text-sm">
          {blockedThem
            ? "🚫 You blocked this user. Unblock from the sidebar to chat."
            : "🚫 You can't send messages to this user."
          }
        </div>
      )}

      {/* Input Area */}
      {!chatDisabled && (
        <div className="bg-slate-800/80 backdrop-blur-md border-t border-slate-700/50">

          {/* Reply Preview */}
          {replyingTo && (
            <div className="flex items-center gap-3 px-4 pt-2.5 pb-0">
              <div className="flex-1 bg-indigo-900/30 border-l-2 border-indigo-400 px-3 py-1.5 rounded-r-lg min-w-0">
                <p className="text-xs text-indigo-300 font-medium">{replyingTo.senderName}</p>
                <p className="text-xs text-slate-400 truncate">{replyingTo.displayText}</p>
              </div>
              <button onClick={() => setReplyingTo(null)} className="text-slate-500 hover:text-white p-1 flex-shrink-0">✕</button>
            </div>
          )}

          {/* Voice recording preview */}
          {audioBlob && !isRecording && (
            <div className="flex items-center gap-3 px-4 pt-2.5 pb-0">
              <VoiceNotePlayer url={audioUrl} duration={duration} isSelf />
              <button onClick={clearRecording} className="text-slate-500 hover:text-red-400 p-1">✕</button>
              <button onClick={sendVoiceNote} className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs rounded-lg font-medium">Send 🎤</button>
            </div>
          )}

          {/* Smart Reply Chips */}
          {smartReplies.length > 0 && !input && !replyingTo && !audioBlob && (
            <div className="flex gap-2 px-4 pt-2 overflow-x-auto custom-scrollbar pb-0" style={{scrollbarWidth:'none'}}>
              {smartReplies.map((r, i) => (
                <button key={i} onClick={() => { setInput(r); setSmartReplies([]); }}
                  className="flex-shrink-0 text-xs px-3 py-1.5 bg-indigo-600/20 border border-indigo-500/40 text-indigo-300 rounded-full hover:bg-indigo-600/40 transition-colors whitespace-nowrap">
                  {r}
                </button>
              ))}
            </div>
          )}

          {/* Disappear timer notice */}
          {disappearTimer > 0 && (
            <p className="px-4 pt-1.5 text-[10px] text-amber-400/60">⏱ Messages disappear after {disappearTimer < 60 ? `${disappearTimer}s` : disappearTimer < 3600 ? `${disappearTimer/60}m` : '1h'}</p>
          )}

          {/* Main row */}
          <div className="p-4 flex items-center gap-3">
            <div className="relative" ref={emojiRef}>
              <button className="text-2xl text-slate-400 hover:text-indigo-400 transition-colors" onClick={() => setShowEmojiPicker(!showEmojiPicker)} title="Emoji">😊</button>
              {showEmojiPicker && (
                <div className="absolute bottom-12 left-0 z-50 shadow-2xl rounded-2xl overflow-hidden border border-slate-700">
                  <EmojiPicker onEmojiClick={onEmojiClick} theme="dark" width={320} height={400} searchDisabled={false} skinTonesDisabled previewConfig={{ showPreview: false }} />
                </div>
              )}
            </div>

            {/* Mic button */}
            {!audioBlob && (
              <button
                onMouseDown={startRecording} onMouseUp={stopRecording} onMouseLeave={() => { if (isRecording) stopRecording(); }}
                onTouchStart={(e) => { e.preventDefault(); startRecording(); }} onTouchEnd={stopRecording}
                className={`flex-shrink-0 transition-all ${isRecording ? 'text-red-400 scale-125' : 'text-slate-400 hover:text-indigo-400'}`}
                title={isRecording ? 'Recording… release to stop' : 'Hold to record voice note'}
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 10v2a7 7 0 01-14 0v-2" />
                  <line x1="12" y1="19" x2="12" y2="23" />
                  <line x1="8" y1="23" x2="16" y2="23" />
                </svg>
              </button>
            )}

            {isRecording ? (
              <div className="flex-1 flex items-center gap-2">
                <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                <span className="text-red-400 text-sm font-medium">Recording {duration}s… release to stop</span>
                <button onClick={cancelRecording} className="ml-auto text-xs text-slate-400 hover:text-white">Cancel</button>
              </div>
            ) : (
              <div className="flex-1 relative">
                <input
                  type="text" placeholder={chatType === 'room' ? 'Message the room...' : 'Type a message…'}
                  value={input} onChange={handleInputChange} onKeyDown={handleKeyPress}
                  className="w-full bg-slate-900 border border-slate-700 text-white px-4 py-3 rounded-full focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all placeholder-slate-500"
                />
              </div>
            )}

            <input type="file" id="fileUpload" accept="image/*,.pdf,.doc,.docx,.txt,.zip,.xls,.xlsx,.ppt,.pptx" hidden onChange={sendFile} />
            <label htmlFor="fileUpload" className="cursor-pointer text-slate-400 hover:text-indigo-400 transition-colors p-2 flex-shrink-0" title="Attach file">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
            </label>

            <button
              onClick={audioBlob ? sendVoiceNote : sendMessage}
              disabled={!audioBlob && !input.trim()}
              className="w-12 h-12 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full flex items-center justify-center shadow-lg shadow-indigo-500/30 transition-transform active:scale-95 disabled:opacity-50 flex-shrink-0"
            >
              <svg className="w-5 h-5 ml-1" fill="currentColor" viewBox="0 0 20 20"><path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" /></svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatWindow;
