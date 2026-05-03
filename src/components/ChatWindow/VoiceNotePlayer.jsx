/**
 * VoiceNotePlayer.jsx
 * Compact audio player with animated waveform bars and duration counter.
 */

import React, { useState, useRef, useEffect } from 'react';

// Static waveform heights for decoration
const WAVE = [4, 7, 11, 8, 14, 10, 6, 13, 9, 5, 12, 8, 15, 7, 11, 6, 9, 13, 7, 5];

const fmt = (s) => {
  const m = Math.floor(s / 60).toString().padStart(2, '0');
  const sec = (s % 60).toString().padStart(2, '0');
  return `${m}:${sec}`;
};

const VoiceNotePlayer = ({ url, duration: initDuration = 0, isSelf = false }) => {
  const [playing, setPlaying]   = useState(false);
  const [current, setCurrent]   = useState(0);
  const [total, setTotal]       = useState(initDuration);
  const audioRef = useRef(null);

  useEffect(() => {
    if (!url) return;
    const audio = new Audio(url);
    audioRef.current = audio;

    audio.onloadedmetadata = () => {
      if (isFinite(audio.duration) && audio.duration > 0) {
        setTotal(Math.ceil(audio.duration));
      }
    };
    audio.ontimeupdate = () => setCurrent(Math.floor(audio.currentTime));
    audio.onended      = () => { setPlaying(false); setCurrent(0); };

    return () => { audio.pause(); audio.src = ''; };
  }, [url]);

  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) { a.pause(); } else { a.play().catch(() => {}); }
    setPlaying((p) => !p);
  };

  const progress = total > 0 ? (current / total) * 100 : 0;
  const activeColor = isSelf ? 'bg-white' : 'bg-indigo-400';
  const inactiveColor = isSelf ? 'bg-white/35' : 'bg-slate-500';

  return (
    <div className="flex items-center gap-2.5 py-1 min-w-[180px] max-w-[240px]">
      {/* Play / Pause */}
      <button
        onClick={toggle}
        className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-all
          ${isSelf ? 'bg-white/20 hover:bg-white/35' : 'bg-indigo-500/20 hover:bg-indigo-500/35'}`}
      >
        {playing ? (
          <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
            <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
          </svg>
        ) : (
          <svg className="w-4 h-4 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z" />
          </svg>
        )}
      </button>

      {/* Waveform + timer */}
      <div className="flex-1 flex flex-col gap-1">
        <div className="flex items-center gap-[2px] h-[18px]">
          {WAVE.map((h, i) => {
            const isActive = (i / WAVE.length) * 100 <= progress;
            return (
              <div
                key={i}
                className={`w-[2px] rounded-full transition-colors duration-100 ${isActive ? activeColor : inactiveColor}`}
                style={{ height: h }}
              />
            );
          })}
        </div>
        <span className={`text-[11px] ${isSelf ? 'text-white/70' : 'text-slate-400'}`}>
          {playing ? fmt(current) : fmt(total)}
        </span>
      </div>

      {/* Mic icon */}
      <svg className={`w-3.5 h-3.5 flex-shrink-0 ${isSelf ? 'text-white/50' : 'text-slate-500'}`}
        fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3zM19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8" />
      </svg>
    </div>
  );
};

export default VoiceNotePlayer;
