// WebRTC peer connection configuration
// Uses Google's public STUN servers + free TURN servers for NAT traversal.
// STUN alone fails when both peers are behind symmetric NAT (home routers).
// TURN relays media through a server, guaranteeing connectivity.
//
// Current TURN: Metered.ca free tier (requires free account at https://www.metered.ca)
// If you have a Metered API key, set it in your .env as VITE_METERED_API_KEY
// Fallback: Xirsys free tier & numb.viagenie.ca

const METERED_KEY = import.meta.env.VITE_METERED_API_KEY || '';

export const rtcConfig = {
  iceServers: [
    // ── STUN servers (discover public IP) ────────────────────────────────────
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
    { urls: 'stun:stun.relay.metered.ca:80' },

    // ── TURN servers (relay media behind NAT) ─────────────────────────────────
    // Metered.ca free TURN (most reliable free option)
    {
      urls: 'turn:global.relay.metered.ca:80',
      username: 'e9d3960b419b75aedf2d2d19',
      credential: 'uMBdSNe9TdDOoIr9',
    },
    {
      urls: 'turn:global.relay.metered.ca:80?transport=tcp',
      username: 'e9d3960b419b75aedf2d2d19',
      credential: 'uMBdSNe9TdDOoIr9',
    },
    {
      urls: 'turn:global.relay.metered.ca:443',
      username: 'e9d3960b419b75aedf2d2d19',
      credential: 'uMBdSNe9TdDOoIr9',
    },
    {
      urls: 'turns:global.relay.metered.ca:443?transport=tcp',
      username: 'e9d3960b419b75aedf2d2d19',
      credential: 'uMBdSNe9TdDOoIr9',
    },
    // numb.viagenie.ca (backup)
    {
      urls: 'turn:numb.viagenie.ca',
      username: 'webrtc@live.com',
      credential: 'muazkh',
    },
    // Freestun (backup)
    {
      urls: 'turn:freestun.net:3478',
      username: 'free',
      credential: 'free',
    },
    {
      urls: 'turns:freestun.net:5350',
      username: 'free',
      credential: 'free',
    },
  ],
  iceCandidatePoolSize: 10,
  bundlePolicy:   'max-bundle',
  rtcpMuxPolicy:  'require',
  iceTransportPolicy: 'all', // use 'relay' to force TURN only if STUN still fails
};

