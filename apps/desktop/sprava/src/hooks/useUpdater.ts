import { useState, useEffect, useCallback } from "react";
import { check, type Update } from "@tauri-apps/plugin-updater";

interface UpdaterState {
  available: boolean;
  version: string | null;
  downloading: boolean;
  progress: number; // 0-100
  error: string | null;
}

export function useUpdater() {
  const [state, setState] = useState<UpdaterState>({
    available: false,
    version: null,
    downloading: false,
    progress: 0,
    error: null,
  });
  const [update, setUpdate] = useState<Update | null>(null);

  // Check on mount, then every 30 minutes
  useEffect(() => {
    let cancelled = false;

    async function checkForUpdate() {
      try {
        const result = await check();
        if (cancelled) return;
        if (result) {
          setUpdate(result);
          setState((s) => ({ ...s, available: true, version: result.version }));
        }
      } catch (e) {
        if (!cancelled) {
          console.warn("Update check failed:", e);
        }
      }
    }

    checkForUpdate();
    const interval = setInterval(checkForUpdate, 30 * 60 * 1000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const install = useCallback(async () => {
    if (!update) return;
    setState((s) => ({ ...s, downloading: true, progress: 0, error: null }));
    try {
      let totalBytes = 0;
      let downloadedBytes = 0;
      await update.downloadAndInstall((event) => {
        if (event.event === "Started" && event.data.contentLength) {
          totalBytes = event.data.contentLength;
        } else if (event.event === "Progress") {
          downloadedBytes += event.data.chunkLength;
          if (totalBytes > 0) {
            setState((s) => ({
              ...s,
              progress: Math.round((downloadedBytes / totalBytes) * 100),
            }));
          }
        } else if (event.event === "Finished") {
          setState((s) => ({ ...s, progress: 100 }));
        }
      });
    } catch (e) {
      setState((s) => ({
        ...s,
        downloading: false,
        error: e instanceof Error ? e.message : "Update failed",
      }));
    }
  }, [update]);

  const dismiss = useCallback(() => {
    setState((s) => ({ ...s, available: false }));
    setUpdate(null);
  }, []);

  return { ...state, install, dismiss };
}
