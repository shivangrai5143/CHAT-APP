import { useState, useCallback, useRef, useEffect } from 'react';
import { rtcConfig } from '../config/webrtc.config';

export const usePeerConnection = () => {
  const [connectionState,    setConnectionState]    = useState('new');
  const [iceConnectionState, setIceConnectionState] = useState('new');

  // Holds the currently active RTCPeerConnection
  const pcRef = useRef(null);

  /**
   * Creates a new RTCPeerConnection, attaches state listeners,
   * and returns it. The caller is responsible for:
   *   - adding tracks
   *   - setting ontrack / onicecandidate handlers
   *   - creating offer / answer
   *
   * Passing `onConnectionStateChange` lets the caller react to
   * the 'failed' / 'disconnected' states without polling.
   */
  const createPeerConnection = useCallback((callbacks = {}) => {
    // Close any previous connection
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }

    const pc = new RTCPeerConnection(rtcConfig);
    pcRef.current = pc;

    pc.onconnectionstatechange = () => {
      const s = pc.connectionState;
      console.log('[PC] connectionState →', s);
      setConnectionState(s);
      // Note: ICE restart on 'failed' is handled by the caller in useWebRTCCall.js
      callbacks.onConnectionStateChange?.(s);
    };

    pc.oniceconnectionstatechange = () => {
      const s = pc.iceConnectionState;
      console.log('[PC] iceConnectionState →', s);
      setIceConnectionState(s);
      callbacks.onIceConnectionStateChange?.(s);
    };

    pc.onicegatheringstatechange = () => {
      console.log('[PC] iceGatheringState →', pc.iceGatheringState);
    };

    pc.onsignalingstatechange = () => {
      console.log('[PC] signalingState →', pc.signalingState);
    };

    return pc;
  }, []);

  const closePeerConnection = useCallback(() => {
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
      setConnectionState('closed');
      setIceConnectionState('closed');
      console.log('[PC] Closed peer connection');
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      pcRef.current?.close();
    };
  }, []);

  return {
    connectionState,
    iceConnectionState,
    pcRef, // expose ref so quality monitor can reference the live PC
    createPeerConnection,
    closePeerConnection,
  };
};
