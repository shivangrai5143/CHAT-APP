/**
 * useWebRTCCall.js
 *
 * Central orchestrator for WebRTC video/voice calls.
 * Composes: useMediaDevices, usePeerConnection, SignalingService.
 *
 * Exposed from AppContext so any component can:
 *   - startCall(receiverId, 'video' | 'audio')
 *   - answerCall(incomingCallId, incomingCallData)
 *   - rejectCall(callId)
 *   - endCall()
 *   - toggleVideo() / toggleAudio()
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { useMediaDevices }    from './useMediaDevices';
import { usePeerConnection }  from './usePeerConnection';
import { CALL_STATES }        from './useCallStateManager';
import { SignalingService }   from '../services/signalingService';

export const useWebRTCCall = (userId) => {

  // ─── Sub-hooks ──────────────────────────────────────────────────────────────
  const {
    localStream, isVideoEnabled, isAudioEnabled,
    getMediaStream, stopMediaStream, toggleVideo, toggleAudio,
  } = useMediaDevices();

  const {
    connectionState, iceConnectionState,
    createPeerConnection, closePeerConnection, pcRef,
  } = usePeerConnection();

  // ─── Call state ─────────────────────────────────────────────────────────────
  const [callState,    setCallState]    = useState(CALL_STATES.IDLE);
  const [callId,       setCallId]       = useState(null);
  const [isCaller,     setIsCaller]     = useState(false);
  const [remoteStream, setRemoteStream] = useState(null);

  // ─── Refs (prevent stale closures inside async callbacks) ───────────────────
  const callIdRef        = useRef(null);  // mirrors callId state
  const isCallerRef      = useRef(false); // mirrors isCaller state
  const signalingRef     = useRef(null);  // SignalingService instance
  const unsubscribersRef = useRef([]);    // all active Firestore listeners

  // To avoid infinite loops caused by SDP normalization when comparing strings:
  const lastProcessedOfferSdpRef = useRef(null);
  const lastProcessedAnswerSdpRef = useRef(null);

  // ICE candidates that arrive before remote description is set
  const pendingCandidatesRef = useRef([]);

  // ─── Signaling service ──────────────────────────────────────────────────────
  useEffect(() => {
    if (userId) {
      signalingRef.current = new SignalingService(userId);
    }
  }, [userId]);

  // ─── Helpers ────────────────────────────────────────────────────────────────

  /** Safely set callId in both state and ref. */
  const _setCallId = (id) => {
    callIdRef.current = id;
    setCallId(id);
  };

  /** Push a listener's unsubscribe fn so it's cleaned up on endCall. */
  const _addUnsub = (fn) => unsubscribersRef.current.push(fn);

  /** Add a remote ICE candidate, buffering if remoteDescription isn't ready. */
  const _addIceCandidate = async (pc, candidateData) => {
    try {
      if (!pc.remoteDescription) {
        pendingCandidatesRef.current.push(candidateData);
        return;
      }
      await pc.addIceCandidate(new RTCIceCandidate(candidateData));
    } catch (e) {
      console.warn('[WebRTC] addIceCandidate failed (non-fatal):', e.message);
    }
  };

  /** Flush any buffered ICE candidates after setting remote description. */
  const _flushPendingCandidates = async (pc) => {
    for (const c of pendingCandidatesRef.current) {
      await pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {});
    }
    pendingCandidatesRef.current = [];
  };

  /** Wire the ontrack handler — fires when remote media arrives. */
  const _setupRemoteTrack = (pc) => {
    pc.ontrack = (event) => {
      console.log('[WebRTC] Remote track received:', event.track.kind);
      // Use streams[0] if available; otherwise build a stream from the track
      const stream = event.streams?.[0] ?? (() => {
        const s = new MediaStream();
        s.addTrack(event.track);
        return s;
      })();
      setRemoteStream(stream);
      // Always mark as active — don't gate on connectionState
      setCallState(CALL_STATES.ACTIVE);
    };
  };

  /** Wire the ICE candidate gathering handler. */
  const _setupIceCandidate = (pc, callDocId, amCaller) => {
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        signalingRef.current
          ?.saveIceCandidate(callDocId, event.candidate, amCaller)
          .catch(() => {});
      }
    };
  };

  // ─── PUBLIC: Start outgoing call ────────────────────────────────────────────
  const startCall = useCallback(async (receiverId, callType = 'video') => {
    if (!signalingRef.current || !userId) return;
    try {
      setCallState(CALL_STATES.CALLING);
      setIsCaller(true);
      isCallerRef.current = true;

      // 1. Get local media
      const constraints = callType === 'audio'
        ? { video: false, audio: true }
        : { video: true,  audio: true };
      const stream = await getMediaStream(constraints);

      // 2. Create peer connection
      const pc = createPeerConnection({
        onConnectionStateChange: async (s) => {
          if (s === 'connected')    setCallState(CALL_STATES.ACTIVE);
          if (s === 'disconnected') setCallState(CALL_STATES.RECONNECTING);
          if (s === 'closed')       setCallState(CALL_STATES.ENDED);
          // On 'failed': restart ICE properly by creating a new offer
          if (s === 'failed') {
            console.warn('[PC] Connection failed — attempting ICE restart with new offer');
            setCallState(CALL_STATES.RECONNECTING);
            try {
              if (pc.signalingState !== 'closed') {
                const restartOffer = await pc.createOffer({ iceRestart: true });
                await pc.setLocalDescription(restartOffer);
                // Save the new offer so the callee can answer it
                const cid = callIdRef.current;
                if (cid) await signalingRef.current?.saveOffer(cid, restartOffer);
              }
            } catch (e) {
              console.error('[PC] ICE restart offer failed:', e);
              setCallState(CALL_STATES.FAILED);
            }
          }
        },
      });

      // 3. Add local tracks
      stream.getTracks().forEach((t) => pc.addTrack(t, stream));

      // 4. Handle remote stream
      _setupRemoteTrack(pc);

      // 5. Create offer FIRST (before writing to Firestore)
      //    This way we can save offer + callDoc in one atomic write so the
      //    callee listener fires with the offer already present.
      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: callType === 'video',
      });
      await pc.setLocalDescription(offer);

      // 6. Create call doc WITH offer included (atomic) — callee sees offer immediately
      const newCallId = await signalingRef.current.createCall(receiverId, callType, offer);
      _setCallId(newCallId);

      // 7. Wire ICE candidate sending (now we have the callId)
      _setupIceCandidate(pc, newCallId, true);

      setCallState(CALL_STATES.CONNECTING);

      // 8. Listen for answer + status updates from callee
      const unsubCall = signalingRef.current.listenToCall(newCallId, async (data) => {
        // Answer arrived (handle both initial answer and ICE-restart answer)
        if (data.answer && (
          pc.signalingState === 'have-local-offer' ||
          pc.signalingState === 'stable' // after ICE restart
        )) {
          // Only apply if this answer is different from what we already have
          if (lastProcessedAnswerSdpRef.current !== data.answer.sdp) {
            try {
              lastProcessedAnswerSdpRef.current = data.answer.sdp;
              await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
              await _flushPendingCandidates(pc);
            } catch (e) {
              console.error('[WebRTC] setRemoteDescription (answer) failed:', e);
            }
          }
        }
        // Remote hung up or rejected
        if (data.status === 'rejected') { setCallState(CALL_STATES.REJECTED); _reset(); }
        if (data.status === 'ended'   ) { _reset(); }
      });
      _addUnsub(unsubCall);

      // 9. Listen for callee's ICE candidates
      const unsubIce = signalingRef.current.listenToIceCandidates(
        newCallId, false,
        (c) => _addIceCandidate(pc, c),
      );
      _addUnsub(unsubIce);

    } catch (err) {
      console.error('[WebRTC] startCall error:', err);
      setCallState(CALL_STATES.FAILED);
      _reset();
      throw err;
    }
  }, [userId, getMediaStream, createPeerConnection]); // eslint-disable-line


  // ─── PUBLIC: Answer incoming call ───────────────────────────────────────────
  const answerCall = useCallback(async (incomingCallId, incomingCallData) => {
    if (!signalingRef.current) return;
    try {
      setCallState(CALL_STATES.RINGING);
      setIsCaller(false);
      isCallerRef.current = false;
      _setCallId(incomingCallId);

      // 1. Get local media
      const constraints = incomingCallData.callType === 'audio'
        ? { video: false, audio: true }
        : { video: true,  audio: true };
      const stream = await getMediaStream(constraints);

      // 2. Create peer connection
      const pc = createPeerConnection({
        onConnectionStateChange: (s) => {
          if (s === 'connected')    setCallState(CALL_STATES.ACTIVE);
          if (s === 'disconnected') setCallState(CALL_STATES.RECONNECTING);
          if (s === 'closed')       setCallState(CALL_STATES.ENDED);
          // On 'failed': re-answer the caller's ICE restart offer
          if (s === 'failed') {
            console.warn('[PC] Callee: connection failed, waiting for ICE restart offer from caller');
            setCallState(CALL_STATES.RECONNECTING);
          }
        },
      });

      // 3. Add local tracks
      stream.getTracks().forEach((t) => pc.addTrack(t, stream));

      // 4. Handle remote stream
      _setupRemoteTrack(pc);

      // 5. Wire ICE candidate sending (callee = false)
      _setupIceCandidate(pc, incomingCallId, false);

      // 6. Set remote description (the caller's offer)
      if (!incomingCallData.offer || !incomingCallData.offer.type) {
        throw new Error('Cannot answer call: offer is not yet available. Try again shortly.');
      }
      await pc.setRemoteDescription(new RTCSessionDescription(incomingCallData.offer));
      lastProcessedOfferSdpRef.current = incomingCallData.offer.sdp;
      await _flushPendingCandidates(pc);

      // 7. Create and save answer
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await signalingRef.current.saveAnswer(incomingCallId, answer);

      setCallState(CALL_STATES.CONNECTING);

      // 8. Listen for caller's ICE candidates
      const unsubIce = signalingRef.current.listenToIceCandidates(
        incomingCallId, true,
        (c) => _addIceCandidate(pc, c),
      );
      _addUnsub(unsubIce);

      // 9. Listen for call status changes (caller hangs up, or ICE restart offer)
      const unsubCall = signalingRef.current.listenToCall(incomingCallId, async (data) => {
        if (data.status === 'ended') { _reset(); return; }
        if (data.status === 'rejected') { _reset(); return; }

        // Handle ICE restart: caller sent a new offer (iceRestart)
        if (data.offer && pc.signalingState === 'stable') {
          if (lastProcessedOfferSdpRef.current !== data.offer.sdp) {
            try {
              console.log('[WebRTC] Applying ICE restart offer from caller');
              lastProcessedOfferSdpRef.current = data.offer.sdp;
              await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
              await _flushPendingCandidates(pc);
              const restartAnswer = await pc.createAnswer();
              await pc.setLocalDescription(restartAnswer);
              await signalingRef.current.saveAnswer(incomingCallId, restartAnswer);
            } catch (e) {
              console.error('[WebRTC] ICE restart re-answer failed:', e);
            }
          }
        }
      });
      _addUnsub(unsubCall);

    } catch (err) {
      console.error('[WebRTC] answerCall error:', err);
      setCallState(CALL_STATES.FAILED);
      _reset();
      throw err;
    }
  }, [getMediaStream, createPeerConnection]); // eslint-disable-line

  // ─── PUBLIC: Reject incoming call ───────────────────────────────────────────
  const rejectCall = useCallback(async (incomingCallId) => {
    try {
      await signalingRef.current?.rejectCall(incomingCallId);
    } catch (_) {}
    setCallState(CALL_STATES.IDLE);
  }, []);

  // ─── PUBLIC: End active call ─────────────────────────────────────────────────
  const endCall = useCallback(async () => {
    await _cleanupAndReset(true);
  }, []); // eslint-disable-line

  // ─── Internal cleanup ────────────────────────────────────────────────────────
  const _reset = useCallback(() => {
    _cleanupAndReset(false);
  }, []); // eslint-disable-line

  const _cleanupAndReset = async (notifyFirestore = true) => {
    // Unsubscribe all Firestore listeners
    unsubscribersRef.current.forEach((fn) => { try { fn(); } catch (_) {} });
    unsubscribersRef.current = [];
    pendingCandidatesRef.current = [];

    // Tell Firestore the call ended (only if we initiated the end)
    if (notifyFirestore && callIdRef.current) {
      try { await signalingRef.current?.endCall(callIdRef.current); } catch (_) {}
    }

    // Close peer connection
    closePeerConnection();

    // Stop local media
    stopMediaStream();

    // Reset state
    setRemoteStream(null);
    setCallState(CALL_STATES.IDLE);
    setIsCaller(false);
    isCallerRef.current = false;
    _setCallId(null);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      unsubscribersRef.current.forEach((fn) => { try { fn(); } catch (_) {} });
      pcRef.current?.close();
    };
  }, []); // eslint-disable-line

  return {
    // State
    callState,
    callId,
    isCaller,
    remoteStream,
    isVideoEnabled,
    isAudioEnabled,
    connectionState,
    iceConnectionState,
    pcRef,          // needed by useConnectionQuality in CallOverlay

    // Streams
    localStream,

    // Actions
    startCall,
    answerCall,
    rejectCall,
    endCall,
    toggleVideo,
    toggleAudio,
  };
};
