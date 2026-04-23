import React, { useEffect, useRef } from 'react';
import assets from '../../assets/assets';

/**
 * Generates a synthetic ringtone using the Web Audio API.
 * Returns a stop function. Falls back silently if AudioContext unavailable.
 */
const createRingtone = () => {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    let stopped = false;

    const ring = () => {
      if (stopped) return;
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.4);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.4);
      if (!stopped) setTimeout(ring, 1800);
    };

    ring();
    return () => { stopped = true; ctx.close().catch(() => {}); };
  } catch (_) {
    return () => {};
  }
};

const IncomingCallModal = ({ call, callerName, callerAvatar, onAccept, onReject }) => {
  const stopRingtoneRef = useRef(null);

  useEffect(() => {
    stopRingtoneRef.current = createRingtone();
    return () => stopRingtoneRef.current?.();
  }, []);

  const handleAccept = () => {
    stopRingtoneRef.current?.();
    onAccept(call);
  };

  const handleReject = () => {
    stopRingtoneRef.current?.();
    onReject(call.id);
  };

  const isVideo = call?.callType !== 'audio';

  return (
    /* Backdrop */
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      
      {/* Card */}
      <div className="w-full max-w-sm bg-slate-800/95 border border-slate-700/60 rounded-3xl shadow-2xl overflow-hidden">
        
        {/* Gradient header */}
        <div className="relative bg-gradient-to-b from-indigo-900/60 to-slate-800/0 px-6 pt-8 pb-6 flex flex-col items-center text-center">
          
          {/* Pulsing ring around avatar */}
          <div className="relative mb-4">
            <span className="absolute inset-0 rounded-full bg-indigo-500/30 animate-ping" />
            <span className="absolute inset-[-6px] rounded-full border-2 border-indigo-500/40 animate-pulse" />
            <img
              src={callerAvatar || assets.profile_img}
              alt={callerName}
              className="relative w-24 h-24 rounded-full object-cover border-2 border-indigo-500/50 shadow-lg"
            />
          </div>

          {/* Caller info */}
          <h2 className="text-xl font-bold text-white mb-1">{callerName || 'Unknown'}</h2>
          <p className="text-sm text-indigo-300 flex items-center gap-1.5">
            {isVideo ? (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                    d="M15 10l4.553-2.276A1 1 0 0121 8.723v6.554a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
                </svg>
                Incoming video call
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                    d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
                Incoming voice call
              </>
            )}
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex gap-4 px-8 pb-8">
          {/* Decline */}
          <button
            id="call-reject-btn"
            onClick={handleReject}
            className="flex-1 flex flex-col items-center gap-2 group"
          >
            <span className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-400 flex items-center justify-center shadow-lg shadow-red-500/30 transition-all group-hover:scale-105 active:scale-95">
              <svg className="w-7 h-7 text-white rotate-[135deg]" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6.62 10.79a15.053 15.053 0 006.59 6.59l2.2-2.2c.28-.28.67-.36 1.02-.25 1.12.37 2.33.57 3.57.57a1 1 0 011 1V20a1 1 0 01-1 1C10.61 21 3 13.39 3 4a1 1 0 011-1h3.5a1 1 0 011 1c0 1.25.2 2.45.57 3.57.1.36.01.74-.26 1.02l-2.19 2.2z"/>
              </svg>
            </span>
            <span className="text-xs text-slate-400 font-medium">Decline</span>
          </button>

          {/* Accept */}
          <button
            id="call-accept-btn"
            onClick={handleAccept}
            className="flex-1 flex flex-col items-center gap-2 group"
          >
            <span className="w-16 h-16 rounded-full bg-green-500 hover:bg-green-400 flex items-center justify-center shadow-lg shadow-green-500/30 transition-all group-hover:scale-105 active:scale-95">
              {isVideo ? (
                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5"
                    d="M15 10l4.553-2.276A1 1 0 0121 8.723v6.554a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
                </svg>
              ) : (
                <svg className="w-7 h-7 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6.62 10.79a15.053 15.053 0 006.59 6.59l2.2-2.2c.28-.28.67-.36 1.02-.25 1.12.37 2.33.57 3.57.57a1 1 0 011 1V20a1 1 0 01-1 1C10.61 21 3 13.39 3 4a1 1 0 011-1h3.5a1 1 0 011 1c0 1.25.2 2.45.57 3.57.1.36.01.74-.26 1.02l-2.19 2.2z"/>
                </svg>
              )}
            </span>
            <span className="text-xs text-slate-400 font-medium">Accept</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default IncomingCallModal;
