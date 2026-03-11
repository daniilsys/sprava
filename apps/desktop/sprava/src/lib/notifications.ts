import { playMessageSound, playMentionSound } from "./sounds";
import { useUIStore } from "../store/ui.store";
import { useAppStore } from "../store/app.store";

/**
 * Check if the app window is focused.
 * Falls back to document.hasFocus() if Tauri API unavailable.
 */
async function isWindowFocused(): Promise<boolean> {
  try {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    return await getCurrentWindow().isFocused();
  } catch {
    return document.hasFocus();
  }
}

/**
 * Send an OS notification via the Tauri notification plugin.
 * Falls back silently if the plugin isn't available.
 */
async function sendOsNotification(title: string, body: string) {
  try {
    const { sendNotification, isPermissionGranted, requestPermission } =
      await import("@tauri-apps/plugin-notification");
    let permitted = await isPermissionGranted();
    if (!permitted) {
      const result = await requestPermission();
      permitted = result === "granted";
    }
    if (permitted) {
      sendNotification({ title, body });
    }
  } catch {
    // Plugin not available — skip silently
  }
}

interface NotifyOptions {
  contextId: string;
  authorId: string;
  authorName: string;
  content: string;
  currentUserId: string;
  isMention?: boolean;
}

/**
 * Dispatch notification for an incoming message.
 * Skips if: message is from current user, context is active, or context is muted.
 */
export async function notifyMessage(opts: NotifyOptions) {
  const { contextId, authorId, authorName, content, currentUserId, isMention } = opts;

  // Don't notify for own messages
  if (authorId === currentUserId) return;

  // Don't notify when user is DND
  const presence = useAppStore.getState().presence.get(currentUserId);
  if (presence?.status === "dnd") return;

  // Don't notify for muted contexts
  const uiState = useUIStore.getState();
  if (uiState.mutedContexts.has(contextId)) return;

  // Don't notify for active context when window is focused
  const activeContextId = uiState.activeChannelId || uiState.activeDmId;
  const focused = await isWindowFocused();
  if (focused && activeContextId === contextId) return;

  // Play sound
  if (isMention) {
    playMentionSound();
  } else {
    playMessageSound();
  }

  // OS notification when not focused
  if (!focused) {
    const preview = content.length > 100 ? content.slice(0, 100) + "..." : content;
    sendOsNotification(authorName, preview);
  }
}
