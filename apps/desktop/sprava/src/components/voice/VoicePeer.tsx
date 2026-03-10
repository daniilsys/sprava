import { useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import { createPortal } from "react-dom";
import { UserProfilePopup } from "../user/UserProfilePopup";
import { useAppStore } from "../../store/app.store";
import { useUIStore } from "../../store/ui.store";
import { useVoiceStore } from "../../store/voice.store";
import { rewatchStream } from "../../lib/voice";

interface VoicePeerProps {
  userId: string;
  isSpeaking?: boolean;
  isMuted?: boolean;
  isDeafened?: boolean;
  isSelf?: boolean;
}

export function VoicePeer({ userId, isSpeaking, isMuted, isDeafened, isSelf }: VoicePeerProps) {
  const { t } = useTranslation("voice");
  const serverId = useUIStore((s) => s.activeServerId);
  const member = useAppStore((s) =>
    serverId ? s.members.get(serverId)?.get(userId) : undefined,
  );

  const username = member?.user?.username ?? (isSelf ? t("peer.you") : userId.slice(-6));
  const avatar = member?.user?.avatar ?? null;

  // Check if this peer has active video producers we're not currently watching
  const screenProducerActive = useVoiceStore((s) => s.activeVideoProducers.has(`${userId}:screen`));
  const cameraProducerActive = useVoiceStore((s) => s.activeVideoProducers.has(`${userId}:camera`));
  const isWatchingScreen = useVoiceStore((s) => {
    const entry = s.videoStreams.get(`${userId}:screen`);
    return entry ? entry.stream.getVideoTracks().length > 0 : false;
  });
  const isWatchingCamera = useVoiceStore((s) => {
    const entry = s.videoStreams.get(`${userId}:camera`);
    return entry ? entry.stream.getVideoTracks().length > 0 : false;
  });

  const canWatchScreen = screenProducerActive && !isWatchingScreen;
  const canWatchCamera = cameraProducerActive && !isWatchingCamera;

  const [profileOpen, setProfileOpen] = useState(false);
  const [avatarFailed, setAvatarFailed] = useState(false);
  const itemRef = useRef<HTMLDivElement>(null);

  const handleRewatch = (kind: "camera" | "screen", e: React.MouseEvent) => {
    e.stopPropagation();
    rewatchStream(userId, kind);
  };

  return (
    <>
      <div
        ref={itemRef}
        onClick={() => setProfileOpen(true)}
        className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors cursor-pointer hover:bg-elevated ${isSpeaking ? "bg-[#2d6b3f]/15" : ""}`}
      >
        <div
          className="flex-shrink-0 w-10 h-10 rounded-full transition-shadow duration-200 overflow-hidden"
          style={isSpeaking ? { boxShadow: "0 0 0 2px #43b581" } : undefined}
        >
          {avatar && !avatarFailed ? (
            <img src={avatar} alt={username} className="w-10 h-10 rounded-full object-cover" onError={() => setAvatarFailed(true)} />
          ) : (
            <div className="w-10 h-10 rounded-full bg-elevated-2 flex items-center justify-center font-medium text-sm text-text-secondary">
              {username.split(/[\s_-]+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase()}
            </div>
          )}
        </div>
        <span className={`text-sm truncate flex-1 ${isSpeaking ? "text-[#43b581] font-medium" : "text-text-primary"}`}>
          {username}{isSelf ? t("peer.youSuffix") : ""}
        </span>

        {/* Video producer indicators */}
        {(screenProducerActive || cameraProducerActive) && (
          <div className="flex items-center gap-1 flex-shrink-0">
            {screenProducerActive && (
              <button
                onClick={(e) => canWatchScreen ? handleRewatch("screen", e) : e.stopPropagation()}
                title={canWatchScreen ? t("peer.watchScreenShare") : t("peer.sharingScreen")}
                className={`p-1 rounded transition-colors ${
                  canWatchScreen
                    ? "text-accent hover:bg-accent/20 hover:text-accent"
                    : "text-accent/60"
                }`}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                  <line x1="8" y1="21" x2="16" y2="21" />
                  <line x1="12" y1="17" x2="12" y2="21" />
                </svg>
              </button>
            )}
            {cameraProducerActive && (
              <button
                onClick={(e) => canWatchCamera ? handleRewatch("camera", e) : e.stopPropagation()}
                title={canWatchCamera ? t("peer.watchCamera") : t("peer.cameraOn")}
                className={`p-1 rounded transition-colors ${
                  canWatchCamera
                    ? "text-accent hover:bg-accent/20 hover:text-accent"
                    : "text-accent/60"
                }`}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="23 7 16 12 23 17 23 7" />
                  <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                </svg>
              </button>
            )}
          </div>
        )}

        {isDeafened && (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-danger flex-shrink-0">
            <line x1="1" y1="1" x2="23" y2="23" />
            <path d="M9 9H4a1 1 0 00-1 1v4a1 1 0 001 1h2l5 5V6.5" />
            <path d="M19 9l-4 4m0-4l4 4" />
          </svg>
        )}
        {isMuted && !isDeafened && (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-danger flex-shrink-0">
            <line x1="1" y1="1" x2="23" y2="23" />
            <path d="M9 9v3a3 3 0 005.12 2.12M15 9.34V4a3 3 0 00-5.94-.6" />
            <path d="M17 16.95A7 7 0 015 12v-2m14 0v2c0 .72-.11 1.42-.31 2.07" />
            <line x1="12" y1="19" x2="12" y2="23" />
            <line x1="8" y1="23" x2="16" y2="23" />
          </svg>
        )}
      </div>

      {profileOpen && itemRef.current && serverId && createPortal(
        <UserProfilePopup
          user={{ id: userId, username, avatar }}
          serverId={serverId}
          anchorRect={itemRef.current.getBoundingClientRect()}
          onClose={() => setProfileOpen(false)}
        />,
        document.body,
      )}
    </>
  );
}
