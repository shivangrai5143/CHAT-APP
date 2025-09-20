import React from 'react';
import './LeftSidebar.css';
import assets from '../../assets/assets';

const LeftSidebar = () => {
  return (
    <div className='ls'>
      <div className="ls-top">
        <div className="ls-nav">
          <img src={assets.logo} className='logo' alt="Logo"/>
          <div className="menu">
            <img src={assets.menu_icon} alt="Menu Icon"/>
          </div>
        </div>
        <div className="ls-search">
          <img src={assets.search_icon} alt="Search Icon"/>
          <input type="text" placeholder='Search here...' />
        </div>
      </div>
      <div className="ls-list">
        <div className="friends">
            <img src={assets.profile_img} alt="Profile Icon"/>
            <div>
              <p>Shivang Rai</p>
              <span>Hello , How are you?</span>
            </div>
        </div>
      </div>
    </div>
  )
}

export default LeftSidebar;
