// WebRTC peer connection configuration
// Uses Google's public STUN servers for NAT traversal.
// For production, add TURN servers below if P2P fails through firewalls.

export const rtcConfig = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    // Production TURN servers (replace with your own):
    // {
    //   urls: [
    //     'turn:global.turn.twilio.com:3478?transport=udp',
    //     'turn:global.turn.twilio.com:443?transport=tcp',
    //   ],
    //   username: import.meta.env.VITE_TURN_USERNAME,
    //   credential: import.meta.env.VITE_TURN_CREDENTIAL,
    // },
  ],
  iceCandidatePoolSize: 10,
  bundlePolicy: 'max-bundle',
  rtcpMuxPolicy: 'require',
};
