/**
 * useVoiceRecorder.js
 * MediaRecorder hook — records audio from mic, tracks duration.
 */

import { useState, useRef, useCallback } from 'react';

const PREFERRED_MIME = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg', 'audio/mp4'];

const getSupportedMime = () =>
  PREFERRED_MIME.find((m) => MediaRecorder.isTypeSupported(m)) || '';

export const useVoiceRecorder = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState(null);

  const mrRef     = useRef(null);   // MediaRecorder
  const streamRef = useRef(null);   // MediaStream
  const chunksRef = useRef([]);
  const timerRef  = useRef(null);
  const prevUrlRef = useRef(null);

  // ─── Start ────────────────────────────────────────────────────────────────
  const startRecording = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];

      const mimeType = getSupportedMime();
      const mr = new MediaRecorder(stream, mimeType ? { mimeType } : {});
      mrRef.current = mr;

      mr.ondataavailable = (e) => {
        if (e.data?.size > 0) chunksRef.current.push(e.data);
      };

      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType || 'audio/webm' });

        // Revoke old object URL to avoid memory leaks
        if (prevUrlRef.current) URL.revokeObjectURL(prevUrlRef.current);
        const url = URL.createObjectURL(blob);
        prevUrlRef.current = url;

        setAudioBlob(blob);
        setAudioUrl(url);
        stream.getTracks().forEach((t) => t.stop());
      };

      mr.start(100);
      setIsRecording(true);
      setDuration(0);
      setAudioBlob(null);
      setAudioUrl(null);

      timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000);
    } catch (err) {
      setError(err.message || 'Microphone access denied');
      console.error('[VoiceRecorder]', err);
    }
  }, []);

  // ─── Stop (save) ──────────────────────────────────────────────────────────
  const stopRecording = useCallback(() => {
    clearInterval(timerRef.current);
    if (mrRef.current?.state !== 'inactive') mrRef.current?.stop();
    setIsRecording(false);
  }, []);

  // ─── Cancel (discard) ─────────────────────────────────────────────────────
  const cancelRecording = useCallback(() => {
    clearInterval(timerRef.current);
    if (mrRef.current?.state !== 'inactive') mrRef.current?.stop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    chunksRef.current = [];
    setIsRecording(false);
    setAudioBlob(null);
    setAudioUrl(null);
    setDuration(0);
  }, []);

  // ─── Clear (after send) ───────────────────────────────────────────────────
  const clearRecording = useCallback(() => {
    setAudioBlob(null);
    setAudioUrl(null);
    setDuration(0);
    setError(null);
  }, []);

  return {
    isRecording,
    audioBlob,
    audioUrl,
    duration,
    error,
    startRecording,
    stopRecording,
    cancelRecording,
    clearRecording,
  };
};
