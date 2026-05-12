import React, { useContext, useState, useEffect } from 'react';
import { AppContext } from '../../context/AppContextProvider';
import { db } from '../../config/firebase';
import {
  collection, addDoc, doc, updateDoc, getDoc, getDocs,
  query, where, arrayUnion, arrayRemove, serverTimestamp, onSnapshot,
} from 'firebase/firestore';
import { toast } from 'react-toastify';
import assets from '../../assets/assets';

const CommunitiesTab = ({ onSelectCommunity }) => {
  const { userData } = useContext(AppContext);
  const [communities, setCommunities] = useState([]);
  const [searchResults, setSearchResults] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', isPublic: true });
  const [creating, setCreating] = useState(false);

  // Listen to communities the user belongs to
  useEffect(() => {
    if (!userData?.uid) return;
    const q = query(
      collection(db, 'communities'),
      where('members', 'array-contains', userData.uid)
    );
    const unsub = onSnapshot(q, snap => {
      setCommunities(snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)));
    });
    return () => unsub();
  }, [userData?.uid]);

  const searchCommunities = async (q) => {
    setSearchQuery(q);
    if (!q.trim()) { setSearchResults(null); return; }
    const snap = await getDocs(query(
      collection(db, 'communities'),
      where('name', '>=', q),
      where('name', '<=', q + '\uf8ff')
    ));
    setSearchResults(snap.docs
      .filter(d => !d.data().members?.includes(userData.uid))
      .map(d => ({ id: d.id, ...d.data() })));
  };

  const createCommunity = async () => {
    if (!form.name.trim()) return;
    setCreating(true);
    try {
      const ref = await addDoc(collection(db, 'communities'), {
        name: form.name.trim(),
        description: form.description.trim(),
        isPublic: form.isPublic,
        ownerId: userData.uid,
        members: [userData.uid],
        roles: { [userData.uid]: 'owner' },
        createdAt: serverTimestamp(),
        updatedAt: Date.now(),
        icon: '🏠',
      });
      // Create a default #general channel
      await addDoc(collection(db, 'communities', ref.id, 'channels'), {
        name: 'general',
        type: 'text',
        position: 0,
        createdAt: serverTimestamp(),
      });
      toast.success(`Community "${form.name}" created!`);
      setShowCreate(false);
      setForm({ name: '', description: '', isPublic: true });
    } catch (e) {
      toast.error('Failed to create community');
    }
    setCreating(false);
  };

  const joinCommunity = async (community) => {
    try {
      await updateDoc(doc(db, 'communities', community.id), {
        members: arrayUnion(userData.uid),
        [`roles.${userData.uid}`]: 'member',
      });
      toast.success(`Joined "${community.name}"!`);
      setSearchResults(null);
      setSearchQuery('');
    } catch (e) {
      toast.error('Failed to join');
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-slate-700/50">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-white text-sm uppercase tracking-wider">Communities</h2>
          <button
            onClick={() => setShowCreate(v => !v)}
            className="w-7 h-7 bg-indigo-600 hover:bg-indigo-500 rounded-full flex items-center justify-center text-white text-lg transition-colors"
            title="Create community"
          >+</button>
        </div>
        <input
          value={searchQuery}
          onChange={e => searchCommunities(e.target.value)}
          placeholder="Discover communities…"
          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 placeholder-slate-500"
        />
      </div>

      {/* Create Form */}
      {showCreate && (
        <div className="p-4 bg-slate-800/60 border-b border-slate-700/50 space-y-3">
          <input
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            placeholder="Community name *"
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
          />
          <input
            value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            placeholder="Description (optional)"
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
          />
          <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
            <input type="checkbox" checked={form.isPublic} onChange={e => setForm(f => ({ ...f, isPublic: e.target.checked }))} className="accent-indigo-500" />
            Public community
          </label>
          <div className="flex gap-2">
            <button onClick={createCommunity} disabled={creating || !form.name.trim()}
              className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors">
              {creating ? 'Creating…' : 'Create'}
            </button>
            <button onClick={() => setShowCreate(false)}
              className="flex-1 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* List */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {searchResults !== null ? (
          searchResults.length > 0 ? searchResults.map(c => (
            <div key={c.id} className="flex items-center gap-3 p-3 mx-2 my-1 hover:bg-slate-800 rounded-xl cursor-pointer" onClick={() => joinCommunity(c)}>
              <div className="w-11 h-11 bg-indigo-900/50 rounded-xl flex items-center justify-center text-2xl flex-shrink-0">{c.icon || '🏠'}</div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-200 truncate">{c.name}</p>
                <p className="text-xs text-indigo-400">{c.members?.length || 0} members · Click to join</p>
              </div>
            </div>
          )) : <p className="text-center text-slate-500 text-sm mt-6">No communities found</p>
        ) : communities.length > 0 ? communities.map(c => (
          <div key={c.id}
            className="flex items-center gap-3 p-3 mx-2 my-1 hover:bg-slate-800 rounded-xl cursor-pointer transition-colors"
            onClick={() => onSelectCommunity(c)}
          >
            <div className="w-11 h-11 bg-indigo-900/50 rounded-xl flex items-center justify-center text-2xl flex-shrink-0">{c.icon || '🏠'}</div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-slate-200 truncate">{c.name}</p>
              <p className="text-xs text-slate-400">{c.members?.length || 0} members</p>
            </div>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${c.isPublic ? 'bg-green-500/20 text-green-400' : 'bg-slate-700 text-slate-400'}`}>
              {c.isPublic ? 'Public' : 'Private'}
            </span>
          </div>
        )) : (
          <div className="flex flex-col items-center justify-center text-center mt-12 p-6">
            <span className="text-4xl mb-3 opacity-40">🏘️</span>
            <p className="text-slate-400 font-medium">No communities yet</p>
            <p className="text-slate-500 text-sm mt-1">Create one or search to discover</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default CommunitiesTab;
