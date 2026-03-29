import React, { useContext, useState, useEffect } from 'react'
import assets from '../../assets/assets'
import './RightSidebar.css'
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

const RightSidebar = () => {
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
  } = useContext(AppContext);

  const [memberDetails, setMemberDetails] = useState([]);
  const [showAddMember, setShowAddMember] = useState(false);
  const [memberSearch, setMemberSearch] = useState('');
  const [memberSearchResults, setMemberSearchResults] = useState([]);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportDescription, setReportDescription] = useState('');

  const isAdmin = roomData?.admins?.includes(userData?.uid);

  // Load room member details
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

  // ─── Block / Report handlers ───
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

  // Room view
  if (chatType === "room" && roomData) {
    return (
      <div className='rs'>
        <div className="rs-profile">
          <div className="room-icon-large">👥</div>
          <h3>{roomData.name}</h3>
          <p>{roomData.members?.length || 0} members</p>
        </div>
        <hr />

        <div className="rs-members">
          <div className="rs-members-header">
            <p className="rs-members-title">Members</p>
            {isAdmin && (
              <button className="add-member-btn" onClick={() => setShowAddMember(!showAddMember)} title="Add member">
                {showAddMember ? '✕' : '＋'}
              </button>
            )}
          </div>

          {showAddMember && isAdmin && (
            <div className="add-member-search">
              <input
                type="text"
                placeholder="Search username..."
                value={memberSearch}
                onChange={searchUsersToAdd}
                autoFocus
              />
              {memberSearchResults.length > 0 && (
                <div className="add-member-results">
                  {memberSearchResults.map((user) => (
                    <div key={user.uid} className="add-member-item" onClick={() => addMemberToRoom(user.uid)}>
                      <img src={user.avatar || assets.profile_img} alt="" />
                      <span>{user.name || user.username || 'User'}</span>
                      <button>Add</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="rs-members-list">
            {memberDetails.map((member) => {
              const isMemberAdmin = roomData.admins?.includes(member.uid);
              const isSelf = member.uid === userData.uid;

              return (
                <div key={member.uid} className="rs-member">
                  <img src={member.avatar || assets.profile_img} alt="" />
                  <div className="member-info">
                    <span className="member-name">
                      {member.name || member.username || 'User'}
                      {isSelf && ' (You)'}
                      {isMemberAdmin && <span className="admin-badge">Admin</span>}
                    </span>
                    <span className={`member-status ${isOnline(member.lastSeen) ? 'online' : ''}`}>
                      {isOnline(member.lastSeen) ? '● Online' : formatLastSeen(member.lastSeen)}
                    </span>
                  </div>
                  {isAdmin && !isSelf && (
                    <div className="member-actions">
                      <button
                        className="member-action-btn"
                        onClick={() => toggleAdmin(member.uid)}
                        title={isMemberAdmin ? 'Remove admin' : 'Make admin'}
                      >
                        {isMemberAdmin ? '👑' : '⭐'}
                      </button>
                      <button
                        className="member-action-btn danger"
                        onClick={() => removeMember(member.uid)}
                        title="Remove member"
                      >✕</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {mediaImages.length > 0 && (
          <>
            <hr />
            <div className="rs-media">
              <p>Media</p>
              <div>
                {mediaImages.map((msg) => (
                  <img key={msg.id} src={msg.image} alt="" onClick={() => window.open(msg.image, '_blank')} />
                ))}
              </div>
            </div>
          </>
        )}
        <button className="leave-btn" onClick={leaveRoom}>Leave Room</button>
      </div>
    );
  }

  // 1-on-1 chat view
  if (chatUser) {
    const blocked = isBlocked(chatUser.uid);

    return (
      <div className='rs'>
        <div className="rs-profile">
          <img src={chatUser.avatar || assets.profile_img} alt="" />
          <h3>
            {chatUser.name || chatUser.username || 'User'}
          </h3>
          <p>{chatUser.bio || 'Hey, There I am using chat-app'}</p>
          <p className="rs-status">
            {isOnline(chatUser.lastSeen)
              ? '🟢 Online'
              : `⚪ ${formatLastSeen(chatUser.lastSeen)}`
            }
          </p>
        </div>
        <hr />
        <div className="rs-media">
          <p>Media</p>
          <div>
            {mediaImages.length > 0 ? (
              mediaImages.map((msg) => (
                <img key={msg.id} src={msg.image} alt="" onClick={() => window.open(msg.image, '_blank')} />
              ))
            ) : (
              <p className="no-media">No shared media yet</p>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="rs-actions">
          <button className={`action-btn ${blocked ? 'unblock' : 'block'}`} onClick={handleBlock}>
            {blocked ? '✅ Unblock User' : '🚫 Block User'}
          </button>
          <button className="action-btn report" onClick={() => setShowReportModal(true)}>
            ⚠️ Report User
          </button>
        </div>

        <button onClick={() => logout()}>Logout</button>

        {/* Report Modal */}
        {showReportModal && (
          <div className="report-overlay" onClick={() => setShowReportModal(false)}>
            <div className="report-modal" onClick={(e) => e.stopPropagation()}>
              <h4>Report User</h4>
              <p className="report-subtitle">
                Report {chatUser.name || chatUser.username || 'this user'} for inappropriate behavior
              </p>

              <label>Reason</label>
              <select
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
              >
                <option value="">Select a reason...</option>
                {REPORT_REASONS.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>

              <label>Description (optional)</label>
              <textarea
                value={reportDescription}
                onChange={(e) => setReportDescription(e.target.value)}
                placeholder="Describe the issue..."
                rows={3}
              />

              <div className="report-actions">
                <button className="report-cancel" onClick={() => setShowReportModal(false)}>Cancel</button>
                <button className="report-submit" onClick={handleReport}>Submit Report</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Welcome state
  return (
    <div className='rs'>
      <div className="rs-profile">
        <img src={assets.logo_icon} alt="" />
        <h3>Welcome to Chatapp</h3>
        <p>Select a user or room to get started</p>
      </div>
      <button onClick={() => logout()}>Logout</button>
    </div>
  );
}

export default RightSidebar
