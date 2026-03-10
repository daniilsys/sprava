import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { create } from "zustand";

interface ConfirmState {
  open: boolean;
  message: string;
  resolve: ((ok: boolean) => void) | null;
  show: (message: string) => Promise<boolean>;
  close: (ok: boolean) => void;
}

export const useConfirmStore = create<ConfirmState>((set, get) => ({
  open: false,
  message: "",
  resolve: null,
  show: (message: string) =>
    new Promise<boolean>((resolve) => {
      set({ open: true, message, resolve });
    }),
  close: (ok: boolean) => {
    const { resolve } = get();
    resolve?.(ok);
    set({ open: false, message: "", resolve: null });
  },
}));

export function confirm(message: string): Promise<boolean> {
  return useConfirmStore.getState().show(message);
}

export function ConfirmDialog() {
  const { t } = useTranslation("common");
  const { open, message, close } = useConfirmStore();
  const [visible, setVisible] = useState(false);
  const [closing, setClosing] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setVisible(true);
      setClosing(false);
    } else if (visible) {
      setClosing(true);
    }
  }, [open, visible]);

  useEffect(() => {
    if (!closing) return;
    const el = overlayRef.current;
    if (!el) { setVisible(false); setClosing(false); return; }
    const handler = () => { setVisible(false); setClosing(false); };
    el.addEventListener("animationend", handler, { once: true });
    return () => el.removeEventListener("animationend", handler);
  }, [closing]);

  const requestClose = useCallback((ok: boolean) => {
    close(ok);
  }, [close]);

  if (!visible) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[100] flex bg-black/60 backdrop-blur-[2px]"
      style={{
        animation: closing
          ? "modal-overlay-out 180ms ease-in both"
          : "modal-overlay-in 200ms ease-out both",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) requestClose(false);
      }}
    >
      <div
        className="m-auto bg-surface border border-border-subtle rounded-xl shadow-2xl p-6 max-w-sm w-full"
        style={{
          animation: closing
            ? "modal-content-out 180ms ease-in both"
            : "modal-content-in 300ms var(--ease-spring) both",
        }}
      >
        <p className="text-sm text-text-primary mb-6">{message}</p>
        <div className="flex justify-between gap-3">
          <button
            onClick={() => requestClose(false)}
            className="px-4 py-2 text-sm rounded-lg bg-elevated hover:bg-elevated-2 text-text-secondary transition-all active:scale-[0.98]"
          >
            {t("cancel")}
          </button>
          <button
            onClick={() => requestClose(true)}
            className="px-4 py-2 text-sm rounded-lg bg-danger hover:bg-danger/80 text-white transition-all active:scale-[0.98]"
          >
            {t("confirm")}
          </button>
        </div>
      </div>
    </div>
  );
}
