import { useEffect, useRef, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { createPortal } from "react-dom";
import { useVoice } from "../../hooks/useVoice";
import { useAppStore } from "../../store/app.store";
import { useAuthStore } from "../../store/auth.store";
import { useUIStore } from "../../store/ui.store";
import { stopWatchingStream } from "../../lib/voice";
import type { VideoStreamEntry } from "../../store/voice.store";

interface VideoTileProps {
  userId: string;
  streamKey: string;
  entry: VideoStreamEntry;
  onFullscreen: (key: string) => void;
  onStopWatching: (userId: string, kind: "camera" | "screen") => void;
  isFullscreen?: boolean;
  isSelf?: boolean;
}

function VideoTile({ userId, streamKey, entry, onFullscreen, onStopWatching, isFullscreen, isSelf }: VideoTileProps) {
  const { t } = useTranslation("voice");
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hovered, setHovered] = useState(false);
  const serverId = useUIStore((s) => s.activeServerId);
  const member = useAppStore((s) =>
    serverId ? s.members.get(serverId)?.get(userId) : undefined,
  );
  const currentUser = useAuthStore((s) => s.user);
  const dmUser = useAppStore((s) => {
    if (member) return undefined;
    for (const dm of s.dms.values()) {
      const p = dm.participants?.find((pp) => pp.userId === userId);
      if (p?.user) return p.user;
    }
    return undefined;
  });
  const username = isSelf
    ? (currentUser?.username ?? userId.slice(-6))
    : (member?.user?.username ?? dmUser?.username ?? userId.slice(-6));

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    el.srcObject = entry.stream;
    el.play().catch(() => {});
    return () => {
      el.srcObject = null;
    };
  }, [entry.stream]);

  return (
    <div
      className={`relative bg-black rounded-lg overflow-hidden flex items-center justify-center ${
        isFullscreen ? "w-full h-full" : "min-h-[180px]"
      }`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="w-full h-full object-contain"
      />

      {/* Bottom bar — hover only */}
      {hovered && (
        <div className="absolute bottom-2 left-2 flex items-center gap-1.5 bg-black/60 backdrop-blur-sm rounded px-2 py-1 animate-in fade-in duration-100">
          <span className="text-xs text-white font-medium truncate max-w-[140px]">
            {username}{isSelf ? t("video.youSuffix") : ""}
          </span>
          <span className="text-[10px] text-white/50 uppercase">
            {entry.kind === "screen" ? t("video.screen") : t("video.camera")}
          </span>
        </div>
      )}

      {/* Action buttons — on hover */}
      {hovered && (
        <div className="absolute top-2 right-2 flex items-center gap-1 animate-in fade-in duration-100">
          {/* Fullscreen */}
          {!isFullscreen && (
            <button
              onClick={(e) => { e.stopPropagation(); onFullscreen(streamKey); }}
              className="p-1.5 rounded-md bg-black/60 hover:bg-black/80 text-white/80 hover:text-white transition-colors"
              title={t("video.fullscreen")}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 3 21 3 21 9" />
                <polyline points="9 21 3 21 3 15" />
                <line x1="21" y1="3" x2="14" y2="10" />
                <line x1="3" y1="21" x2="10" y2="14" />
              </svg>
            </button>
          )}

          {/* Stop watching (not for own streams) */}
          {!isSelf && (
            <button
              onClick={(e) => { e.stopPropagation(); onStopWatching(userId, entry.kind); }}
              className="p-1.5 rounded-md bg-black/60 hover:bg-danger/80 text-white/80 hover:text-white transition-colors"
              title={t("video.stopWatching")}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94" />
                <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19" />
                <line x1="1" y1="1" x2="23" y2="23" />
              </svg>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function FullscreenOverlay({
  streamKey,
  userId,
  entry,
  onClose,
  onStopWatching,
}: {
  streamKey: string;
  userId: string;
  entry: VideoStreamEntry;
  onClose: () => void;
  onStopWatching: (userId: string, kind: "camera" | "screen") => void;
}) {
  const { t } = useTranslation("voice");
  const [closing, setClosing] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  const requestClose = useCallback(() => setClosing(true), []);

  useEffect(() => {
    if (!closing) return;
    const el = overlayRef.current;
    if (!el) { onClose(); return; }
    const handler = () => onClose();
    el.addEventListener("animationend", handler, { once: true });
    return () => el.removeEventListener("animationend", handler);
  }, [closing, onClose]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") requestClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [requestClose]);

  return (
    <div
      ref={overlayRef}
      className={`fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center ${
        closing ? "animate-lightbox-out" : "animate-lightbox-in"
      }`}
      onClick={requestClose}
    >
      {/* Close button */}
      <button
        onClick={requestClose}
        className="absolute top-4 right-4 text-white/70 hover:text-white transition-colors z-10"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>

      {/* Stop watching button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onStopWatching(userId, entry.kind);
          onClose();
        }}
        className="absolute top-4 right-14 flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white/10 hover:bg-danger/60 text-white/80 hover:text-white text-xs font-medium transition-colors z-10"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94" />
          <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19" />
          <line x1="1" y1="1" x2="23" y2="23" />
        </svg>
        {t("video.stopWatching")}
      </button>

      <div
        className={`w-[95vw] h-[90vh] ${closing ? "animate-lightbox-img-out" : "animate-lightbox-img-in"}`}
        onClick={(e) => e.stopPropagation()}
      >
        <VideoTile
          userId={userId}
          streamKey={streamKey}
          entry={entry}
          onFullscreen={() => {}}
          onStopWatching={onStopWatching}
          isFullscreen
        />
      </div>
    </div>
  );
}

export function VideoGrid() {
  const { videoStreams } = useVoice();
  const currentUserId = useAuthStore((s) => s.user?.id);
  const [fullscreenKey, setFullscreenKey] = useState<string | null>(null);

  const entries = Array.from(videoStreams.entries()).filter(
    ([, entry]) => entry.stream.getVideoTracks().length > 0,
  );

  const handleStopWatching = useCallback((userId: string, kind: "camera" | "screen") => {
    stopWatchingStream(userId, kind);
    setFullscreenKey(null);
  }, []);

  // Close fullscreen if the stream disappears
  useEffect(() => {
    if (fullscreenKey && !entries.some(([key]) => key === fullscreenKey)) {
      setFullscreenKey(null);
    }
  }, [entries, fullscreenKey]);

  if (entries.length === 0) return null;

  const gridClass =
    entries.length === 1
      ? "grid-cols-1"
      : "grid-cols-2";

  const fsEntry = fullscreenKey
    ? entries.find(([key]) => key === fullscreenKey)
    : null;

  return (
    <>
      <div className={`grid ${gridClass} gap-2 w-full max-w-2xl mx-auto mb-4`}>
        {entries.map(([key, entry]) => {
          const userId = key.split(":")[0];
          return (
            <VideoTile
              key={key}
              userId={userId}
              streamKey={key}
              entry={entry}
              onFullscreen={setFullscreenKey}
              onStopWatching={handleStopWatching}
              isSelf={userId === currentUserId}
            />
          );
        })}
      </div>

      {fsEntry && createPortal(
        <FullscreenOverlay
          streamKey={fsEntry[0]}
          userId={fsEntry[0].split(":")[0]}
          entry={fsEntry[1]}
          onClose={() => setFullscreenKey(null)}
          onStopWatching={handleStopWatching}
        />,
        document.body,
      )}
    </>
  );
}
