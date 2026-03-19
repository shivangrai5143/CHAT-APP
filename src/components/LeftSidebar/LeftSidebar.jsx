import React, { useContext, useState } from 'react';
import './LeftSidebar.css';
import assets from '../../assets/assets';
import { AppContext } from '../../context/AppContextProvider';
import { useNavigate } from 'react-router-dom';
import { logout } from '../../config/firebase';

import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../config/firebase';

const LeftSidebar = () => {

  const { userData } = useContext(AppContext);
  const navigate = useNavigate();
  const [searchResults, setSearchResults] = useState(null);

  const inputHandler = async (e) => {
    try {
      const input = e.target.value.trim();

  
      if (!input) {
        setSearchResults(null);
        return;
      }

      const userRef = collection(db, "users");

      
      const q = query(
        userRef,
        where("username", ">=", input.toLowerCase()),
        where("username", "<=", input.toLowerCase() + '\uf8ff')
      );

      const querySnap = await getDocs(q);

      if (!querySnap.empty) {
        const results = querySnap.docs
          .filter((doc) => doc.id !== userData?.id)  
          .map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));
        setSearchResults(results);
      } else {
        setSearchResults([]);
      }
    } catch (error) {
      console.error("Search error:", error);
    }
  };

  return (
    <div className='ls'>

      <div className="ls-top">

        <div className="ls-nav">

          <img src={assets.logo} className='logo' alt="Logo" />

          <div className="menu">

            <img
              src={userData?.avatar || assets.menu_icon}
              alt=""
              className="user-avatar"
            />

            <div className="sub-menu">
              <p onClick={() => navigate('/profile')}>Edit Profile</p>
              <hr />
              <p onClick={() => logout()}>Logout</p>
            </div>

          </div>

        </div>

        <div className="ls-search">
          <img src={assets.search_icon} alt="Search Icon" />
          <input
            onChange={inputHandler}
            type="text"
            placeholder='Search here...'
          />
        </div>

      </div>

      <div className="ls-list">

        {searchResults !== null ? (
          // Show search results
          searchResults.length > 0 ? (
            searchResults.map((user) => (
              <div
                key={user.id}
                className="friends"
                onClick={() => {
                  navigate(`/chat/${user.id}`);
                  setSearchResults(null);
                }}
              >
                <img src={user.avatar || assets.profile_img} alt="Profile" />
                <div>
                  <p>{user.name || user.username}</p>
                  <span>{user.bio || 'Hey there!'}</span>
                </div>
              </div>
            ))
          ) : (
            <div className="no-results" style={{ padding: '20px', textAlign: 'center', color: '#aaa', fontSize: '13px' }}>
              No users found
            </div>
          )
        ) : (
          // Show default placeholder list
          Array(10).fill("").map((item, index) => (
            <div key={index} className="friends">
              <img src={assets.profile_img} alt="Profile Icon" />
              <div>
                <p>Shivang Rai</p>
                <span>Hello , How are you?</span>
              </div>
            </div>
          ))
        )}

      </div>

    </div>
  );

};

export default LeftSidebar;