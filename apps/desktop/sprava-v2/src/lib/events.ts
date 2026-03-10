import { listen } from "@tauri-apps/api/event";

export function listenAuthEvents(callbacks: {
  onTokensRefreshed?: () => void;
  onSessionExpired?: () => void;
}) {
  const unlisten: Array<() => void> = [];

  if (callbacks.onTokensRefreshed) {
    listen("auth:tokens-refreshed", callbacks.onTokensRefreshed).then((fn) =>
      unlisten.push(fn),
    );
  }

  if (callbacks.onSessionExpired) {
    listen("auth:session-expired", callbacks.onSessionExpired).then((fn) =>
      unlisten.push(fn),
    );
  }

  return () => unlisten.forEach((fn) => fn());
}
