import React, { useContext } from 'react';
import './LeftSidebar.css';
import assets from '../../assets/assets';
import { AppContext } from '../../context/AppContextProvider';
import { useNavigate } from 'react-router-dom';
import { logout } from '../../config/firebase';

const LeftSidebar = () => {
  const { userData } = useContext(AppContext);
  const navigate = useNavigate();

  return (
    <div className='ls'>
      <div className="ls-top">
        <div className="ls-nav">
          <img src={assets.logo} className='logo' alt="Logo" />
          <div className="menu">
            <img src={userData?.avatar || assets.menu_icon} alt="" className="user-avatar" />
            <div className="sub-menu">
              <p onClick={() => navigate('/profile')}>Edit Profile</p>
              <hr />
              <p onClick={() => logout()}>Logout</p>
            </div>
          </div>
        </div>
        <div className="ls-search">
          <img src={assets.search_icon} alt="Search Icon" />
          <input type="text" placeholder='Search here...' />
        </div>
      </div>
      <div className="ls-list">
        {Array(10).fill("").map((item, index) => (
          <div key={index} className="friends">
            <img src={assets.profile_img} alt="Profile Icon" />
            <div>
              <p>Shivang Rai</p>
              <span>Hello , How are you?</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default LeftSidebar;
