# 💬 Real-Time Chat Applicationnn

A full-stack **real-time chat application** built with **React.js, Firebase, and WebRTC**, designed for seamless, secure, and instant communication.

Users can sign up, log in, chat in real time, share media, and now **make one-to-one voice and video calls**.

---

# 🚀 Features

### 🔑 Authentication

* Firebase Authentication (Email/Password, Google Sign-In)
* Secure user login & session management

---

### 💬 Chat System

* One-to-One & Group Chat
* Real-time messaging using Firebase Firestore
* Typing indicators
* Message timestamps & read receipts

---

### 👀 Presence System

* Online / Offline status tracking
* Real-time updates

---

### 🖼️ Media Sharing

* Image & file sharing support (Cloudinary integration)

---

### 📊 Status / Stories

* WhatsApp-like status feature (24-hour expiry)
* Viewer tracking

---

### 🎥 Voice & Video Calling (NEW 🚀)

* One-to-one **video and voice calling using WebRTC**
* Peer-to-peer communication (low latency)
* Firebase used as signaling server
* Secure media transmission (DTLS-SRTP encryption)
* Call controls:

  * Mute / Unmute
  * Toggle camera
  * End call
* Incoming call notification system

---

### 🔐 End-to-End Encryption (E2EE)

* Messages encrypted using **AES + RSA (Web Crypto API)**
* Only sender and receiver can read messages

---

### 🎨 UI/UX Features

* Responsive design (mobile + desktop)
* Modern chat interface
* Emoji support
* Toast notifications

---

# 🛠️ Tech Stack

### Frontend

* React.js (with Hooks)
* Vite (fast build tool)
* React Router DOM
* Tailwind CSS / Material UI
* Axios

---

### Backend & Realtime

* Firebase Firestore (real-time database)
* Firebase Authentication
* Firebase Cloud Messaging (for notifications)

---

### Communication

* **WebRTC** → Voice & Video Calling
* Firebase Firestore → Signaling layer

---

### Storage

* Cloudinary → Media uploads (images/videos)

---

### Security

* Web Crypto API → End-to-End Encryption (AES + RSA)

---

### Development Tools

* ESLint
* Nodemon

---

# 🧱 Architecture Overview

```text
Frontend (React + Vite)
        ↓
Firebase (Auth + Firestore + Realtime)
        ↓
WebRTC (Peer-to-Peer Media for Calls)
        ↓
Cloudinary (Media Storage)
```

---

# 📸 Screenshots

> Add your UI screenshots or GIFs here

* Chat UI
* Status UI
* Video Call Screen

---

# ⚙️ Setup & Installation

```bash
# Clone the repository
git clone https://github.com/your-username/chat-app.git

# Navigate to project
cd chat-app

# Install dependencies
npm install

# Start development server
npm run dev
```

---

# 🔑 Environment Variables

Create a `.env` file:

```env
VITE_FIREBASE_API_KEY=your_key
VITE_FIREBASE_AUTH_DOMAIN=your_domain
VITE_FIREBASE_PROJECT_ID=your_project
VITE_CLOUDINARY_URL=your_cloudinary_url
```

---

# 📌 Future Improvements

* 📲 Push Notifications (Firebase Cloud Messaging)
* 🌙 Dark Mode & Theme Customization
* 🎨 Chat Wallpapers
* 🔄 Multi-device sync
* 📊 Analytics Dashboard
* 👥 Group Video Calling
* ⚡ Socket.io backend for scalability
* 🧠 AI features (auto-reply, summarization)

---

# 💡 Key Highlights

* Real-time chat using Firebase
* Secure messaging with E2EE
* WebRTC-based video calling
* Scalable hybrid architecture ready

---

# 🤝 Contributing

Contributions are welcome! Feel free to fork this repo and submit a PR.

---

# 📜 License

This project is licensed under the MIT License.

---

# 💬 Author

**Shivang Rai**

---

⭐ If you like this project, give it a star!
