import messageReceivedUrl from "../../assets/sounds/message_received.wav";
import notificationUrl from "../../assets/sounds/notification.wav";
import callUrl from "../../assets/sounds/call.wav";
import { useAuthStore } from "../store/auth.store";
import { useAppStore } from "../store/app.store";

const cache = new Map<string, HTMLAudioElement>();

/** Returns true if the current user's status is DND */
function isDnd(): boolean {
  const userId = useAuthStore.getState().user?.id;
  if (!userId) return false;
  const presence = useAppStore.getState().presence.get(userId);
  return presence?.status === "dnd";
}

function play(url: string, volume = 0.5) {
  if (isDnd()) return;
  let audio = cache.get(url);
  if (!audio) {
    audio = new Audio(url);
    cache.set(url, audio);
  }
  audio.volume = volume;
  audio.currentTime = 0;
  audio.play().catch(() => {});
}

/** Played when receiving a message in an unfocused context */
export function playMessageSound() {
  play(messageReceivedUrl, 0.5);
}

/** Played for @mention notifications */
export function playMentionSound() {
  play(notificationUrl, 0.6);
}

/** Short ascending beep — someone joined voice */
export function playJoinSound() {
  if (isDnd()) return;
  const ctx = new AudioContext();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.type = "sine";
  osc.frequency.setValueAtTime(600, ctx.currentTime);
  osc.frequency.linearRampToValueAtTime(900, ctx.currentTime + 0.15);
  gain.gain.setValueAtTime(0.15, ctx.currentTime);
  gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.2);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.2);
  osc.onended = () => ctx.close();
}

/** Short descending beep — someone left voice */
export function playLeaveSound() {
  if (isDnd()) return;
  const ctx = new AudioContext();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.type = "sine";
  osc.frequency.setValueAtTime(900, ctx.currentTime);
  osc.frequency.linearRampToValueAtTime(600, ctx.currentTime + 0.15);
  gain.gain.setValueAtTime(0.15, ctx.currentTime);
  gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.2);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.2);
  osc.onended = () => ctx.close();
}

/** Ringtone for incoming calls — loops call.wav. Returns stop function. */
export function playRingtone(): () => void {
  if (isDnd()) return () => {};
  const audio = new Audio(callUrl);
  audio.loop = true;
  audio.volume = 0.5;
  audio.play().catch(() => {});
  return () => {
    audio.pause();
    audio.currentTime = 0;
  };
}
