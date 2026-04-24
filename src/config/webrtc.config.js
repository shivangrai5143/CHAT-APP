// WebRTC peer connection configuration
// Uses Google's public STUN servers + free public TURN servers for NAT traversal.
// STUN alone fails when both peers are behind symmetric NAT (home routers).
// TURN relays media through a server, guaranteeing connectivity.

export const rtcConfig = {
  iceServers: [
    // STUN servers (free, discover public IP)
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    // Free public TURN servers (Open Relay Project by Metered)
    // These are shared/free servers — for production, use your own credentials:
    // https://www.metered.ca/tools/openrelay/
    {
      urls: 'turn:openrelay.metered.ca:80',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
    {
      urls: 'turn:openrelay.metered.ca:443',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
    {
      urls: 'turn:openrelay.metered.ca:443?transport=tcp',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
  ],
  iceCandidatePoolSize: 10,
  bundlePolicy: 'max-bundle',
  rtcpMuxPolicy: 'require',
};

