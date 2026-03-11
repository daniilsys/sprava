import { useState, useRef } from "react";
import { useTranslation } from "react-i18next";

/* ── Modal shown once when an update is first detected ── */

export function UpdateModal({ version, onInstall, onLater }: { version: string; onInstall: () => void; onLater: () => void }) {
  const { t } = useTranslation("common");
  const overlayRef = useRef<HTMLDivElement>(null);
  const [closing, setClosing] = useState(false);

  const handleClose = () => {
    setClosing(true);
    setTimeout(onLater, 180);
  };

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-[2px]"
      style={{ animation: closing ? "modal-overlay-out 180ms ease-in both" : "modal-overlay-in 200ms ease-out both" }}
      onClick={(e) => { if (e.target === overlayRef.current) handleClose(); }}
    >
      <div
        className="bg-surface border border-border-subtle rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden"
        style={{ animation: closing ? "modal-content-out 180ms ease-in both" : "modal-content-in 300ms var(--ease-spring) both" }}
        onPointerDown={(e) => e.stopPropagation()}
      >
        {/* Gradient bar */}
        <div className="h-1 w-full" style={{ background: "linear-gradient(90deg, var(--color-live) 0%, var(--color-secondary) 100%)" }} />

        <div className="p-6 flex flex-col items-center text-center gap-4">
          {/* Animated icon */}
          <div className="w-14 h-14 rounded-full bg-live/10 flex items-center justify-center animate-update-icon-in">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--color-live)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
          </div>

          <div>
            <h2 className="text-lg font-display font-bold text-text-primary">
              {t("update.modalTitle")}
            </h2>
            <p className="text-sm text-text-secondary mt-1">
              {t("update.modalDesc", { version })}
            </p>
          </div>

          <div className="flex gap-3 w-full mt-1">
            <button
              onClick={handleClose}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-text-secondary bg-elevated hover:bg-elevated-2 rounded-xl transition-colors"
            >
              {t("update.later")}
            </button>
            <button
              onClick={onInstall}
              className="flex-1 px-4 py-2.5 text-sm font-bold text-text-inverse bg-live hover:brightness-110 rounded-xl transition-all"
            >
              {t("update.install")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Inline update icon for the titlebar ── */

export function UpdateIndicator({ version, downloading, progress, error, onInstall }: {
  version: string | null;
  downloading: boolean;
  progress: number;
  error: string | null;
  onInstall: () => void;
}) {
  const { t } = useTranslation("common");
  const [hovered, setHovered] = useState(false);

  const circumference = 2 * Math.PI * 10;
  const strokeDashoffset = downloading
    ? circumference - (progress / 100) * circumference
    : circumference;

  return (
    <div className="relative flex items-center">
      <button
        onClick={onInstall}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className="relative group w-7 h-7 flex items-center justify-center rounded-md hover:bg-elevated-2 transition-colors"
      >
        {downloading && (
          <svg className="absolute inset-0 w-7 h-7 -rotate-90" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" fill="none" stroke="var(--color-live)" strokeWidth="2" strokeOpacity="0.15" />
            <circle
              cx="12" cy="12" r="10" fill="none"
              stroke="var(--color-live)" strokeWidth="2"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              className="transition-all duration-300"
            />
          </svg>
        )}

        <svg
          width="15" height="15" viewBox="0 0 24 24" fill="none"
          stroke="var(--color-live)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          className={`relative ${!downloading ? "group-hover:animate-update-bounce" : ""}`}
        >
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>

        {!downloading && (
          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-live rounded-full border border-bg animate-badge-pop" />
        )}
      </button>

      {hovered && !downloading && (
        <div className="absolute top-full right-0 mt-1.5 px-2.5 py-1.5 bg-elevated-2 border border-border-subtle rounded-lg shadow-lg animate-tooltip whitespace-nowrap z-50">
          <span className="text-xs text-text-secondary">{t("update.available", { version })}</span>
        </div>
      )}

      {error && (
        <span className="text-xs text-danger bg-danger/10 px-2 py-0.5 rounded ml-1">{error}</span>
      )}
    </div>
  );
}
