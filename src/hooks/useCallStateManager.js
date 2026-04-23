import { useState, useCallback } from 'react';

export const CALL_STATES = {
  IDLE:         'idle',
  CALLING:      'calling',       // outgoing, waiting for answer
  RINGING:      'ringing',       // incoming, waiting for user to accept
  CONNECTING:   'connecting',    // ICE negotiation in progress
  ACTIVE:       'active',        // media flowing
  RECONNECTING: 'reconnecting',  // connection dropped, attempting to restore
  ENDING:       'ending',        // in the process of tearing down
  ENDED:        'ended',
  REJECTED:     'rejected',
  FAILED:       'failed',
};

// Valid transitions — prevents illegal state jumps
const VALID_TRANSITIONS = {
  [CALL_STATES.IDLE]:         [CALL_STATES.CALLING, CALL_STATES.RINGING],
  [CALL_STATES.CALLING]:      [CALL_STATES.CONNECTING, CALL_STATES.ENDED, CALL_STATES.REJECTED, CALL_STATES.FAILED, CALL_STATES.IDLE],
  [CALL_STATES.RINGING]:      [CALL_STATES.CONNECTING, CALL_STATES.ENDED, CALL_STATES.REJECTED, CALL_STATES.IDLE],
  [CALL_STATES.CONNECTING]:   [CALL_STATES.ACTIVE, CALL_STATES.FAILED, CALL_STATES.ENDED, CALL_STATES.IDLE],
  [CALL_STATES.ACTIVE]:       [CALL_STATES.RECONNECTING, CALL_STATES.ENDING, CALL_STATES.ENDED, CALL_STATES.IDLE],
  [CALL_STATES.RECONNECTING]: [CALL_STATES.ACTIVE, CALL_STATES.FAILED, CALL_STATES.ENDED, CALL_STATES.IDLE],
  [CALL_STATES.ENDING]:       [CALL_STATES.ENDED, CALL_STATES.IDLE],
  [CALL_STATES.ENDED]:        [CALL_STATES.IDLE],
  [CALL_STATES.REJECTED]:     [CALL_STATES.IDLE],
  [CALL_STATES.FAILED]:       [CALL_STATES.IDLE],
};

export const useCallStateManager = () => {
  const [state, setState] = useState(CALL_STATES.IDLE);

  const transitionTo = useCallback((newState) => {
    setState((prev) => {
      const allowed = VALID_TRANSITIONS[prev] || [];
      if (!allowed.includes(newState)) {
        console.warn(`[CallFSM] Invalid transition: ${prev} → ${newState}`);
        return prev;
      }
      console.log(`[CallFSM] ${prev} → ${newState}`);
      return newState;
    });
  }, []);

  const reset = useCallback(() => {
    setState(CALL_STATES.IDLE);
  }, []);

  return {
    state,
    transitionTo,
    reset,
    isIdle:         state === CALL_STATES.IDLE,
    isCalling:      state === CALL_STATES.CALLING,
    isRinging:      state === CALL_STATES.RINGING,
    isConnecting:   state === CALL_STATES.CONNECTING,
    isActive:       state === CALL_STATES.ACTIVE,
    isReconnecting: state === CALL_STATES.RECONNECTING,
    isEnded:        state === CALL_STATES.ENDED,
    isRejected:     state === CALL_STATES.REJECTED,
    isFailed:       state === CALL_STATES.FAILED,
    isInProgress:   [
      CALL_STATES.CALLING,
      CALL_STATES.RINGING,
      CALL_STATES.CONNECTING,
      CALL_STATES.ACTIVE,
      CALL_STATES.RECONNECTING,
      CALL_STATES.ENDING,
    ].includes(state),
  };
};
