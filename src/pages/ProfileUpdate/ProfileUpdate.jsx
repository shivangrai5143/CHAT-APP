import React, { useEffect, useState, useContext } from "react";
import "./ProfileUpdate.css";
import assets from "../../assets/assets";
import { uploadImageToCloudinary } from "../../lib/cloudinary";
import { doc, updateDoc } from "firebase/firestore";
import { auth, db } from "../../config/firebase";
import { useNavigate } from "react-router-dom";
import { AppContext } from "../../context/AppContextProvider";

const ProfileUpdate = () => {

  const [imageFile, setImageFile] = useState(null);
  const [avatarUrl, setAvatarUrl] = useState("");
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [loading, setLoading] = useState(false);

  const { userData, setUserData } = useContext(AppContext);
  const navigate = useNavigate();

  // Load user data from context
  useEffect(() => {

    if (!userData) return;

    setName(userData.name || "");
    setUsername(userData.username || "");
    setBio(userData.bio || "");
    setAvatarUrl(userData.avatar || "");

  }, [userData]);


  // Save profile
  const handleSubmit = async (e) => {

    e.preventDefault();
    if (!name || !bio) return;

    try {

      setLoading(true);

      let updatedData = {
        name,
        username: username.toLowerCase(),
        bio
      };

      // Upload new image if selected
      if (imageFile) {

        const imageUrl = await uploadImageToCloudinary(imageFile);
        updatedData.avatar = imageUrl;

      }

      const userRef = doc(db, "users", auth.currentUser.uid);

      await updateDoc(userRef, updatedData);

      // Update global context immediately
      setUserData(prev => ({
        ...prev,
        ...updatedData
      }));

      alert("Profile updated successfully!");

      navigate("/chat");

    } catch (err) {

      console.error(err);
      alert("Something went wrong");

    } finally {

      setLoading(false);

    }

  };


  return (
    <div className="profile">
      <div className="profile-container">

        <form onSubmit={handleSubmit}>

          <label htmlFor="avatar">

            <input
              type="file"
              id="avatar"
              accept=".png,.jpeg,.jpg"
              hidden
              onChange={(e) => setImageFile(e.target.files[0])}
            />

            <img
              src={
                imageFile
                  ? URL.createObjectURL(imageFile)
                  : avatarUrl || assets.avatar_icon
              }
              alt="profile"
            />

          </label>


          <input
            type="text"
            placeholder="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />


          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />


          <textarea
            placeholder="Write profile bio!"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            required
          />


          <button type="submit" disabled={loading}>
            {loading ? "Saving..." : "Save"}
          </button>

        </form>


        <img
          className="profile-pic"
          src={
            imageFile
              ? URL.createObjectURL(imageFile)
              : avatarUrl || assets.logo_icon
          }
          alt="preview"
        />

      </div>
    </div>
  );
};

export default ProfileUpdate;