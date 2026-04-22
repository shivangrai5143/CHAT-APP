import React, { useEffect, useState, useContext } from "react";
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

  useEffect(() => {
    if (!userData) return;
    setName(userData.name || "");
    setUsername(userData.username || "");
    setBio(userData.bio || "");
    setAvatarUrl(userData.avatar || "");
  }, [userData]);

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

      if (imageFile) {
        const imageUrl = await uploadImageToCloudinary(imageFile);
        updatedData.avatar = imageUrl;
      }

      const userRef = doc(db, "users", auth.currentUser.uid);
      await updateDoc(userRef, updatedData);

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
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl shadow-2xl p-8 flex flex-col-reverse md:flex-row items-center gap-10">
        
        <form onSubmit={handleSubmit} className="flex-1 w-full space-y-5">
          <h2 className="text-2xl font-semibold text-white mb-6">Profile Details</h2>

          <div className="flex items-center gap-4 mb-6">
            <label htmlFor="avatar" className="cursor-pointer group relative">
              <input
                type="file"
                id="avatar"
                accept=".png,.jpeg,.jpg"
                hidden
                onChange={(e) => setImageFile(e.target.files[0])}
              />
              <img
                src={imageFile ? URL.createObjectURL(imageFile) : (avatarUrl || assets.avatar_icon)}
                alt="profile"
                className="w-16 h-16 rounded-full object-cover border-2 border-indigo-500 group-hover:opacity-75 transition-opacity"
              />
              <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="text-white text-xs">Edit</span>
              </div>
            </label>
            <p className="text-slate-400 text-sm">Upload profile picture</p>
          </div>

          <div className="space-y-1">
            <label className="text-sm text-slate-300 ml-1">Your name</label>
            <input
              type="text"
              placeholder="Your name"
              value={name || ""}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm text-slate-300 ml-1">Username</label>
            <input
              type="text"
              placeholder="Username"
              value={username || ""}
              onChange={(e) => setUsername(e.target.value)}
              required
              className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm text-slate-300 ml-1">Profile bio</label>
            <textarea
              placeholder="Write profile bio!"
              value={bio || ""}
              onChange={(e) => setBio(e.target.value)}
              required
              rows={4}
              className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full sm:w-auto px-8 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl shadow-lg shadow-indigo-500/30 font-medium transition-all active:scale-95 disabled:opacity-50"
          >
            {loading ? "Saving..." : "Save Profile"}
          </button>
        </form>

        <div className="flex-1 flex justify-center w-full">
          <img
            className="w-48 h-48 md:w-64 md:h-64 rounded-full object-cover shadow-2xl border-4 border-white/10"
            src={imageFile ? URL.createObjectURL(imageFile) : (avatarUrl || assets.logo_icon)}
            alt="preview"
          />
        </div>

      </div>
    </div>
  );
};

export default ProfileUpdate;