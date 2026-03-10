import { useState, useEffect, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { ContextMenu, type ContextMenuEntry } from "./ContextMenu";

interface LightboxProps {
  images: { url: string; filename: string }[];
  initialIndex: number;
  onClose: () => void;
}

export function Lightbox({ images, initialIndex, onClose }: LightboxProps) {
  const { t } = useTranslation("common");
  const [index, setIndex] = useState(initialIndex);
  const [closing, setClosing] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const backdropRef = useRef<HTMLDivElement>(null);

  const hasPrev = index > 0;
  const hasNext = index < images.length - 1;
  const current = images[index];

  const requestClose = useCallback(() => {
    setClosing(true);
  }, []);

  // After close animation ends, actually unmount
  useEffect(() => {
    if (!closing) return;
    const el = backdropRef.current;
    if (!el) { onClose(); return; }
    const handler = () => onClose();
    el.addEventListener("animationend", handler, { once: true });
    return () => el.removeEventListener("animationend", handler);
  }, [closing, onClose]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") requestClose();
      else if (e.key === "ArrowLeft" && hasPrev) { setIndex((i) => i - 1); setImgFailed(false); }
      else if (e.key === "ArrowRight" && hasNext) { setIndex((i) => i + 1); setImgFailed(false); }
    },
    [requestClose, hasPrev, hasNext],
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  if (!current) return null;

  return (
    <div
      ref={backdropRef}
      className={`fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center ${
        closing ? "animate-lightbox-out" : "animate-lightbox-in"
      }`}
      onClick={() => { if (!menu) requestClose(); }}
    >
      {/* Close button */}
      <button
        onClick={(e) => { e.stopPropagation(); requestClose(); }}
        className="absolute top-4 right-4 text-white/70 hover:text-white transition-colors z-10"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>

      {/* Nav arrows */}
      {hasPrev && (
        <button
          onClick={(e) => { e.stopPropagation(); setIndex((i) => i - 1); setImgFailed(false); }}
          className="absolute left-4 text-white/70 hover:text-white transition-colors z-10"
        >
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
      )}
      {hasNext && (
        <button
          onClick={(e) => { e.stopPropagation(); setIndex((i) => i + 1); setImgFailed(false); }}
          className="absolute right-4 text-white/70 hover:text-white transition-colors z-10"
        >
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      )}

      {/* Image */}
      {imgFailed ? (
        <div
          className={`flex flex-col items-center gap-4 p-10 rounded-2xl bg-elevated/80 ${
            closing ? "animate-lightbox-img-out" : "animate-lightbox-img-in"
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          <span className="text-5xl">🏜️</span>
          <p className="text-sm text-text-muted">{t("lightbox.imageError")}</p>
          <a
            href={current.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-primary hover:underline"
          >
            {t("lightbox.tryBrowser")}
          </a>
        </div>
      ) : (
        <img
          src={current.url}
          alt={current.filename}
          className={`max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl ${
            closing ? "animate-lightbox-img-out" : "animate-lightbox-img-in"
          }`}
          onClick={(e) => e.stopPropagation()}
          onError={() => setImgFailed(true)}
          onContextMenu={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setMenu({ x: e.clientX, y: e.clientY });
          }}
        />
      )}

      {/* Filename */}
      <p className="absolute bottom-4 text-sm text-white/60">{current.filename}</p>

      {/* Context menu */}
      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          items={[
            {
              label: t("lightbox.openInBrowser"),
              icon: (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                  <polyline points="15 3 21 3 21 9" />
                  <line x1="10" y1="14" x2="21" y2="3" />
                </svg>
              ),
              onClick: () => window.open(current.url, "_blank"),
            },
            {
              label: t("lightbox.copyLink"),
              icon: (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                </svg>
              ),
              onClick: () => navigator.clipboard.writeText(current.url),
            },
          ] satisfies ContextMenuEntry[]}
          onClose={() => setMenu(null)}
        />
      )}
    </div>
  );
}
