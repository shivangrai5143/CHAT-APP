/**
 * keyManager.js
 * Persists the user's RSA private key in IndexedDB.
 * The private key NEVER leaves the browser — it is not stored in Firestore.
 */

const DB_NAME = 'chatapp-e2ee';
const DB_VERSION = 1;
const STORE_NAME = 'privateKeys';

// ─── DB Initialisation ────────────────────────────────────────────────────────

let dbPromise = null;

const getDB = () => {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'uid' });
      }
    };

    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = (e) => reject(e.target.error);
  });

  return dbPromise;
};

// ─── CRUD ─────────────────────────────────────────────────────────────────────

/**
 * Save a CryptoKey (non-extractable after import) to IndexedDB.
 * @param {string} uid
 * @param {CryptoKey} privateKey
 */
export const savePrivateKey = async (uid, privateKey) => {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.put({ uid, privateKey });
    req.onsuccess = () => resolve();
    req.onerror = (e) => reject(e.target.error);
  });
};

/**
 * Retrieve a CryptoKey (private key) by uid.
 * Returns null if not found (e.g. new device).
 * @param {string} uid
 * @returns {Promise<CryptoKey|null>}
 */
export const getPrivateKey = async (uid) => {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(uid);
    req.onsuccess = (e) => resolve(e.target.result?.privateKey ?? null);
    req.onerror = (e) => reject(e.target.error);
  });
};

/**
 * Delete a private key from IndexedDB (call on logout).
 * @param {string} uid
 */
export const clearPrivateKey = async (uid) => {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.delete(uid);
    req.onsuccess = () => resolve();
    req.onerror = (e) => reject(e.target.error);
  });
};
