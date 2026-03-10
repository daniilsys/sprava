import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { getSocket } from "../../lib/socket";
import type { UserStatus } from "../../types/models";

const STATUS_EMOJIS = [
  "\u{1F60A}", "\u{1F4BB}", "\u{1F3AE}", "\u{1F3B5}", "\u{1F4DA}",
  "\u{2615}", "\u{1F4A4}", "\u{1F3E0}", "\u{1F680}", "\u{1F525}",
  "\u{1F389}", "\u{1F914}", "\u{1F3A7}", "\u{1F4F1}", "\u{2708}\u{FE0F}",
];

interface StatusPickerProps {
  currentStatus: UserStatus;
  currentMessage: string;
  anchorRect: DOMRect;
  onClose: () => void;
}

const statuses: { value: UserStatus; labelKey: string; cssColor: string; descKey: string; icon: string }[] = [
  { value: "online", labelKey: "status.online", cssColor: "var(--color-live)", descKey: "status.onlineDesc", icon: "circle" },
  { value: "idle", labelKey: "status.idle", cssColor: "#FBBF24", descKey: "status.idleDesc", icon: "moon" },
  { value: "dnd", labelKey: "status.dnd", cssColor: "var(--color-danger)", descKey: "status.dndDesc", icon: "minus" },
  { value: "offline", labelKey: "status.invisible", cssColor: "var(--color-text-muted)", descKey: "status.invisibleDesc", icon: "eye-off" },
];

function StatusIcon({ type, color, size = 10 }: { type: string; color: string; size?: number }) {
  if (type === "moon") {
    return (
      <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
        <path
          d="M13.5 9.2A5.5 5.5 0 016.8 2.5 6.5 6.5 0 1013.5 9.2z"
          fill={color}
        />
      </svg>
    );
  }
  if (type === "minus") {
    return (
      <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="8" r="7" fill={color} />
        <rect x="4" y="7" width="8" height="2" rx="1" fill="var(--color-bg)" />
      </svg>
    );
  }
  if (type === "eye-off") {
    return (
      <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="8" r="7" stroke={color} strokeWidth="2" fill="none" />
        <circle cx="8" cy="8" r="3" fill={color} opacity="0.4" />
      </svg>
    );
  }
  // Default: filled circle
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="7" fill={color} />
    </svg>
  );
}

export function StatusPicker({ currentStatus, currentMessage, anchorRect, onClose }: StatusPickerProps) {
  const { t } = useTranslation("common");
  const [statusMsg, setStatusMsg] = useState(currentMessage);
  const [showEmojis, setShowEmojis] = useState(false);
  const [emojiClosing, setEmojiClosing] = useState(false);
  const [closing, setClosing] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const emojiGridRef = useRef<HTMLDivElement>(null);

  const requestClose = useCallback(() => {
    if (closing) return;
    setClosing(true);
  }, [closing]);

  // Close animation end
  useEffect(() => {
    if (!closing) return;
    const el = ref.current;
    if (!el) { onClose(); return; }
    const handler = () => onClose();
    el.addEventListener("animationend", handler, { once: true });
    return () => el.removeEventListener("animationend", handler);
  }, [closing, onClose]);

  // Outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        requestClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [requestClose]);

  // Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") requestClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [requestClose]);

  // Emoji collapse animation
  useEffect(() => {
    if (!emojiClosing) return;
    const el = emojiGridRef.current;
    if (!el) { setShowEmojis(false); setEmojiClosing(false); return; }
    const handler = () => { setShowEmojis(false); setEmojiClosing(false); };
    el.addEventListener("animationend", handler, { once: true });
    return () => el.removeEventListener("animationend", handler);
  }, [emojiClosing]);

  const emitStatus = (status: UserStatus, msg?: string) => {
    const socket = getSocket();
    if (socket) {
      socket.emit("user:set_status", { status, statusMessage: msg ?? statusMsg });
    }
  };

  const handleSelectStatus = (status: UserStatus) => {
    emitStatus(status);
    requestClose();
  };

  const handleMessageSubmit = () => {
    emitStatus(currentStatus, statusMsg);
    requestClose();
  };

  const handleClearMessage = () => {
    setStatusMsg("");
    emitStatus(currentStatus, "");
    inputRef.current?.focus();
  };

  const handleToggleEmojis = () => {
    if (showEmojis) {
      setEmojiClosing(true);
    } else {
      setShowEmojis(true);
    }
  };

  const handleSelectEmoji = (emoji: string) => {
    setStatusMsg(emoji + " " + statusMsg.replace(/^\p{Emoji}\s*/u, ""));
    setEmojiClosing(true);
  };

  const currentEmoji = statusMsg.match(/^\p{Emoji}/u)?.[0] || null;

  // Position above the anchor, clamped to viewport
  const bottom = window.innerHeight - anchorRect.top + 8;
  const pickerWidth = 288;
  const left = Math.min(anchorRect.left, window.innerWidth - pickerWidth - 12);

  return createPortal(
    <div
      ref={ref}
      className="fixed z-50 select-none"
      style={{
        bottom,
        left,
        width: pickerWidth,
        animation: closing
          ? "sp-close 180ms var(--ease-out) both"
          : "sp-open 320ms var(--ease-spring) both",
      }}
    >
      {/* Outer shell with layered bg for depth */}
      <div
        className="rounded-2xl overflow-hidden border border-border-subtle"
        style={{
          background: "linear-gradient(165deg, color-mix(in srgb, var(--color-elevated) 95%, var(--color-primary) 5%) 0%, var(--color-surface) 100%)",
          boxShadow: "0 16px 48px -8px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.03) inset, 0 1px 0 rgba(255,255,255,0.04) inset",
        }}
      >
        {/* ── Status message input section ── */}
        <div className="p-3.5 pb-3">
          <label
            className="block text-[10px] font-semibold uppercase tracking-[0.08em] mb-2"
            style={{ color: "var(--color-primary)", opacity: 0.8 }}
          >
            {t("status.statusMessage")}
          </label>
          <div className="flex items-center gap-2">
            {/* Emoji trigger button */}
            <button
              onClick={handleToggleEmojis}
              className="relative flex-shrink-0 group"
              title={t("status.pickEmoji")}
            >
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center text-lg transition-all duration-200"
                style={{
                  background: showEmojis
                    ? "linear-gradient(135deg, color-mix(in srgb, var(--color-primary) 20%, transparent), color-mix(in srgb, var(--color-accent) 15%, transparent))"
                    : "var(--color-elevated)",
                  border: showEmojis
                    ? "1px solid color-mix(in srgb, var(--color-primary) 40%, transparent)"
                    : "1px solid var(--color-border-subtle)",
                  transform: showEmojis ? "scale(1.05)" : "scale(1)",
                }}
              >
                <span
                  className="transition-transform duration-200 group-hover:scale-110"
                  style={{ fontSize: "18px" }}
                >
                  {currentEmoji || "\u{1F60A}"}
                </span>
              </div>
            </button>

            {/* Text input */}
            <div className="flex-1 relative">
              <input
                ref={inputRef}
                value={statusMsg}
                onChange={(e) => setStatusMsg(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleMessageSubmit(); }}
                placeholder={t("status.customPlaceholder")}
                className="w-full bg-elevated border border-border-subtle rounded-xl px-3 py-2 text-sm text-text-primary placeholder:text-text-muted outline-none transition-all duration-200 focus:border-primary/40 focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-primary)_12%,transparent)]"
              />
              {/* Clear button */}
              {statusMsg && (
                <button
                  onClick={handleClearMessage}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 rounded-md flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-elevated-2 transition-all duration-150"
                  style={{ animation: "sp-emoji-pop 200ms var(--ease-spring) both" }}
                >
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                    <path d="M1 1l8 8M9 1l-8 8" />
                  </svg>
                </button>
              )}
            </div>
          </div>

          {/* Submit button — visible when message differs */}
          {statusMsg !== currentMessage && (
            <button
              onClick={handleMessageSubmit}
              className="mt-2.5 w-full py-1.5 rounded-lg text-xs font-medium transition-all duration-200 hover:brightness-110 active:scale-[0.98]"
              style={{
                background: "linear-gradient(135deg, var(--color-primary), color-mix(in srgb, var(--color-primary) 85%, var(--color-accent)))",
                color: "var(--color-text-inverse)",
                animation: "sp-item-in 250ms var(--ease-out) both",
              }}
            >
              {t("status.updateStatusMessage")}
            </button>
          )}

          {/* Emoji grid */}
          {showEmojis && (
            <div
              ref={emojiGridRef}
              className="overflow-hidden"
              style={{
                animation: emojiClosing
                  ? "sp-section-collapse 200ms var(--ease-out) both"
                  : "sp-section-expand 300ms var(--ease-spring) both",
              }}
            >
              <div className="grid grid-cols-5 gap-1 pt-1">
                {STATUS_EMOJIS.map((emoji, i) => (
                  <button
                    key={emoji}
                    onClick={() => handleSelectEmoji(emoji)}
                    className="w-full aspect-square rounded-xl flex items-center justify-center transition-all duration-150 hover:bg-elevated-2 active:scale-90"
                    style={{
                      fontSize: "20px",
                      animation: emojiClosing
                        ? "none"
                        : `sp-emoji-pop 350ms var(--ease-spring) ${60 + i * 30}ms both`,
                    }}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Divider ── */}
        <div
          className="mx-3.5 h-px"
          style={{
            background: "linear-gradient(90deg, transparent 0%, var(--color-border) 30%, var(--color-border) 70%, transparent 100%)",
          }}
        />

        {/* ── Status options ── */}
        <div className="p-1.5">
          {statuses.map((s, i) => {
            const isActive = currentStatus === s.value;
            return (
              <button
                key={s.value}
                onClick={() => handleSelectStatus(s.value)}
                className="w-full text-left rounded-xl px-3 py-2.5 flex items-center gap-3 transition-all duration-200 group relative"
                style={{
                  animation: closing ? "none" : `sp-item-in 280ms var(--ease-out) ${80 + i * 50}ms both`,
                  background: isActive
                    ? `linear-gradient(90deg, color-mix(in srgb, ${s.cssColor} 10%, transparent), transparent)`
                    : "transparent",
                }}
                onMouseEnter={(e) => {
                  if (!isActive) (e.currentTarget as HTMLElement).style.background = "var(--color-elevated)";
                }}
                onMouseLeave={(e) => {
                  if (!isActive) (e.currentTarget as HTMLElement).style.background = "transparent";
                }}
              >
                {/* Active indicator bar */}
                {isActive && (
                  <div
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] rounded-full"
                    style={{
                      height: "60%",
                      background: s.cssColor,
                      animation: "sp-item-in 300ms var(--ease-spring) both",
                      boxShadow: `0 0 8px ${s.cssColor}`,
                    }}
                  />
                )}

                {/* Status icon with pulse */}
                <div
                  className="relative flex-shrink-0 flex items-center justify-center"
                  style={{ width: 18, height: 18 }}
                >
                  <StatusIcon type={s.icon} color={s.cssColor} size={14} />
                  {isActive && (
                    <div
                      className="absolute inset-0 rounded-full"
                      style={{
                        color: s.cssColor,
                        animation: "sp-dot-pulse 2s ease-in-out infinite",
                      }}
                    />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <p
                    className="text-[13px] font-medium transition-colors duration-150"
                    style={{
                      color: isActive ? "var(--color-text-primary)" : "var(--color-text-secondary)",
                    }}
                  >
                    {t(s.labelKey)}
                  </p>
                  <p className="text-[11px] text-text-muted leading-tight">
                    {t(s.descKey)}
                  </p>
                </div>

                {/* Checkmark */}
                {isActive && (
                  <svg
                    className="flex-shrink-0"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke={s.cssColor}
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline
                      points="20 6 9 17 4 12"
                      style={{
                        strokeDasharray: 24,
                        animation: "sp-check-draw 400ms var(--ease-out) 200ms both",
                      }}
                    />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>,
    document.body,
  );
}
