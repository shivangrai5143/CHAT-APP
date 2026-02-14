import React, { useEffect, useState } from "react";
import "./ProfileUpdate.css";
import assets from "../../assets/assets";
import { uploadImageToCloudinary } from "../../lib/cloudinary";
import { doc, updateDoc, getDoc } from "firebase/firestore";
import { auth, db } from "../../config/firebase";
import { onAuthStateChanged } from "firebase/auth";

const ProfileUpdate = () => {
  const [imageFile, setImageFile] = useState(null);

  const [avatarUrl, setAvatarUrl] = useState("");

  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) return;

      try {
        const userDocRef = doc(db, "users", user.uid);
        const docSnap = await getDoc(userDocRef);

        if (docSnap.exists()) {
          const userData = docSnap.data();

          setName(userData.name || "");
          setBio(userData.bio || "");

          if (userData.avatar) {
            setAvatarUrl(userData.avatar);
          }
        }
      } catch (error) {
        console.log("Error fetching user:", error);
      }
    });

    return () => unsubscribe();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name || !bio) return;

    try {
      setLoading(true);

      let updatedData = {
        name,
        bio,
      };

      if (imageFile) {
        const imageUrl = await uploadImageToCloudinary(imageFile);
        updatedData.avatar = imageUrl;
      }

      await updateDoc(doc(db, "users", auth.currentUser.uid), updatedData);

      alert("Profile updated successfully!");
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
