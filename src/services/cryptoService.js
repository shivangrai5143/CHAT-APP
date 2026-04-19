/**
 * cryptoService.js
 * End-to-end encryption using RSA-OAEP (2048-bit) + AES-256-GCM
 * Public keys live in Firestore; private keys live in IndexedDB only.
 */

// ─── RSA Key Generation ───────────────────────────────────────────────────────

/**
 * Generate a new RSA-OAEP 2048-bit key pair.
 * @returns {Promise<CryptoKeyPair>}
 */
export const generateKeyPair = () =>
  window.crypto.subtle.generateKey(
    {
      name: 'RSA-OAEP',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true, // exportable
    ['encrypt', 'decrypt']
  );

/**
 * Export a public CryptoKey to JWK format (safe to store in Firestore).
 * @param {CryptoKey} publicKey
 * @returns {Promise<JsonWebKey>}
 */
export const exportPublicKey = (publicKey) =>
  window.crypto.subtle.exportKey('jwk', publicKey);

/**
 * Import a JWK public key back into a CryptoKey.
 * @param {JsonWebKey} jwk
 * @returns {Promise<CryptoKey>}
 */
export const importPublicKey = (jwk) =>
  window.crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    false,
    ['encrypt']
  );

// ─── Message Encryption ───────────────────────────────────────────────────────

/**
 * Encrypt a plaintext string for a recipient.
 * Flow:
 *   1. Generate a random AES-256-GCM key
 *   2. Encrypt the plaintext with the AES key
 *   3. Encrypt the AES key with the recipient's RSA public key
 *
 * @param {string} plaintext
 * @param {CryptoKey} recipientPublicKey  — recipient's RSA public key
 * @returns {Promise<{ encryptedMessage: string, encryptedAESKey: string, iv: string }>}
 *   All values are Base64-encoded strings safe for Firestore storage.
 */
export const encryptMessage = async (plaintext, recipientPublicKey) => {
  // 1. Generate a one-time AES-256-GCM key
  const aesKey = await window.crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );

  // 2. Encrypt the plaintext
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const encodedText = new TextEncoder().encode(plaintext);
  const encryptedBuffer = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    aesKey,
    encodedText
  );

  // 3. Export the raw AES key bytes and encrypt with RSA public key
  const rawAesKey = await window.crypto.subtle.exportKey('raw', aesKey);
  const encryptedAesKeyBuffer = await window.crypto.subtle.encrypt(
    { name: 'RSA-OAEP' },
    recipientPublicKey,
    rawAesKey
  );

  return {
    encryptedMessage: bufferToBase64(encryptedBuffer),
    encryptedAESKey: bufferToBase64(encryptedAesKeyBuffer),
    iv: bufferToBase64(iv),
  };
};

// ─── Message Decryption ───────────────────────────────────────────────────────

/**
 * Decrypt an encrypted message object using the current user's private RSA key.
 * @param {{ encryptedMessage: string, encryptedAESKey: string, iv: string }} payload
 * @param {CryptoKey} privateKey — user's RSA private key from IndexedDB
 * @returns {Promise<string>} — decrypted plaintext
 */
export const decryptMessage = async ({ encryptedMessage, encryptedAESKey, iv }, privateKey) => {
  // 1. Decrypt the AES key with our RSA private key
  const aesKeyBuffer = await window.crypto.subtle.decrypt(
    { name: 'RSA-OAEP' },
    privateKey,
    base64ToBuffer(encryptedAESKey)
  );

  // 2. Re-import the raw AES key
  const aesKey = await window.crypto.subtle.importKey(
    'raw',
    aesKeyBuffer,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );

  // 3. Decrypt the message
  const decryptedBuffer = await window.crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: base64ToBuffer(iv) },
    aesKey,
    base64ToBuffer(encryptedMessage)
  );

  return new TextDecoder().decode(decryptedBuffer);
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const bufferToBase64 = (buffer) => {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return window.btoa(binary);
};

const base64ToBuffer = (base64) => {
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
};
