import { useState, useEffect, useCallback } from 'react';

// Quality thresholds
const THRESHOLDS = {
  excellent: { rtt: 0.1,  loss: 2,  jitter: 0.02 },
  good:      { rtt: 0.2,  loss: 5,  jitter: 0.04 },
  poor:      { rtt: 0.4,  loss: 10, jitter: 0.08 },
};

export const useConnectionQuality = (peerConnection) => {
  const [quality, setQuality] = useState('unknown'); // 'unknown' | 'excellent' | 'good' | 'poor'
  const [stats, setStats] = useState(null);

  const checkQuality = useCallback(async () => {
    if (!peerConnection || peerConnection.connectionState !== 'connected') return;

    try {
      const report = await peerConnection.getStats();
      let rtt = 0, packetsLost = 0, packetsReceived = 0, jitter = 0;

      report.forEach((r) => {
        if (r.type === 'inbound-rtp' && r.kind === 'video') {
          packetsLost     = r.packetsLost     || 0;
          packetsReceived = r.packetsReceived || 0;
          jitter          = r.jitter          || 0;
        }
        if (r.type === 'candidate-pair' && r.state === 'succeeded' && r.currentRoundTripTime) {
          rtt = r.currentRoundTripTime;
        }
      });

      const total = packetsLost + packetsReceived;
      const lossRate = total > 0 ? (packetsLost / total) * 100 : 0;

      let newQuality = 'excellent';
      if (rtt > THRESHOLDS.poor.rtt || lossRate > THRESHOLDS.poor.loss || jitter > THRESHOLDS.poor.jitter) {
        newQuality = 'poor';
      } else if (rtt > THRESHOLDS.good.rtt || lossRate > THRESHOLDS.good.loss || jitter > THRESHOLDS.good.jitter) {
        newQuality = 'good';
      }

      setQuality(newQuality);
      setStats({
        rtt:      (rtt * 1000).toFixed(0) + ' ms',
        loss:     lossRate.toFixed(1) + '%',
        jitter:   (jitter * 1000).toFixed(0) + ' ms',
        packetsLost,
        packetsReceived,
      });
    } catch (e) {
      // Stats not available — not a fatal error
    }
  }, [peerConnection]);

  useEffect(() => {
    if (!peerConnection) {
      setQuality('unknown');
      setStats(null);
      return;
    }
    const interval = setInterval(checkQuality, 2000);
    return () => clearInterval(interval);
  }, [peerConnection, checkQuality]);

  // Returns a color string for UI badges
  const qualityColor = {
    excellent: 'text-green-400',
    good:      'text-yellow-400',
    poor:      'text-red-400',
    unknown:   'text-slate-400',
  }[quality];

  // Returns number of filled bars (1–3)
  const qualityBars = {
    excellent: 3,
    good:      2,
    poor:      1,
    unknown:   0,
  }[quality];

  return { quality, stats, qualityColor, qualityBars };
};
