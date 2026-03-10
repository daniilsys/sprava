import { useVoiceStore } from "../store/voice.store";

const SPEAKING_THRESHOLD = 0.01;
const SILENCE_DELAY = 300; // ms before marking as not speaking

interface Monitor {
  cleanup: () => void;
}

const monitors = new Map<string, Monitor>();

export function startAudioMonitor(userId: string, stream: MediaStream): void {
  // Clean up existing monitor for this user
  stopAudioMonitor(userId);

  const audioContext = new AudioContext();
  const source = audioContext.createMediaStreamSource(stream);
  const analyser = audioContext.createAnalyser();
  analyser.fftSize = 256;
  source.connect(analyser);

  const dataArray = new Float32Array(analyser.fftSize);
  let silenceTimer: ReturnType<typeof setTimeout> | null = null;
  let wasSpeaking = false;
  let animFrame = 0;

  function check() {
    analyser.getFloatTimeDomainData(dataArray);

    // Calculate RMS volume
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      sum += dataArray[i] * dataArray[i];
    }
    const rms = Math.sqrt(sum / dataArray.length);

    const isSpeaking = rms > SPEAKING_THRESHOLD;

    if (isSpeaking) {
      if (silenceTimer) {
        clearTimeout(silenceTimer);
        silenceTimer = null;
      }
      if (!wasSpeaking) {
        wasSpeaking = true;
        useVoiceStore.getState().setSpeaking(userId, true);
      }
    } else if (wasSpeaking && !silenceTimer) {
      silenceTimer = setTimeout(() => {
        wasSpeaking = false;
        useVoiceStore.getState().setSpeaking(userId, false);
        silenceTimer = null;
      }, SILENCE_DELAY);
    }

    animFrame = requestAnimationFrame(check);
  }

  animFrame = requestAnimationFrame(check);

  monitors.set(userId, {
    cleanup() {
      cancelAnimationFrame(animFrame);
      if (silenceTimer) clearTimeout(silenceTimer);
      source.disconnect();
      audioContext.close().catch(() => {});
      useVoiceStore.getState().setSpeaking(userId, false);
    },
  });
}

export function stopAudioMonitor(userId: string): void {
  const monitor = monitors.get(userId);
  if (monitor) {
    monitor.cleanup();
    monitors.delete(userId);
  }
}

export function stopAllAudioMonitors(): void {
  for (const [userId, monitor] of monitors) {
    monitor.cleanup();
    monitors.delete(userId);
  }
}
