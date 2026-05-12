/**
 * useOfflineQueue.js
 * Offline-first messaging with IndexedDB persistence.
 *
 * Flow:
 *   1. Every message is written to IndexedDB FIRST (status: 'pending')
 *   2. sendMessage() attempts Firestore write
 *   3. On success → mark IDB record 'sent'
 *   4. On offline → queue stays, flushQueue() runs on reconnect
 */

import { useEffect, useRef, useCallback } from 'react';
import { openDB } from 'idb';

const DB_NAME    = 'chatapp-offline';
const STORE_NAME = 'message-queue';
const DB_VERSION = 1;

const getDB = () =>
  openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'localId' });
        store.createIndex('status',  'status');
        store.createIndex('chatId',  'chatId');
      }
    },
  });

/** Enqueue a message payload into IndexedDB. Returns localId. */
export const enqueueMessage = async (chatId, payload) => {
  const db = await getDB();
  const localId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  await db.put(STORE_NAME, {
    localId,
    chatId,
    payload,
    status: 'pending',
    createdAt: Date.now(),
    attempts: 0,
  });
  return localId;
};

/** Mark a queued message as sent (remove from queue). */
export const dequeueMessage = async (localId) => {
  const db = await getDB();
  await db.delete(STORE_NAME, localId);
};

/** Mark a queued message as failed. */
export const markMessageFailed = async (localId) => {
  const db = await getDB();
  const record = await db.get(STORE_NAME, localId);
  if (record) {
    await db.put(STORE_NAME, { ...record, status: 'failed', attempts: (record.attempts || 0) + 1 });
  }
};

/** Get all pending messages for a chat. */
export const getPendingMessages = async (chatId) => {
  const db = await getDB();
  const all = await db.getAllFromIndex(STORE_NAME, 'chatId', chatId);
  return all.filter(m => m.status === 'pending' || m.status === 'failed');
};

/** Get ALL pending messages across all chats (for flush on reconnect). */
export const getAllPendingMessages = async () => {
  const db = await getDB();
  const all = await db.getAll(STORE_NAME);
  return all.filter(m => m.status === 'pending' || m.status === 'failed');
};

/**
 * useOfflineQueue hook
 * - Watches navigator.onLine
 * - Calls `flushFn(messages)` when back online
 * - Exposes `isOnline` state
 */
export const useOfflineQueue = (flushFn) => {
  const isOnlineRef = useRef(navigator.onLine);
  const flushRef    = useRef(flushFn);
  flushRef.current  = flushFn;

  const flush = useCallback(async () => {
    if (!isOnlineRef.current) return;
    const pending = await getAllPendingMessages();
    if (pending.length > 0 && flushRef.current) {
      await flushRef.current(pending);
    }
  }, []);

  useEffect(() => {
    const onOnline = () => {
      isOnlineRef.current = true;
      flush();
    };
    const onOffline = () => {
      isOnlineRef.current = false;
    };

    window.addEventListener('online',  onOnline);
    window.addEventListener('offline', onOffline);

    // Flush any leftover messages on mount (e.g. after a crash)
    flush();

    return () => {
      window.removeEventListener('online',  onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [flush]);

  return { isOnline: isOnlineRef.current };
};
