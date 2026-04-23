/**
 * signalingService.js
 *
 * Handles all Firestore read/write operations used as the WebRTC
 * signaling channel.
 *
 * Firestore structure:
 *   calls/{callId}
 *     - callerId, receiverId, callType, status, offer, answer, createdAt, startedAt, endedAt
 *   calls/{callId}/callerCandidates/{id}   ← ICE candidates from the caller
 *   calls/{callId}/calleeCandidates/{id}   ← ICE candidates from the callee
 */

import {
  collection,
  doc,
  addDoc,
  updateDoc,
  onSnapshot,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';

export class SignalingService {
  constructor(userId) {
    this.userId   = userId;
    this.callsRef = collection(db, 'calls');
  }

  // ─── Write Operations ────────────────────────────────────────────────────────

  /** Create the initial call document. Returns the new callId. */
  async createCall(receiverId, callType = 'video') {
    const ref = await addDoc(this.callsRef, {
      callerId:   this.userId,
      receiverId,
      callType,
      status:     'ringing',
      offer:      null,
      answer:     null,
      createdAt:  serverTimestamp(),
      startedAt:  null,
      endedAt:    null,
    });
    return ref.id;
  }

  /** Save the caller's SDP offer. */
  async saveOffer(callId, offer) {
    await updateDoc(doc(db, 'calls', callId), {
      offer:  { type: offer.type, sdp: offer.sdp },
      status: 'ringing',
    });
  }

  /** Save the callee's SDP answer and mark call as accepted. */
  async saveAnswer(callId, answer) {
    await updateDoc(doc(db, 'calls', callId), {
      answer:    { type: answer.type, sdp: answer.sdp },
      status:    'accepted',
      startedAt: Date.now(),
    });
  }

  /**
   * Save an ICE candidate to the appropriate subcollection.
   * @param {boolean} isCallerCandidate - true if sent by the caller, false if by the callee
   */
  async saveIceCandidate(callId, candidate, isCallerCandidate) {
    const sub = isCallerCandidate ? 'callerCandidates' : 'calleeCandidates';
    const ref = collection(db, 'calls', callId, sub);
    await addDoc(ref, {
      candidate:     candidate.candidate,
      sdpMid:        candidate.sdpMid,
      sdpMLineIndex: candidate.sdpMLineIndex,
      usernameFragment: candidate.usernameFragment,
      timestamp:     Date.now(),
    });
  }

  /** Update the call status (e.g. 'ended', 'rejected', 'missed'). */
  async updateCallStatus(callId, status) {
    const updates = { status };
    if (status === 'ended' || status === 'rejected') {
      updates.endedAt = Date.now();
    }
    await updateDoc(doc(db, 'calls', callId), updates);
  }

  async endCall(callId)    { return this.updateCallStatus(callId, 'ended');    }
  async rejectCall(callId) { return this.updateCallStatus(callId, 'rejected'); }

  // ─── Listeners ───────────────────────────────────────────────────────────────

  /**
   * Listen to a call document in real-time.
   * Returns an unsubscribe function.
   */
  listenToCall(callId, onData, onError) {
    return onSnapshot(
      doc(db, 'calls', callId),
      (snap) => { if (snap.exists()) onData({ id: snap.id, ...snap.data() }); },
      (err)  => { console.error('[Signaling] listenToCall error:', err); onError?.(err); },
    );
  }

  /**
   * Listen for new ICE candidates added to the given subcollection.
   * Only fires for 'added' changes to avoid re-processing existing docs.
   * Returns an unsubscribe function.
   */
  listenToIceCandidates(callId, isCallerCandidates, onCandidate, onError) {
    const sub = isCallerCandidates ? 'callerCandidates' : 'calleeCandidates';
    const ref = collection(db, 'calls', callId, sub);

    return onSnapshot(
      ref,
      (snap) => {
        snap.docChanges().forEach((change) => {
          if (change.type === 'added') onCandidate(change.doc.data());
        });
      },
      (err) => { console.error('[Signaling] listenToIceCandidates error:', err); onError?.(err); },
    );
  }

  /**
   * Listen for incoming calls where the current user is the receiver.
   * Returns an unsubscribe function.
   */
  listenForIncomingCalls(onIncoming, onError) {
    const q = query(
      this.callsRef,
      where('receiverId', '==', this.userId),
      where('status',     '==', 'ringing'),
    );

    return onSnapshot(
      q,
      (snap) => {
        snap.docChanges().forEach((change) => {
          if (change.type === 'added') {
            onIncoming({ id: change.doc.id, ...change.doc.data() });
          }
        });
      },
      (err) => { console.error('[Signaling] listenForIncomingCalls error:', err); onError?.(err); },
    );
  }
}
