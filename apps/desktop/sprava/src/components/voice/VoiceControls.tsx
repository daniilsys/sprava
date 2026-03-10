import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { Tooltip } from "../ui/Tooltip";
import { useVoice } from "../../hooks/useVoice";
import { AudioDeviceSelector } from "./AudioDeviceSelector";

/* ── Small control button with optional active indicator ── */
function ControlBtn({
  onClick,
  title,
  active,
  danger,
  accent,
  children,
  buttonRef,
}: {
  onClick: () => void;
  title: string;
  active?: boolean;
  danger?: boolean;
  accent?: "purple" | "blue";
  children: React.ReactNode;
  buttonRef?: React.Ref<HTMLButtonElement>;
}) {
  const accentBg = accent === "purple"
    ? "rgba(155,107,247,0.15)"
    : accent === "blue"
      ? "rgba(107,156,247,0.15)"
      : undefined;
  const accentColor = accent === "purple"
    ? "var(--color-accent)"
    : accent === "blue"
      ? "var(--color-secondary)"
      : undefined;

  return (
    <Tooltip content={title} side="top">
      <button
        ref={buttonRef}
        onClick={onClick}
        className={`relative w-8 h-8 flex items-center justify-center rounded-lg transition-all duration-150 ${
          danger
            ? "text-danger/80 hover:text-danger hover:bg-danger/10"
            : active && accent
              ? "hover:opacity-80"
              : active
                ? "text-danger hover:bg-white/[0.06]"
                : "text-text-secondary hover:text-text-primary hover:bg-white/[0.06]"
        }`}
        style={active && accent ? {
          background: accentBg,
          color: accentColor,
        } : undefined}
      >
        {children}

        {/* Active dot indicator */}
        {active && accent && (
          <span
            className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full"
            style={{
              background: accentColor,
              boxShadow: `0 0 4px 1px ${accentColor}`,
            }}
          />
        )}
      </button>
    </Tooltip>
  );
}

export function VoiceControls() {
  const { t } = useTranslation("voice");
  const { isMuted, isDeafened, isScreenSharing, isCameraOn, toggleMute, toggleDeafen, toggleScreenShare, toggleCamera, leave } = useVoice();
  const [showDeviceSelector, setShowDeviceSelector] = useState(false);
  const popupRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [popupStyle, setPopupStyle] = useState<React.CSSProperties>({});

  const updatePopupStyle = useCallback(() => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    if (spaceBelow > 200 || spaceBelow > spaceAbove) {
      setPopupStyle({ top: rect.bottom + 6, right: window.innerWidth - rect.right });
    } else {
      setPopupStyle({ bottom: window.innerHeight - rect.top + 6, right: window.innerWidth - rect.right });
    }
  }, []);

  useEffect(() => {
    if (!showDeviceSelector) return;
    updatePopupStyle();

    const handleClick = (e: MouseEvent) => {
      if (
        popupRef.current &&
        !popupRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setShowDeviceSelector(false);
      }
    };

    document.addEventListener("mousedown", handleClick);
    window.addEventListener("resize", updatePopupStyle);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      window.removeEventListener("resize", updatePopupStyle);
    };
  }, [showDeviceSelector, updatePopupStyle]);

  return (
    <div
      className="flex items-center gap-0.5 p-1 rounded-xl"
      style={{
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.04)",
      }}
    >
      {/* Mute */}
      <ControlBtn
        onClick={toggleMute}
        title={isMuted ? t("controls.unmute") : t("controls.mute")}
        active={isMuted}
      >
        {isMuted ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="1" y1="1" x2="23" y2="23" />
            <path d="M9 9v3a3 3 0 005.12 2.12M15 9.34V4a3 3 0 00-5.94-.6" />
            <path d="M17 16.95A7 7 0 015 12v-2m14 0v2c0 .72-.11 1.42-.31 2.07" />
            <line x1="12" y1="19" x2="12" y2="23" />
            <line x1="8" y1="23" x2="16" y2="23" />
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
            <path d="M19 10v2a7 7 0 01-14 0v-2" />
            <line x1="12" y1="19" x2="12" y2="23" />
            <line x1="8" y1="23" x2="16" y2="23" />
          </svg>
        )}
      </ControlBtn>

      {/* Deafen */}
      <ControlBtn
        onClick={toggleDeafen}
        title={isDeafened ? t("controls.undeafen") : t("controls.deafen")}
        active={isDeafened}
      >
        {isDeafened ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="1" y1="1" x2="23" y2="23" />
            <path d="M9 9H4a1 1 0 00-1 1v4a1 1 0 001 1h2l5 5V6.5" />
            <path d="M19 9l-4 4m0-4l4 4" />
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
            <path d="M15.54 8.46a5 5 0 010 7.07" />
          </svg>
        )}
      </ControlBtn>

      {/* Divider */}
      <div className="w-px h-4 mx-0.5" style={{ background: "rgba(255,255,255,0.06)" }} />

      {/* Screen Share */}
      <ControlBtn
        onClick={toggleScreenShare}
        title={isScreenSharing ? t("controls.stopScreenShare") : t("controls.shareScreen")}
        active={isScreenSharing}
        accent="purple"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
          <line x1="8" y1="21" x2="16" y2="21" />
          <line x1="12" y1="17" x2="12" y2="21" />
        </svg>
      </ControlBtn>

      {/* Camera */}
      <ControlBtn
        onClick={toggleCamera}
        title={isCameraOn ? t("controls.cameraOff") : t("controls.cameraOn")}
        active={isCameraOn}
        accent="blue"
      >
        {isCameraOn ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="23 7 16 12 23 17 23 7" />
            <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M16.5 7.5L23 7v10l-6.5-.5" />
            <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
            <line x1="1" y1="1" x2="23" y2="23" />
          </svg>
        )}
      </ControlBtn>

      {/* Divider */}
      <div className="w-px h-4 mx-0.5" style={{ background: "rgba(255,255,255,0.06)" }} />

      {/* Audio Settings */}
      <ControlBtn
        onClick={() => setShowDeviceSelector((v) => !v)}
        title={t("controls.audioSettings")}
        active={showDeviceSelector}
        buttonRef={buttonRef}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
        </svg>
      </ControlBtn>

      {/* Disconnect */}
      <ControlBtn
        onClick={leave}
        title={t("controls.disconnect")}
        danger
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10.68 13.31a16 16 0 003.41 2.6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7 2 2 0 011.72 2v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.42 19.42 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91" />
          <line x1="23" y1="1" x2="1" y2="23" />
        </svg>
      </ControlBtn>

      {/* Audio device selector popup */}
      {showDeviceSelector && createPortal(
        <div
          ref={popupRef}
          className="fixed bg-surface border border-border-subtle rounded-lg shadow-lg animate-scale-in z-[200]"
          style={popupStyle}
        >
          <AudioDeviceSelector />
        </div>,
        document.body,
      )}
    </div>
  );
}
