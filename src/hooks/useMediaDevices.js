import { useState, useCallback, useEffect, useRef } from 'react';

const DEFAULT_VIDEO_CONSTRAINTS = {
  width:     { ideal: 1280 },
  height:    { ideal: 720 },
  frameRate: { ideal: 30 },
};

const DEFAULT_AUDIO_CONSTRAINTS = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl:  true,
};

export const useMediaDevices = () => {
  const [localStream,    setLocalStream]    = useState(null);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [mediaError,     setMediaError]     = useState(null);
  const [devices,        setDevices]        = useState({ audio: [], video: [] });

  // Keep a ref so callbacks have the current stream without stale closure issues
  const streamRef = useRef(null);

  const enumerateDevices = useCallback(async () => {
    try {
      const list = await navigator.mediaDevices.enumerateDevices();
      setDevices({
        audio: list.filter((d) => d.kind === 'audioinput'),
        video: list.filter((d) => d.kind === 'videoinput'),
      });
    } catch (_) {
      // Non-critical
    }
  }, []);

  // Request camera + mic (or audio-only).
  // Returns the MediaStream so callers can immediately use it.
  const getMediaStream = useCallback(async (constraints = {}) => {
    try {
      setMediaError(null);

      const resolved = {
        video: constraints.video === false
          ? false
          : { ...DEFAULT_VIDEO_CONSTRAINTS, ...(typeof constraints.video === 'object' ? constraints.video : {}) },
        audio: constraints.audio === false
          ? false
          : { ...DEFAULT_AUDIO_CONSTRAINTS, ...(typeof constraints.audio === 'object' ? constraints.audio : {}) },
      };

      const stream = await navigator.mediaDevices.getUserMedia(resolved);

      setLocalStream(stream);
      streamRef.current = stream;

      // Sync enabled flags from actual track state
      setIsVideoEnabled(stream.getVideoTracks()[0]?.enabled ?? false);
      setIsAudioEnabled(stream.getAudioTracks()[0]?.enabled ?? true);

      await enumerateDevices();
      return stream;
    } catch (err) {
      let friendlyMessage = 'Could not access camera or microphone.';
      if (err.name === 'NotAllowedError')   friendlyMessage = 'Permission denied. Allow camera/mic access and try again.';
      if (err.name === 'NotFoundError')     friendlyMessage = 'No camera or microphone found.';
      if (err.name === 'NotReadableError')  friendlyMessage = 'Camera/mic is already in use by another app.';
      if (err.name === 'OverconstrainedError') friendlyMessage = 'Camera does not support the requested quality.';

      setMediaError({ name: err.name, message: friendlyMessage });
      throw err;
    }
  }, [enumerateDevices]);

  // Stop all tracks and clear stream
  const stopMediaStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      setLocalStream(null);
      setIsVideoEnabled(true);
      setIsAudioEnabled(true);
    }
  }, []);

  const toggleVideo = useCallback(() => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return false;
    track.enabled = !track.enabled;
    setIsVideoEnabled(track.enabled);
    return track.enabled;
  }, []);

  const toggleAudio = useCallback(() => {
    const track = streamRef.current?.getAudioTracks()[0];
    if (!track) return false;
    track.enabled = !track.enabled;
    setIsAudioEnabled(track.enabled);
    return track.enabled;
  }, []);

  // Replace the video track in an existing peer connection (camera switch)
  const replaceVideoTrack = useCallback(async (peerConnection, facingMode = 'user') => {
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { ...DEFAULT_VIDEO_CONSTRAINTS, facingMode },
        audio: false,
      });
      const newTrack  = newStream.getVideoTracks()[0];
      const sender    = peerConnection?.getSenders().find((s) => s.track?.kind === 'video');
      if (sender) await sender.replaceTrack(newTrack);

      // Swap the video track in localStream
      if (streamRef.current) {
        const oldTrack = streamRef.current.getVideoTracks()[0];
        if (oldTrack) {
          oldTrack.stop();
          streamRef.current.removeTrack(oldTrack);
        }
        streamRef.current.addTrack(newTrack);
        setLocalStream(new MediaStream(streamRef.current.getTracks()));
      }
    } catch (err) {
      console.error('[useMediaDevices] replaceVideoTrack error:', err);
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return {
    localStream,
    isVideoEnabled,
    isAudioEnabled,
    mediaError,
    devices,
    getMediaStream,
    stopMediaStream,
    toggleVideo,
    toggleAudio,
    replaceVideoTrack,
  };
};
