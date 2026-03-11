import { useVoiceStore } from "../store/voice.store";
import { getPlaybackCtx } from "./voice";

const SPEAKING_THRESHOLD = 0.01;
const SILENCE_DELAY = 300; // ms before marking as not speaking
const TICK_INTERVAL = 50; // 20Hz — sufficient for speaking detection

interface MonitorEntry {
  analyser: AnalyserNode;
  source: MediaStreamAudioSourceNode;
  wasSpeaking: boolean;
  silenceTimer: ReturnType<typeof setTimeout> | null;
  /** True if this monitor owns its own AudioContext (local mic) */
  ownCtx: AudioContext | null;
}

const monitors = new Map<string, MonitorEntry>();
let tickTimer: ReturnType<typeof setInterval> | null = null;
const dataArray = new Float32Array(256); // reused across all monitors

function tick() {
  for (const [userId, m] of monitors) {
    m.analyser.getFloatTimeDomainData(dataArray);

    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      sum += dataArray[i] * dataArray[i];
    }
    const rms = Math.sqrt(sum / dataArray.length);
    const isSpeaking = rms > SPEAKING_THRESHOLD;

    if (isSpeaking) {
      if (m.silenceTimer) {
        clearTimeout(m.silenceTimer);
        m.silenceTimer = null;
      }
      if (!m.wasSpeaking) {
        m.wasSpeaking = true;
        useVoiceStore.getState().setSpeaking(userId, true);
      }
    } else if (m.wasSpeaking && !m.silenceTimer) {
      m.silenceTimer = setTimeout(() => {
        m.wasSpeaking = false;
        useVoiceStore.getState().setSpeaking(userId, false);
        m.silenceTimer = null;
      }, SILENCE_DELAY);
    }
  }
}

function ensureTick() {
  if (!tickTimer && monitors.size > 0) {
    tickTimer = setInterval(tick, TICK_INTERVAL);
  }
}

function maybeStopTick() {
  if (tickTimer && monitors.size === 0) {
    clearInterval(tickTimer);
    tickTimer = null;
  }
}

export function startAudioMonitor(userId: string, stream: MediaStream): void {
  // Clean up existing monitor for this user
  stopAudioMonitor(userId);

  // For remote streams, reuse the shared playback context (passive tap — don't connect to destination).
  // For the local mic (first monitor started), create a dedicated context so it works before playbackCtx exists.
  let ctx: AudioContext;
  let ownCtx: AudioContext | null = null;
  try {
    ctx = getPlaybackCtx();
  } catch {
    // getPlaybackCtx may fail if called before voice is initialized (local mic case)
    ownCtx = new AudioContext();
    ctx = ownCtx;
  }

  const source = ctx.createMediaStreamSource(stream);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 256;
  source.connect(analyser);
  // Do NOT connect analyser to destination — passive tap only

  monitors.set(userId, {
    analyser,
    source,
    wasSpeaking: false,
    silenceTimer: null,
    ownCtx,
  });

  ensureTick();
}

export function stopAudioMonitor(userId: string): void {
  const m = monitors.get(userId);
  if (m) {
    if (m.silenceTimer) clearTimeout(m.silenceTimer);
    m.source.disconnect();
    if (m.ownCtx) m.ownCtx.close().catch(() => {});
    useVoiceStore.getState().setSpeaking(userId, false);
    monitors.delete(userId);
    maybeStopTick();
  }
}

export function stopAllAudioMonitors(): void {
  for (const [userId, m] of monitors) {
    if (m.silenceTimer) clearTimeout(m.silenceTimer);
    m.source.disconnect();
    if (m.ownCtx) m.ownCtx.close().catch(() => {});
    useVoiceStore.getState().setSpeaking(userId, false);
  }
  monitors.clear();
  maybeStopTick();
}
