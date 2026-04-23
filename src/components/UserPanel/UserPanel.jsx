import React, { useContext, useState, useEffect } from 'react'
import assets from '../../assets/assets'
import { logout } from '../../config/firebase'
import { AppContext } from '../../context/AppContextProvider'
import {
  doc,
  getDoc,
  updateDoc,
  arrayRemove,
  arrayUnion,
  collection,
  query,
  where,
  getDocs,
} from 'firebase/firestore'
import { db } from '../../config/firebase'
import { toast } from 'react-toastify'

const REPORT_REASONS = ['Spam', 'Harassment', 'Inappropriate Content', 'Impersonation', 'Other'];

const UserPanel = () => {
  const {
    chatUser,
    chatType,
    roomData,
    messages,
    userData,
    setMessagesId,
    setChatUser,
    setChatType,
    setRoomData,
    blockUser,
    unblockUser,
    isBlocked,
    isBlockedBy,
    reportUser,
    // Theme
    wallpaperId,
    wallpaperStyle,
    setWallpaperById,
    wallpapers,
  } = useContext(AppContext);

  const [memberDetails, setMemberDetails] = useState([]);
  const [showAddMember, setShowAddMember] = useState(false);
  const [memberSearch, setMemberSearch] = useState('');
  const [memberSearchResults, setMemberSearchResults] = useState([]);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportDescription, setReportDescription] = useState('');

  const isAdmin = roomData?.admins?.includes(userData?.uid);

  useEffect(() => {
    if (chatType !== "room" || !roomData?.members) {
      setMemberDetails([]);
      return;
    }

    const loadMembers = async () => {
      const details = await Promise.all(
        roomData.members.map(async (uid) => {
          const userRef = doc(db, "users", uid);
          const snap = await getDoc(userRef);
          return snap.exists() ? { uid, ...snap.data() } : { uid, name: "Unknown" };
        })
      );
      setMemberDetails(details);
    };

    loadMembers();
  }, [roomData?.members, chatType]);

  const mediaImages = messages.filter((msg) => msg.image);

  const isOnline = (lastSeen) => lastSeen && Date.now() - lastSeen < 70000;

  const formatLastSeen = (lastSeen) => {
    if (!lastSeen) return 'Offline';
    const diff = Date.now() - lastSeen;
    if (diff < 70000) return 'Online';
    if (diff < 60000) return 'Last seen just now';
    if (diff < 3600000) return `Last seen ${Math.floor(diff / 60000)} min ago`;
    if (diff < 86400000) return `Last seen ${Math.floor(diff / 3600000)}h ago`;
    const d = new Date(lastSeen);
    return `Last seen ${d.toLocaleDateString([], { month: 'short', day: 'numeric' })}`;
  };

  const leaveRoom = async () => {
    if (!roomData?.id || !userData?.uid) return;
    try {
      const roomRef = doc(db, "rooms", roomData.id);
      await updateDoc(roomRef, {
        members: arrayRemove(userData.uid),
        admins: arrayRemove(userData.uid),
      });
      setMessagesId(null);
      setChatType("user");
      setChatUser(null);
      setRoomData(null);
    } catch (error) {
      console.error("Error leaving room:", error);
    }
  };

  const removeMember = async (uid) => {
    if (!isAdmin || !roomData?.id) return;
    try {
      const roomRef = doc(db, "rooms", roomData.id);
      await updateDoc(roomRef, {
        members: arrayRemove(uid),
        admins: arrayRemove(uid),
      });
      setRoomData((prev) => ({
        ...prev,
        members: prev.members.filter((m) => m !== uid),
        admins: (prev.admins || []).filter((a) => a !== uid),
      }));
      toast.success("Member removed");
    } catch (error) {
      console.error("Error removing member:", error);
      toast.error("Failed to remove member");
    }
  };

  const toggleAdmin = async (uid) => {
    if (!isAdmin || !roomData?.id) return;
    try {
      const roomRef = doc(db, "rooms", roomData.id);
      const isTargetAdmin = roomData.admins?.includes(uid);
      if (isTargetAdmin) {
        await updateDoc(roomRef, { admins: arrayRemove(uid) });
        setRoomData((prev) => ({
          ...prev,
          admins: (prev.admins || []).filter((a) => a !== uid),
        }));
        toast.success("Admin role removed");
      } else {
        await updateDoc(roomRef, { admins: arrayUnion(uid) });
        setRoomData((prev) => ({
          ...prev,
          admins: [...(prev.admins || []), uid],
        }));
        toast.success("Admin role granted");
      }
    } catch (error) {
      console.error("Error toggling admin:", error);
    }
  };

  const searchUsersToAdd = async (e) => {
    const input = e.target.value.trim();
    setMemberSearch(input);
    if (!input) { setMemberSearchResults([]); return; }

    try {
      const userRef = collection(db, "users");
      const q = query(
        userRef,
        where("username", ">=", input.toLowerCase()),
        where("username", "<=", input.toLowerCase() + '\uf8ff')
      );
      const snap = await getDocs(q);
      const results = snap.docs
        .filter((d) => !roomData?.members?.includes(d.id))
        .map((d) => ({ uid: d.id, ...d.data() }));
      setMemberSearchResults(results);
    } catch (error) {
      console.error("Search error:", error);
    }
  };

  const addMemberToRoom = async (uid) => {
    if (!roomData?.id) return;
    try {
      const roomRef = doc(db, "rooms", roomData.id);
      await updateDoc(roomRef, {
        members: arrayUnion(uid),
      });
      setRoomData((prev) => ({
        ...prev,
        members: [...(prev.members || []), uid],
      }));
      setMemberSearchResults((prev) => prev.filter((u) => u.uid !== uid));
      toast.success("Member added!");
    } catch (error) {
      console.error("Error adding member:", error);
      toast.error("Failed to add member");
    }
  };

  const handleBlock = async () => {
    if (!chatUser?.uid) return;
    if (isBlocked(chatUser.uid)) {
      await unblockUser(chatUser.uid);
      toast.success("User unblocked");
    } else {
      await blockUser(chatUser.uid);
      toast.success("User blocked");
    }
  };

  const handleReport = async () => {
    if (!reportReason) {
      toast.error("Please select a reason");
      return;
    }
    await reportUser(chatUser.uid, reportReason, reportDescription);
    toast.success("Report submitted. We'll review it shortly.");
    setShowReportModal(false);
    setReportReason('');
    setReportDescription('');
  };

  // ─── Room View ───
  if (chatType === "room" && roomData) {
    return (
      <div className="w-full md:w-[300px] lg:w-[340px] h-[50vh] md:h-full bg-slate-900 border-l border-slate-700/50 flex flex-col flex-shrink-0 transition-all overflow-y-auto custom-scrollbar p-4">
        <div className="flex flex-col items-center text-center mt-6 mb-4">
          <div className="w-24 h-24 bg-indigo-900/50 text-indigo-300 rounded-full flex items-center justify-center text-4xl shadow-inner mb-4">👥</div>
          <h3 className="text-xl font-bold text-white mb-1">{roomData.name}</h3>
          <p className="text-sm text-slate-400">{roomData.members?.length || 0} members</p>
        </div>
        
        <hr className="border-slate-700/50 my-4" />

        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="font-semibold text-slate-300">Members</p>
            {isAdmin && (
              <button 
                className="w-7 h-7 bg-indigo-600 hover:bg-indigo-500 rounded-full flex items-center justify-center text-white transition-colors"
                onClick={() => setShowAddMember(!showAddMember)}
                title="Add member"
              >
                {showAddMember ? '✕' : '＋'}
              </button>
            )}
          </div>

          {showAddMember && isAdmin && (
            <div className="bg-slate-800 p-3 rounded-xl border border-slate-700 mb-4">
              <input
                type="text"
                placeholder="Search username..."
                value={memberSearch}
                onChange={searchUsersToAdd}
                className="w-full bg-slate-900 border border-slate-700 text-slate-200 px-3 py-2 rounded-lg text-sm focus:outline-none focus:border-indigo-500 transition-colors mb-2"
                autoFocus
              />
              {memberSearchResults.length > 0 && (
                <div className="max-h-40 overflow-y-auto custom-scrollbar space-y-1">
                  {memberSearchResults.map((user) => (
                    <div key={user.uid} className="flex items-center justify-between p-2 hover:bg-slate-700 rounded-lg cursor-pointer" onClick={() => addMemberToRoom(user.uid)}>
                      <div className="flex items-center gap-2 overflow-hidden">
                        <img src={user.avatar || assets.profile_img} alt="" className="w-6 h-6 rounded-full" />
                        <span className="text-sm text-slate-300 truncate">{user.name || user.username || 'User'}</span>
                      </div>
                      <span className="text-xs text-indigo-400 font-medium">Add</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="space-y-2">
            {memberDetails.map((member) => {
              const isMemberAdmin = roomData.admins?.includes(member.uid);
              const isSelf = member.uid === userData.uid;

              return (
                <div key={member.uid} className="flex items-center justify-between group">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className="relative shrink-0">
                      <img src={member.avatar || assets.profile_img} className="w-10 h-10 rounded-full object-cover" alt="" />
                      {isOnline(member.lastSeen) && <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-slate-900 rounded-full"></span>}
                    </div>
                    <div className="flex flex-col overflow-hidden">
                      <span className="text-sm font-medium text-slate-200 truncate flex items-center gap-1">
                        {member.name || member.username || 'User'}
                        {isSelf && <span className="text-xs text-slate-500 font-normal">(You)</span>}
                        {isMemberAdmin && <span className="text-[10px] bg-indigo-600/30 text-indigo-300 px-1.5 rounded uppercase">Admin</span>}
                      </span>
                      <span className={`text-xs truncate ${isOnline(member.lastSeen) ? 'text-green-400' : 'text-slate-500'}`}>
                        {isOnline(member.lastSeen) ? 'Online' : formatLastSeen(member.lastSeen)}
                      </span>
                    </div>
                  </div>
                  {isAdmin && !isSelf && (
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      <button
                        className="p-1.5 hover:bg-slate-800 rounded-md transition-colors"
                        onClick={() => toggleAdmin(member.uid)}
                        title={isMemberAdmin ? 'Remove admin' : 'Make admin'}
                      >
                        {isMemberAdmin ? '👑' : '⭐'}
                      </button>
                      <button
                        className="p-1.5 hover:bg-red-900/30 text-red-400 rounded-md transition-colors"
                        onClick={() => removeMember(member.uid)}
                        title="Remove member"
                      >
                        ✕
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {mediaImages.length > 0 && (
          <>
            <hr className="border-slate-700/50 my-4" />
            <div>
              <p className="font-semibold text-slate-300 mb-3">Shared Media</p>
              <div className="grid grid-cols-3 gap-2">
                {mediaImages.map((msg) => (
                  <img key={msg.id} src={msg.image} className="w-full aspect-square object-cover rounded-lg cursor-pointer hover:opacity-80 transition-opacity" alt="" onClick={() => window.open(msg.image, '_blank')} />
                ))}
              </div>
            </div>
          </>
        )}
        
        <div className="mt-auto pt-6 pb-2">
          <button className="w-full py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 rounded-xl transition-colors font-medium text-sm" onClick={leaveRoom}>
            Leave Room
          </button>
        </div>
      </div>
    );
  }

  // ─── 1-on-1 Chat View ───
  if (chatUser) {
    const blocked = isBlocked(chatUser.uid);

    return (
      <div className="w-full md:w-[300px] lg:w-[340px] h-[50vh] md:h-full bg-slate-900 border-l border-slate-700/50 flex flex-col flex-shrink-0 transition-all overflow-y-auto custom-scrollbar p-4 relative">
        
        <div className="flex flex-col items-center text-center mt-6 mb-4">
          <div className="relative mb-4">
            <img src={chatUser.avatar || assets.profile_img} className="w-24 h-24 rounded-full object-cover shadow-lg border-2 border-slate-800" alt="" />
            {isOnline(chatUser.lastSeen) && <span className="absolute bottom-1 right-1 w-5 h-5 bg-green-500 border-4 border-slate-900 rounded-full"></span>}
          </div>
          <h3 className="text-xl font-bold text-white mb-1">
            {chatUser.name || chatUser.username || 'User'}
          </h3>
          <p className="text-sm text-slate-400 max-w-[200px] break-words">{chatUser.bio || 'Hey, There I am using chat-app'}</p>
          <p className={`text-xs mt-2 font-medium ${isOnline(chatUser.lastSeen) ? 'text-green-400' : 'text-slate-500'}`}>
            {isOnline(chatUser.lastSeen) ? 'Online' : formatLastSeen(chatUser.lastSeen)}
          </p>
        </div>
        
        <hr className="border-slate-700/50 my-4" />
        
        <div className="mb-6">
          <p className="font-semibold text-slate-300 mb-3">Shared Media</p>
          <div className="grid grid-cols-3 gap-2">
            {mediaImages.length > 0 ? (
              mediaImages.map((msg) => (
                <img key={msg.id} src={msg.image} className="w-full aspect-square object-cover rounded-lg cursor-pointer hover:opacity-80 transition-opacity" alt="" onClick={() => window.open(msg.image, '_blank')} />
              ))
            ) : (
              <p className="col-span-3 text-sm text-slate-500 text-center py-4 bg-slate-800/50 rounded-lg">No shared media yet</p>
            )}
          </div>
        </div>

        {/* ── Theme / Wallpaper section ── */}
        <div className="mb-6">
          <hr className="border-slate-700/50 mb-4" />
          <p className="font-semibold text-slate-300 mb-3 flex items-center gap-2">
            <span>🎨</span> Chat Wallpaper
          </p>
          <div className="grid grid-cols-4 gap-2">
            {(wallpapers || []).map((wp) => (
              <button
                key={wp.id}
                title={wp.label}
                onClick={() => setWallpaperById(wp.id)}
                className={`relative h-12 rounded-xl overflow-hidden border-2 transition-all ${
                  wallpaperId === wp.id
                    ? 'border-indigo-500 scale-105 shadow-lg shadow-indigo-500/30'
                    : 'border-slate-700 hover:border-slate-500'
                }`}
                style={wp.style}
              >
                {wallpaperId === wp.id && (
                  <span className="absolute inset-0 flex items-center justify-center text-xs text-white drop-shadow">
                    ✓
                  </span>
                )}
              </button>
            ))}
          </div>
          <div className="mt-2 flex items-center gap-2">
            <div
              className="w-8 h-8 rounded-lg border border-slate-600 flex-shrink-0"
              style={wallpaperStyle}
            />
            <p className="text-xs text-slate-400">
              {(wallpapers || []).find(w => w.id === wallpaperId)?.label || 'Default'}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-3 mt-auto pt-4">
          <button 
            className={`w-full py-2.5 rounded-xl border text-sm font-medium transition-colors ${blocked ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700' : 'bg-red-500/10 border-red-500/20 text-red-500 hover:bg-red-500/20'}`} 
            onClick={handleBlock}
          >
            {blocked ? '✅ Unblock User' : '🚫 Block User'}
          </button>
          <button 
            className="w-full py-2.5 bg-yellow-500/10 border border-yellow-500/20 text-yellow-500 rounded-xl text-sm font-medium transition-colors hover:bg-yellow-500/20" 
            onClick={() => setShowReportModal(true)}
          >
            ⚠️ Report User
          </button>
        </div>

        {/* Report Modal */}
        {showReportModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center" onClick={() => setShowReportModal(false)}>
            <div className="bg-slate-800 border border-slate-700 p-6 rounded-2xl shadow-2xl max-w-sm w-full mx-4 flex flex-col" onClick={(e) => e.stopPropagation()}>
              <h4 className="text-xl font-semibold text-white mb-1">Report User</h4>
              <p className="text-slate-400 text-sm mb-5">
                Report <span className="font-medium text-slate-300">{chatUser.name || chatUser.username || 'this user'}</span> for inappropriate behavior
              </p>

              <label className="text-sm font-medium text-slate-300 mb-1">Reason</label>
              <select
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-500 mb-4"
              >
                <option value="">Select a reason...</option>
                {REPORT_REASONS.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>

              <label className="text-sm font-medium text-slate-300 mb-1">Description (optional)</label>
              <textarea
                value={reportDescription}
                onChange={(e) => setReportDescription(e.target.value)}
                placeholder="Describe the issue..."
                rows={3}
                className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-500 mb-6 resize-none"
              />

              <div className="flex gap-3">
                <button className="flex-1 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-xl transition-colors font-medium text-sm" onClick={() => setShowReportModal(false)}>Cancel</button>
                <button className="flex-1 py-2 bg-yellow-600 hover:bg-yellow-500 text-white rounded-xl transition-colors font-medium text-sm" onClick={handleReport}>Submit Report</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ─── Welcome State ───
  return (
    <div className="w-full md:w-[300px] lg:w-[340px] h-[50vh] md:h-full bg-slate-900 border-l border-slate-700/50 flex flex-col flex-shrink-0 transition-all overflow-y-auto custom-scrollbar p-6">
      {/* Logo + welcome text */}
      <div className="flex flex-col items-center text-center pt-8 pb-6">
        <img src={assets.logo_icon} className="w-16 mb-4 opacity-50 mix-blend-screen" alt="" />
        <h3 className="text-xl font-bold text-slate-200 mb-1">Welcome to Chatapp</h3>
        <p className="text-slate-400 text-sm max-w-[200px] mb-6">Select a user or room to start chatting</p>
        <button
          onClick={() => logout()}
          className="px-6 py-2 border border-slate-700 text-slate-300 rounded-full hover:bg-slate-800 transition-colors text-sm font-medium"
        >
          Logout
        </button>
      </div>

      <hr className="border-slate-700/50 mb-6" />

      {/* ── Theme section always visible ── */}
      <div>
        <p className="font-semibold text-slate-300 mb-3 flex items-center gap-2">
          <span>🎨</span> Chat Wallpaper
        </p>
        <div className="grid grid-cols-4 gap-2 mb-3">
          {(wallpapers || []).map((wp) => (
            <button
              key={wp.id}
              title={wp.label}
              onClick={() => setWallpaperById(wp.id)}
              className={`relative h-12 rounded-xl overflow-hidden border-2 transition-all ${
                wallpaperId === wp.id
                  ? 'border-indigo-500 scale-105 shadow-lg shadow-indigo-500/30'
                  : 'border-slate-700 hover:border-slate-500'
              }`}
              style={wp.style}
            >
              {wallpaperId === wp.id && (
                <span className="absolute inset-0 flex items-center justify-center text-xs text-white drop-shadow">
                  ✓
                </span>
              )}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-lg border border-slate-600 flex-shrink-0"
            style={wallpaperStyle}
          />
          <p className="text-xs text-slate-400">
            Current: <span className="text-slate-300">{(wallpapers || []).find(w => w.id === wallpaperId)?.label || 'Default'}</span>
          </p>
        </div>
      </div>
    </div>
  );
}

export default UserPanel
