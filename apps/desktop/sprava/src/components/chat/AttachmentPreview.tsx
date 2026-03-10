import { useState } from "react";
import { useTranslation } from "react-i18next";
import { createPortal } from "react-dom";
import { Lightbox } from "../ui/Lightbox";
import { ContextMenu, type ContextMenuEntry } from "../ui/ContextMenu";
import type { Attachment } from "../../types/models";

interface AttachmentPreviewProps {
  attachments: Attachment[];
}

function isImage(mimeType: string): boolean {
  return mimeType.startsWith("image/");
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

const openInBrowserIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    <polyline points="15 3 21 3 21 9" />
    <line x1="10" y1="14" x2="21" y2="3" />
  </svg>
);

function ImageAttachment({ attachment: att, onClick }: { attachment: Attachment; onClick: () => void }) {
  const { t } = useTranslation("chat");
  const [failed, setFailed] = useState(false);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);

  const menuItems: ContextMenuEntry[] = [
    {
      label: t("attachment.openInBrowser"),
      icon: openInBrowserIcon,
      onClick: () => window.open(att.url, "_blank"),
    },
    {
      label: t("attachment.copyLink"),
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
        </svg>
      ),
      onClick: () => navigator.clipboard.writeText(att.url),
    },
  ];

  if (failed) {
    return (
      <a
        href={att.url}
        target="_blank"
        rel="noopener noreferrer"
        className="group flex items-center gap-3 px-4 py-3 rounded-xl bg-elevated border border-border-subtle hover:border-primary/40 transition-all duration-200 max-w-xs"
      >
        <div className="w-10 h-10 rounded-lg bg-elevated-2 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform duration-200">
          <span className="text-lg">🖼️</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm text-text-primary font-medium truncate">{att.filename}</p>
          <p className="text-xs text-text-muted">{formatSize(att.size)} — {t("attachment.couldntLoad")}</p>
        </div>
      </a>
    );
  }

  return (
    <>
      <button
        onClick={onClick}
        onContextMenu={(e) => { e.preventDefault(); setMenu({ x: e.clientX, y: e.clientY }); }}
        className="block rounded-lg overflow-hidden border border-border hover:border-primary transition-colors max-w-xs cursor-pointer"
      >
        <img
          src={att.url}
          alt={att.filename}
          className="max-h-64 object-contain"
          loading="lazy"
          onError={() => setFailed(true)}
        />
      </button>
      {menu && (
        <ContextMenu x={menu.x} y={menu.y} items={menuItems} onClose={() => setMenu(null)} />
      )}
    </>
  );
}

export function AttachmentPreview({ attachments }: AttachmentPreviewProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  if (attachments.length === 0) return null;

  const images = attachments
    .filter((a) => isImage(a.mimeType))
    .map((a) => ({ url: a.url, filename: a.filename }));

  return (
    <>
      <div className="flex flex-wrap gap-2 mt-1.5">
        {attachments.map((att) => {
          if (isImage(att.mimeType)) {
            const imgIdx = images.findIndex((i) => i.url === att.url);
            return (
              <ImageAttachment
                key={att.id}
                attachment={att}
                onClick={() => setLightboxIndex(imgIdx)}
              />
            );
          }
          return (
            <a
              key={att.id}
              href={att.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-elevated border border-border hover:border-primary transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-text-muted flex-shrink-0">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
              <div className="min-w-0">
                <p className="text-sm text-primary truncate">{att.filename}</p>
                <p className="text-xs text-text-muted">{formatSize(att.size)}</p>
              </div>
            </a>
          );
        })}
      </div>

      {lightboxIndex !== null && createPortal(
        <Lightbox
          images={images}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />,
        document.body,
      )}
    </>
  );
}
