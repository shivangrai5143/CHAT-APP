import React, { useContext, useState, useEffect, useRef } from 'react';
import { AppContext } from '../../context/AppContextProvider';
import { db } from '../../config/firebase';
import {
  collection, addDoc, doc, onSnapshot, query,
  orderBy, serverTimestamp, updateDoc, arrayRemove,
} from 'firebase/firestore';
import { toast } from 'react-toastify';
import assets from '../../assets/assets';

const ROLE_COLORS = { owner: 'text-yellow-400', admin: 'text-indigo-400', moderator: 'text-purple-400', member: 'text-slate-400' };
const ROLE_LABELS = { owner: '👑 Owner', admin: '⚡ Admin', moderator: '🛡️ Mod', member: 'Member' };

const CommunityView = ({ community, onBack }) => {
  const { userData } = useContext(AppContext);
  const [channels, setChannels] = useState([]);
  const [activeChannel, setActiveChannel] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const scrollRef = useRef(null);

  const myRole = community.roles?.[userData?.uid] || 'member';
  const canManage = myRole === 'owner' || myRole === 'admin';

  // Load channels
  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, 'communities', community.id, 'channels'), orderBy('position', 'asc')),
      snap => {
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setChannels(list);
        if (!activeChannel && list.length > 0) setActiveChannel(list[0]);
      }
    );
    return () => unsub();
  }, [community.id]); // eslint-disable-line

  // Load messages for active channel
  useEffect(() => {
    if (!activeChannel) return;
    const unsub = onSnapshot(
      query(collection(db, 'communities', community.id, 'channels', activeChannel.id, 'messages'), orderBy('createdAt', 'asc')),
      snap => setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );
    return () => unsub();
  }, [community.id, activeChannel?.id]);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || !activeChannel) return;
    const text = input.trim();
    setInput('');
    await addDoc(collection(db, 'communities', community.id, 'channels', activeChannel.id, 'messages'), {
      text,
      sId: userData.uid,
      sName: userData.name || userData.username || 'User',
      sAvatar: userData.avatar || '',
      createdAt: serverTimestamp(),
    });
    await updateDoc(doc(db, 'communities', community.id), { updatedAt: Date.now() });
  };

  const createChannel = async () => {
    if (!newChannelName.trim() || !canManage) return;
    await addDoc(collection(db, 'communities', community.id, 'channels'), {
      name: newChannelName.trim().toLowerCase().replace(/\s+/g, '-'),
      type: 'text',
      position: channels.length,
      createdAt: serverTimestamp(),
    });
    setNewChannelName('');
    toast.success('Channel created!');
  };

  const leaveCommunity = async () => {
    if (myRole === 'owner') { toast.error('Transfer ownership before leaving'); return; }
    await updateDoc(doc(db, 'communities', community.id), {
      members: arrayRemove(userData.uid),
    });
    toast.success('Left community');
    onBack();
  };

  const formatTime = (ts) => {
    if (!ts) return '';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="flex h-full">
      {/* Channel Sidebar */}
      <div className="w-52 bg-slate-900 border-r border-slate-700/50 flex flex-col flex-shrink-0">
        {/* Community Header */}
        <div className="p-4 border-b border-slate-700/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <button onClick={onBack} className="text-slate-400 hover:text-white text-lg flex-shrink-0">←</button>
              <span className="font-bold text-white text-sm truncate">{community.name}</span>
            </div>
            <button onClick={() => setShowSettings(v => !v)} className="text-slate-400 hover:text-white text-sm flex-shrink-0" title="Settings">⚙️</button>
          </div>
          <p className="text-xs text-slate-500 mt-1">{community.members?.length || 0} members</p>
        </div>

        {/* Channels */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
          <p className="text-[11px] text-slate-500 uppercase tracking-wider px-2 mb-1 font-semibold">Text Channels</p>
          {channels.map(ch => (
            <button
              key={ch.id}
              onClick={() => setActiveChannel(ch)}
              className={`w-full text-left px-3 py-1.5 rounded-lg text-sm flex items-center gap-2 transition-colors mb-0.5 ${activeChannel?.id === ch.id ? 'bg-slate-700 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}
            >
              <span className="text-slate-500">#</span>
              <span className="truncate">{ch.name}</span>
            </button>
          ))}

          {/* Create Channel */}
          {canManage && (
            <div className="mt-3 px-2">
              <div className="flex gap-1">
                <input
                  value={newChannelName}
                  onChange={e => setNewChannelName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && createChannel()}
                  placeholder="new-channel"
                  className="flex-1 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
                <button onClick={createChannel} className="px-2 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs">+</button>
              </div>
            </div>
          )}
        </div>

        {/* My Role + Leave */}
        <div className="p-3 border-t border-slate-700/50">
          <p className={`text-xs font-medium ${ROLE_COLORS[myRole]}`}>{ROLE_LABELS[myRole]}</p>
          <button onClick={leaveCommunity} className="mt-2 w-full text-left text-xs text-red-400 hover:text-red-300 transition-colors">
            Leave community
          </button>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col bg-slate-900 min-w-0">
        {activeChannel ? (
          <>
            {/* Channel Header */}
            <div className="h-14 flex items-center px-5 border-b border-slate-700/50 bg-slate-800/60 gap-3">
              <span className="text-slate-400 text-lg">#</span>
              <h3 className="font-semibold text-white">{activeChannel.name}</h3>
              {activeChannel.topic && <span className="text-slate-500 text-sm border-l border-slate-700 pl-3">{activeChannel.topic}</span>}
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 custom-scrollbar space-y-1">
              {messages.map((msg, i) => {
                const isSelf = msg.sId === userData?.uid;
                const prev = messages[i - 1];
                const grouped = prev?.sId === msg.sId;
                return (
                  <div key={msg.id} className={`flex items-start gap-3 ${grouped ? 'mt-0.5' : 'mt-4'}`}>
                    {!grouped ? (
                      <img src={msg.sAvatar || assets.profile_img} className="w-9 h-9 rounded-full object-cover flex-shrink-0 mt-0.5" alt="" />
                    ) : (
                      <div className="w-9 flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      {!grouped && (
                        <div className="flex items-baseline gap-2 mb-0.5">
                          <span className={`text-sm font-semibold ${isSelf ? 'text-indigo-300' : 'text-slate-200'}`}>{msg.sName}</span>
                          <span className="text-[11px] text-slate-500">{formatTime(msg.createdAt)}</span>
                        </div>
                      )}
                      <p className="text-sm text-slate-300 break-words leading-relaxed">{msg.text}</p>
                    </div>
                  </div>
                );
              })}
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <span className="text-5xl mb-4 opacity-30">#</span>
                  <p className="text-slate-400 font-semibold">Welcome to #{activeChannel.name}!</p>
                  <p className="text-slate-500 text-sm">This is the start of the channel.</p>
                </div>
              )}
            </div>

            {/* Input */}
            <div className="p-4 border-t border-slate-700/50">
              <div className="flex items-center gap-3 bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 focus-within:border-indigo-500 transition-colors">
                <input
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && sendMessage()}
                  placeholder={`Message #${activeChannel.name}`}
                  className="flex-1 bg-transparent text-white text-sm focus:outline-none placeholder-slate-500"
                />
                <button onClick={sendMessage} disabled={!input.trim()}
                  className="w-8 h-8 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 rounded-lg flex items-center justify-center transition-colors flex-shrink-0">
                  <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                  </svg>
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-slate-500">
            Select a channel to start chatting
          </div>
        )}
      </div>
    </div>
  );
};

export default CommunityView;
