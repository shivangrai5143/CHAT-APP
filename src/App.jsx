import React, { useContext, useEffect, lazy, Suspense } from "react";
import { Route, Routes, useNavigate } from "react-router-dom";
import Login from "./pages/Login/Login";
import Chat from "./pages/Chat/Chat";
import ProfileUpdate from "./pages/ProfileUpdate/ProfileUpdate";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "./config/firebase";
import { AppContext } from "./context/AppContextProvider";
import CallOverlay from "./components/Call/CallOverlay";
import IncomingCallModal from "./components/Call/IncomingCallModal";
import { CALL_STATES } from "./hooks/useCallStateManager";
import SettingsPage from "./pages/Settings/SettingsPage";

// Lazy-loaded heavy pages
const AdminDashboard = lazy(() => import('./pages/Admin/AdminDashboard'));

const PageLoader = () => (
  <div className="min-h-screen bg-slate-950 flex items-center justify-center">
    <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
  </div>
);

const App = () => {
  const navigate = useNavigate();

  const {
    loadUserData,
    initEncryption,
    // Call system
    callState,
    localStream,
    remoteStream,
    isVideoEnabled,
    isAudioEnabled,
    isCaller,
    pcRef,
    chatUser,
    endCall,
    toggleVideo,
    toggleAudio,
    isScreenSharing,
    toggleScreenShare,
    isRecordingCall,
    toggleCallRecording,
    incomingCall,
    handleAnswerCall,
    handleRejectCall,
  } = useContext(AppContext);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        await loadUserData(user.uid, true);
        initEncryption(user.uid);
      } else {
        navigate("/");
      }
    });
    return () => unsubscribe();
  }, []); // eslint-disable-line

  // Determine whether the call overlay should be visible
  const showOverlay = callState && callState !== CALL_STATES.IDLE;

  return (
    <>
      <ToastContainer />

      <Routes>
        <Route path="/"          element={<Login />} />
        <Route path="/chat"      element={<Chat />} />
        <Route path="/profile"   element={<ProfileUpdate />} />
        <Route path="/settings"  element={<SettingsPage />} />
        <Route path="/analytics" element={<Suspense fallback={<PageLoader />}><AdminDashboard /></Suspense>} />
      </Routes>

      {/* ── Incoming call notification ── */}
      {incomingCall && (
        <IncomingCallModal
          call={incomingCall}
          callerName={incomingCall.callerName}
          callerAvatar={incomingCall.callerAvatar}
          onAccept={handleAnswerCall}
          onReject={handleRejectCall}
        />
      )}

      {/* ── Active / outgoing call overlay ── */}
      {showOverlay && (
        <CallOverlay
          callState={callState}
          localStream={localStream}
          remoteStream={remoteStream}
          isVideoEnabled={isVideoEnabled}
          isAudioEnabled={isAudioEnabled}
          isScreenSharing={isScreenSharing}
          isRecordingCall={isRecordingCall}
          isCaller={isCaller}
          pcRef={pcRef}
          chatUser={chatUser}
          onEndCall={endCall}
          onToggleVideo={toggleVideo}
          onToggleAudio={toggleAudio}
          onToggleScreenShare={toggleScreenShare}
          onToggleRecording={toggleCallRecording}
        />
      )}
    </>
  );
};

export default App;
