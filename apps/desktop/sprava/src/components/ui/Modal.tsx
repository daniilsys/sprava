import { useState, useEffect, useRef, useCallback } from "react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  size?: "sm" | "md" | "lg" | "xl";
  children: React.ReactNode;
}

const sizeClasses = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
};

export function Modal({ open, onClose, title, size = "md", children }: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const [visible, setVisible] = useState(false);
  const [closing, setClosing] = useState(false);

  // Mount/unmount lifecycle
  useEffect(() => {
    if (open) {
      setVisible(true);
      setClosing(false);
    } else if (visible) {
      // Trigger close animation
      setClosing(true);
    }
  }, [open, visible]);

  // After close animation ends, unmount
  useEffect(() => {
    if (!closing) return;
    const el = overlayRef.current;
    if (!el) { setVisible(false); setClosing(false); return; }
    const handler = () => { setVisible(false); setClosing(false); };
    el.addEventListener("animationend", handler, { once: true });
    return () => el.removeEventListener("animationend", handler);
  }, [closing]);

  const requestClose = useCallback(() => {
    onCloseRef.current();
  }, []);

  // Escape key
  useEffect(() => {
    if (!visible || closing) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") requestClose();
    };
    window.addEventListener("keydown", onKey);
    contentRef.current?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [visible, closing, requestClose]);

  if (!visible) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-[2px]"
      style={{
        animation: closing
          ? "modal-overlay-out 180ms ease-in both"
          : "modal-overlay-in 200ms ease-out both",
      }}
      onClick={(e) => {
        if (e.target === overlayRef.current) requestClose();
      }}
    >
      <div
        ref={contentRef}
        tabIndex={-1}
        className={`bg-surface border border-border-subtle rounded-2xl p-6 w-full ${sizeClasses[size]} shadow-2xl outline-none transition-[max-width] duration-300 ease-out`}
        style={{
          animation: closing
            ? "modal-content-out 180ms ease-in both"
            : "modal-content-in 300ms var(--ease-spring) both",
        }}
        onPointerDown={(e) => e.stopPropagation()}
      >
        {title && (
          <h2 className="text-lg font-display font-bold mb-4">{title}</h2>
        )}
        {children}
      </div>
    </div>
  );
}
