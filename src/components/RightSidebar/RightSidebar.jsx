import React, { useContext } from 'react'
import assets from '../../assets/assets'
import './RightSidebar.css'
import { logout } from '../../config/firebase'
import { AppContext } from '../../context/AppContextProvider'

const RightSidebar = () => {
  const { chatUser } = useContext(AppContext);

  return (
    <div className='rs'>
      {chatUser ? (
        <>
          <div className="rs-profile">
            <img src={chatUser.avatar || assets.profile_img} alt="" />
            <h3>
              {chatUser.name || chatUser.username || 'User'}{' '}
              {chatUser.lastSeen && Date.now() - chatUser.lastSeen < 70000 && (
                <img src={assets.green_dot} className='dot' alt="" />
              )}
            </h3>
            <p>{chatUser.bio || 'Hey, There I am using chat-app'}</p>
          </div>
          <hr />
          <div className="rs-media">
            <p>Media</p>
            <div>
              {/* Media images will be populated from shared images in chat */}
            </div>
          </div>
        </>
      ) : (
        <div className="rs-profile">
          <img src={assets.logo_icon} alt="" />
          <h3>Welcome to Chatapp</h3>
          <p>Select a user to view their profile</p>
        </div>
      )}
      <button onClick={() => logout()}>
        Logout
      </button>
    </div>
  )
}

export default RightSidebar
