import React, { useRef, useEffect, useState } from 'react';
import { useConnectionQuality } from '../../hooks/useConnectionQuality';
import { CALL_STATES } from '../../hooks/useCallStateManager';
import assets from '../../assets/assets';

/* ─── Quality indicator (3 bars) ─── */
const QualityBars = ({ bars, colorClass }) => (
  <div className="flex items-end gap-[2px]" title={`Connection quality`}>
    {[1, 2, 3].map((b) => (
      <div
        key={b}
        className={`w-[3px] rounded-sm transition-colors ${b <= bars ? colorClass : 'bg-slate-600'}`}
        style={{ height: b === 1 ? 6 : b === 2 ? 10 : 14 }}
      />
    ))}
  </div>
);

/* ─── Control button ─── */
const CtrlBtn = ({ onClick, active = true, danger = false, children, title, id }) => (
  <button
    id={id}
    onClick={onClick}
    title={title}
    className={`
      w-14 h-14 rounded-full flex items-center justify-center transition-all
      active:scale-90 focus:outline-none focus:ring-2 focus:ring-white/30
      ${danger
        ? 'bg-red-500 hover:bg-red-400 shadow-lg shadow-red-500/40'
        : active
          ? 'bg-white/15 hover:bg-white/25'
          : 'bg-red-500/80 hover:bg-red-500'
      }
    `}
  >
    {children}
  </button>
);

/* ─── Duration formatter ─── */
const fmt = (s) => {
  const m = Math.floor(s / 60).toString().padStart(2, '0');
  const sec = (s % 60).toString().padStart(2, '0');
  return `${m}:${sec}`;
};

/* ─── Status overlay message ─── */
const statusLabel = {
  [CALL_STATES.CALLING]:      'Calling…',
  [CALL_STATES.RINGING]:      'Connecting…',
  [CALL_STATES.CONNECTING]:   'Connecting…',
  [CALL_STATES.RECONNECTING]: 'Reconnecting…',
  [CALL_STATES.FAILED]:       'Call failed',
  [CALL_STATES.ENDED]:        'Call ended',
  [CALL_STATES.REJECTED]:     'Call declined',
};

/* ═══════════════════════════════════════════════════════════════════════════ */
const CallOverlay = ({
  callState,
  localStream,
  remoteStream,
  isVideoEnabled,
  isAudioEnabled,
  isCaller,
  pcRef,
  chatUser,       // { name, avatar } of the other person
  onEndCall,
  onToggleVideo,
  onToggleAudio,
}) => {
  const localVideoRef  = useRef(null);
  const remoteVideoRef = useRef(null);
  const [duration, setDuration] = useState(0);

  // Connection quality
  const { qualityBars, qualityColor } = useConnectionQuality(
    callState === CALL_STATES.ACTIVE ? pcRef?.current : null
  );

  // Attach streams to video elements
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  // Duration timer — starts when call becomes active
  useEffect(() => {
    if (callState !== CALL_STATES.ACTIVE) { setDuration(0); return; }
    const t = setInterval(() => setDuration((d) => d + 1), 1000);
    return () => clearInterval(t);
  }, [callState]);

  const isActive  = callState === CALL_STATES.ACTIVE;
  const isWaiting = [CALL_STATES.CALLING, CALL_STATES.RINGING, CALL_STATES.CONNECTING].includes(callState);
  const showVideo = isVideoEnabled && localStream?.getVideoTracks().length > 0;
  const peerName  = chatUser?.name || chatUser?.username || 'User';

  return (
    <div
      id="call-overlay"
      className="fixed inset-0 z-[100] bg-slate-950 flex flex-col animate-fadeIn"
    >
      {/* ── Remote video / waiting screen ─── */}
      <div className="flex-1 relative overflow-hidden bg-slate-900">

        {isActive && remoteStream ? (
          <video
            ref={remoteVideoRef}
            id="remote-video"
            autoPlay
            playsInline
            className="w-full h-full object-cover"
          />
        ) : (
          /* Waiting / connecting state */
          <div className="w-full h-full flex flex-col items-center justify-center gap-6">
            {/* Animated avatar ring */}
            <div className="relative">
              <span className="absolute inset-[-12px] rounded-full border-2 border-indigo-500/20 animate-ping" />
              <span className="absolute inset-[-6px]  rounded-full border-2 border-indigo-500/30 animate-pulse" />
              <img
                src={chatUser?.avatar || assets.profile_img}
                alt={peerName}
                className="relative w-28 h-28 rounded-full object-cover border-2 border-indigo-500/40 shadow-2xl"
              />
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-white mb-1">{peerName}</p>
              <p className="text-indigo-300 text-sm animate-pulse">
                {statusLabel[callState] || 'Please wait…'}
              </p>
            </div>
          </div>
        )}

        {/* ── Top status bar ─── */}
        <div className="absolute top-0 inset-x-0 flex items-center justify-between px-5 pt-5 pb-3 bg-gradient-to-b from-black/60 to-transparent">
          {/* Left: name + duration */}
          <div>
            <p className="text-white font-semibold text-lg leading-tight">{peerName}</p>
            <p className="text-slate-300 text-sm">
              {isActive ? fmt(duration) : statusLabel[callState] || ''}
            </p>
          </div>

          {/* Right: quality bars */}
          {isActive && (
            <QualityBars bars={qualityBars} colorClass={qualityColor} />
          )}
        </div>

        {/* ── Local video PiP (picture-in-picture, top-right) ─── */}
        {localStream && (
          <div className="absolute top-16 right-4 w-[110px] h-[150px] rounded-2xl overflow-hidden border border-white/10 shadow-xl bg-slate-800">
            {showVideo ? (
              <video
                ref={localVideoRef}
                id="local-video"
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
                style={{ transform: 'scaleX(-1)' }} /* mirror selfie view */
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-slate-400">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"
                    d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                </svg>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Control bar ─── */}
      <div className="flex-shrink-0 px-6 py-6 bg-gradient-to-t from-black/80 to-transparent flex items-center justify-center gap-5">

        {/* Mute / unmute */}
        <CtrlBtn
          id="toggle-audio-btn"
          onClick={onToggleAudio}
          active={isAudioEnabled}
          title={isAudioEnabled ? 'Mute' : 'Unmute'}
        >
          {isAudioEnabled ? (
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
          ) : (
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
            </svg>
          )}
        </CtrlBtn>

        {/* End call */}
        <CtrlBtn
          id="end-call-btn"
          onClick={onEndCall}
          danger
          title="End call"
        >
          <svg className="w-7 h-7 text-white rotate-[135deg]" fill="currentColor" viewBox="0 0 24 24">
            <path d="M6.62 10.79a15.053 15.053 0 006.59 6.59l2.2-2.2c.28-.28.67-.36 1.02-.25 1.12.37 2.33.57 3.57.57a1 1 0 011 1V20a1 1 0 01-1 1C10.61 21 3 13.39 3 4a1 1 0 011-1h3.5a1 1 0 011 1c0 1.25.2 2.45.57 3.57.1.36.01.74-.26 1.02l-2.19 2.2z"/>
          </svg>
        </CtrlBtn>

        {/* Video on/off (only for video calls) */}
        {localStream?.getVideoTracks().length > 0 && (
          <CtrlBtn
            id="toggle-video-btn"
            onClick={onToggleVideo}
            active={isVideoEnabled}
            title={isVideoEnabled ? 'Turn off camera' : 'Turn on camera'}
          >
            {isVideoEnabled ? (
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                  d="M15 10l4.553-2.276A1 1 0 0121 8.723v6.554a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
              </svg>
            ) : (
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                  d="M15 10l4.553-2.276A1 1 0 0121 8.723v6.554a1 1 0 01-1.447.894L15 14m-5 0H5a2 2 0 01-2-2V8a2 2 0 012-2h3m9 4l-9-6M3 3l18 18" />
              </svg>
            )}
          </CtrlBtn>
        )}
      </div>
    </div>
  );
};

export default CallOverlay;
