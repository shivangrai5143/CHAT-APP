import React, { useContext, useState, useEffect } from 'react'
import assets from '../../assets/assets'
import './RightSidebar.css'
import { logout } from '../../config/firebase'
import { AppContext } from '../../context/AppContextProvider'
import { doc, getDoc, updateDoc, arrayRemove } from 'firebase/firestore'
import { db } from '../../config/firebase'

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
  } = useContext(AppContext);

  const [memberDetails, setMemberDetails] = useState([]);

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

  // Extract images from messages for media gallery
  const mediaImages = messages.filter((msg) => msg.image);

  const isOnline = (lastSeen) => lastSeen && Date.now() - lastSeen < 70000;

  const leaveRoom = async () => {
    if (!roomData?.id || !userData?.uid) return;
    try {
      const roomRef = doc(db, "rooms", roomData.id);
      await updateDoc(roomRef, {
        members: arrayRemove(userData.uid),
      });
      setMessagesId(null);
      setChatType("user");
      setChatUser(null);
      setRoomData(null);
    } catch (error) {
      console.error("Error leaving room:", error);
    }
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
          <p className="rs-members-title">Members</p>
          <div className="rs-members-list">
            {memberDetails.map((member) => (
              <div key={member.uid} className="rs-member">
                <img src={member.avatar || assets.profile_img} alt="" />
                <div>
                  <span className="member-name">
                    {member.name || member.username || 'User'}
                    {member.uid === userData.uid && ' (You)'}
                  </span>
                  <span className={`member-status ${isOnline(member.lastSeen) ? 'online' : ''}`}>
                    {isOnline(member.lastSeen) ? '● Online' : '○ Offline'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
        {mediaImages.length > 0 && (
          <>
            <hr />
            <div className="rs-media">
              <p>Media</p>
              <div>
                {mediaImages.map((msg) => (
                  <img
                    key={msg.id}
                    src={msg.image}
                    alt=""
                    onClick={() => window.open(msg.image, '_blank')}
                  />
                ))}
              </div>
            </div>
          </>
        )}
        <button className="leave-btn" onClick={leaveRoom}>
          Leave Room
        </button>
      </div>
    );
  }

  // 1-on-1 chat view
  if (chatUser) {
    return (
      <div className='rs'>
        <div className="rs-profile">
          <img src={chatUser.avatar || assets.profile_img} alt="" />
          <h3>
            {chatUser.name || chatUser.username || 'User'}{' '}
            {isOnline(chatUser.lastSeen) && (
              <img src={assets.green_dot} className='dot' alt="" />
            )}
          </h3>
          <p>{chatUser.bio || 'Hey, There I am using chat-app'}</p>
          <p className="rs-status">
            {isOnline(chatUser.lastSeen) ? '🟢 Online' : '⚪ Offline'}
          </p>
        </div>
        <hr />
        <div className="rs-media">
          <p>Media</p>
          <div>
            {mediaImages.length > 0 ? (
              mediaImages.map((msg) => (
                <img
                  key={msg.id}
                  src={msg.image}
                  alt=""
                  onClick={() => window.open(msg.image, '_blank')}
                />
              ))
            ) : (
              <p className="no-media">No shared media yet</p>
            )}
          </div>
        </div>
        <button onClick={() => logout()}>
          Logout
        </button>
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
      <button onClick={() => logout()}>
        Logout
      </button>
    </div>
  );
}

export default RightSidebar
