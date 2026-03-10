/**
 * Simple noise gate using Web Audio API.
 * Silences audio below a dB threshold to cut background noise.
 * Returns a processed MediaStream + cleanup function.
 */

const GATE_THRESHOLD = -50; // dB — audio below this is silenced
const ATTACK_TIME = 0.005; // seconds — how fast the gate opens
const RELEASE_TIME = 0.05; // seconds — how fast the gate closes
const CHECK_INTERVAL = 20; // ms — how often we check levels

export interface NoiseGateResult {
  stream: MediaStream;
  cleanup: () => void;
}

export function createNoiseGate(inputStream: MediaStream): NoiseGateResult {
  const ctx = new AudioContext();
  const source = ctx.createMediaStreamSource(inputStream);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 256;
  const gainNode = ctx.createGain();
  gainNode.gain.value = 0; // start closed

  source.connect(analyser);
  analyser.connect(gainNode);

  // Create output stream from gain node
  const destination = ctx.createMediaStreamDestination();
  gainNode.connect(destination);

  const dataArray = new Float32Array(analyser.fftSize);
  let isOpen = false;

  const interval = setInterval(() => {
    analyser.getFloatTimeDomainData(dataArray);

    // Calculate RMS in dB
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      sum += dataArray[i] * dataArray[i];
    }
    const rms = Math.sqrt(sum / dataArray.length);
    const db = rms > 0 ? 20 * Math.log10(rms) : -100;

    if (db > GATE_THRESHOLD) {
      if (!isOpen) {
        isOpen = true;
        gainNode.gain.linearRampToValueAtTime(1, ctx.currentTime + ATTACK_TIME);
      }
    } else {
      if (isOpen) {
        isOpen = false;
        gainNode.gain.linearRampToValueAtTime(
          0,
          ctx.currentTime + RELEASE_TIME,
        );
      }
    }
  }, CHECK_INTERVAL);

  return {
    stream: destination.stream,
    cleanup() {
      clearInterval(interval);
      source.disconnect();
      analyser.disconnect();
      gainNode.disconnect();
      ctx.close().catch(() => {});
    },
  };
}
