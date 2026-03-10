import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useVoice } from "../../hooks/useVoice";
import { useVoiceStore } from "../../store/voice.store";
import { VoiceControls } from "./VoiceControls";

export function VoiceStatusBar() {
  const { t } = useTranslation("voice");
  const { isConnected, currentRoomId, isScreenSharing, isCameraOn } = useVoice();

  // Count all active streams in the room (self + peers)
  const peerScreenCount = useVoiceStore((s) => {
    let count = 0;
    for (const key of s.activeVideoProducers.keys()) {
      if (key.endsWith(":screen")) count++;
    }
    return count;
  });
  const peerCameraCount = useVoiceStore((s) => {
    let count = 0;
    for (const key of s.activeVideoProducers.keys()) {
      if (key.endsWith(":camera")) count++;
    }
    return count;
  });

  const anyScreenActive = isScreenSharing || peerScreenCount > 0;
  const anyCameraActive = isCameraOn || peerCameraCount > 0;
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(Date.now());

  useEffect(() => {
    if (!isConnected) return;
    startRef.current = Date.now();
    setElapsed(0);
    const iv = setInterval(() => setElapsed(Math.floor((Date.now() - startRef.current) / 1000)), 1000);
    return () => clearInterval(iv);
  }, [isConnected, currentRoomId]);

  if (!isConnected) return null;

  const label = currentRoomId?.startsWith("channel:") ? t("status.voiceChannel") : t("status.voiceCall");

  const mm = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const ss = String(elapsed % 60).padStart(2, "0");

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-40 h-12 flex items-center justify-between pl-[88px] pr-4 animate-fade-slide-up"
      style={{
        background: "linear-gradient(180deg, rgba(11,12,16,0.92) 0%, rgba(11,12,16,0.98) 100%)",
        backdropFilter: "blur(12px) saturate(1.4)",
        borderTop: "1px solid rgba(255,255,255,0.04)",
        boxShadow: "0 -4px 24px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.02)",
      }}
    >
      {/* Left: connection status */}
      <div className="flex items-center gap-3">
        {/* Live pulse dot */}
        <div className="relative flex items-center justify-center w-5 h-5">
          <span
            className="absolute w-[7px] h-[7px] rounded-full"
            style={{
              background: "var(--color-live)",
              boxShadow: "0 0 6px 2px rgba(62,219,168,0.35)",
            }}
          />
          <span
            className="absolute w-[7px] h-[7px] rounded-full bg-live animate-ping"
            style={{ animationDuration: "2s", opacity: 0.3 }}
          />
        </div>

        {/* Label + timer */}
        <div className="flex items-center gap-2.5">
          <span className="text-[13px] font-semibold text-live tracking-tight">{label}</span>
          <span
            className="text-[11px] font-mono tabular-nums tracking-wider text-text-muted"
            style={{ letterSpacing: "0.08em" }}
          >
            {mm}:{ss}
          </span>
        </div>

        {/* Activity badges — screen / camera (shows for all participants) */}
        {(anyScreenActive || anyCameraActive) && (
          <div className="flex items-center gap-1.5 ml-1">
            {anyScreenActive && (
              <div
                className="flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium animate-fade-slide-up"
                style={{
                  background: "rgba(155,107,247,0.12)",
                  color: "var(--color-accent)",
                  border: "1px solid rgba(155,107,247,0.15)",
                }}
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="3" width="20" height="14" rx="2" />
                  <line x1="8" y1="21" x2="16" y2="21" />
                  <line x1="12" y1="17" x2="12" y2="21" />
                </svg>
                {t("video.screen")}{peerScreenCount > 1 ? ` ${peerScreenCount}` : ""}
              </div>
            )}
            {anyCameraActive && (
              <div
                className="flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium animate-fade-slide-up"
                style={{
                  background: "rgba(107,156,247,0.12)",
                  color: "var(--color-secondary)",
                  border: "1px solid rgba(107,156,247,0.15)",
                }}
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="23 7 16 12 23 17 23 7" />
                  <rect x="1" y="5" width="15" height="14" rx="2" />
                </svg>
                {t("video.camera")}{peerCameraCount > 1 ? ` ${peerCameraCount}` : ""}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Right: controls */}
      <VoiceControls />
    </div>
  );
}
