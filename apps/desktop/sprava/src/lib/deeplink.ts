import { onOpenUrl } from "@tauri-apps/plugin-deep-link";
import { useDeepLinkStore, type DeepLinkAction } from "../store/deeplink.store";

export function parseDeepLinkUrl(url: string): DeepLinkAction | null {
  // Normalise: strip trailing slashes, lowercase the scheme+host part
  const trimmed = url.trim().replace(/\/+$/, "");

  // sprava://email/verified
  if (/^sprava:\/\/email\/verified$/i.test(trimmed)) {
    return { type: "emailVerified" };
  }

  // sprava://invite/{code}
  const inviteMatch = trimmed.match(/^sprava:\/\/invite\/([A-Za-z0-9]+)$/i);
  if (inviteMatch) {
    return { type: "invite", code: inviteMatch[1] };
  }

  return null;
}

function handleUrls(urls: string[]) {
  for (const url of urls) {
    const action = parseDeepLinkUrl(url);
    if (action) {
      useDeepLinkStore.getState().setPendingAction(action);
      break; // only handle the first valid one
    }
  }
}

export async function initDeepLinkListener(): Promise<() => void> {
  // onOpenUrl handles both cold start (buffered URL) and warm opens
  const unlisten = await onOpenUrl(handleUrls);
  return unlisten;
}
