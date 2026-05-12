/**
 * usePresence.js
 * Advanced presence system:
 *   - 'online'  → active within last 70 s
 *   - 'away'    → idle for >5 min (no mouse/keyboard activity)
 *   - 'offline' → lastSeen > 70 s ago
 *
 * Replaces the 60 s heartbeat in AppContextProvider.
 */

import { useEffect, useRef, useCallback } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../config/firebase';

const HEARTBEAT_MS   = 45_000;  // write to Firestore every 45 s while active
const IDLE_THRESHOLD = 300_000; // 5 min without interaction → 'away'
const IDLE_EVENTS    = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'visibilitychange'];

export const usePresence = (uid) => {
  const heartbeatRef  = useRef(null);
  const idleTimerRef  = useRef(null);
  const isAwayRef     = useRef(false);
  const lastActivityRef = useRef(Date.now());

  const writePresence = useCallback(async (status = 'online') => {
    if (!uid) return;
    try {
      await updateDoc(doc(db, 'users', uid), {
        lastSeen: Date.now(),
        presenceStatus: status,
      });
    } catch (_) { /* silent — non-critical */ }
  }, [uid]);

  /** Mark user as away after IDLE_THRESHOLD ms of inactivity. */
  const scheduleIdleCheck = useCallback(() => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(async () => {
      if (!isAwayRef.current) {
        isAwayRef.current = true;
        await writePresence('away');
      }
    }, IDLE_THRESHOLD);
  }, [writePresence]);

  /** On any user activity → mark online, reset idle timer. */
  const onActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
    if (isAwayRef.current) {
      isAwayRef.current = false;
      writePresence('online');
    }
    scheduleIdleCheck();
  }, [writePresence, scheduleIdleCheck]);

  useEffect(() => {
    if (!uid) return;

    // Immediately mark online
    writePresence('online');

    // Heartbeat — keeps lastSeen fresh for other users
    heartbeatRef.current = setInterval(() => {
      const status = isAwayRef.current ? 'away' : 'online';
      writePresence(status);
    }, HEARTBEAT_MS);

    // Activity listeners
    IDLE_EVENTS.forEach(evt => window.addEventListener(evt, onActivity, { passive: true }));
    scheduleIdleCheck();

    // Tab visibility
    const onVisibility = () => {
      if (!document.hidden) onActivity();
    };
    document.addEventListener('visibilitychange', onVisibility);

    // On page close
    const onUnload = () => writePresence('offline');
    window.addEventListener('beforeunload', onUnload);

    return () => {
      clearInterval(heartbeatRef.current);
      clearTimeout(idleTimerRef.current);
      IDLE_EVENTS.forEach(evt => window.removeEventListener(evt, onActivity));
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('beforeunload', onUnload);
      // Mark offline on unmount (component cleanup)
      writePresence('offline');
    };
  }, [uid]); // eslint-disable-line

  return null; // pure side-effect hook
};
