import { useRef, useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { create } from "zustand";
import HCaptcha from "@hcaptcha/react-hcaptcha";

interface CaptchaState {
  open: boolean;
  resolve: ((token: string | null) => void) | null;
  requestToken: () => Promise<string | null>;
  close: (token: string | null) => void;
}

export const useCaptchaStore = create<CaptchaState>((set, get) => ({
  open: false,
  resolve: null,
  requestToken: () =>
    new Promise<string | null>((resolve) => {
      set({ open: true, resolve });
    }),
  close: (token) => {
    const { resolve } = get();
    resolve?.(token);
    set({ open: false, resolve: null });
  },
}));

export function requestCaptcha(): Promise<string | null> {
  return useCaptchaStore.getState().requestToken();
}

export function CaptchaModal() {
  const { t } = useTranslation("common");
  const { open, close } = useCaptchaStore();
  const captchaRef = useRef<HCaptcha>(null);
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

  if (!visible) return null;

  const handleClose = () => {
    captchaRef.current?.resetCaptcha();
    close(null);
  };

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[100] flex bg-black/60"
      style={{
        animation: closing
          ? "modal-overlay-out 180ms ease-in both"
          : "modal-overlay-in 200ms ease-out both",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div
        className="m-auto bg-surface border border-border-subtle rounded-xl shadow-xl p-6 max-w-sm w-full"
        style={{
          animation: closing
            ? "modal-content-out 180ms ease-in both"
            : "modal-content-in 300ms var(--ease-spring) both",
        }}
      >
        <p className="text-sm text-text-primary mb-4 text-center">
          {t("captcha.title")}
        </p>
        <div className="flex justify-center">
          <HCaptcha
            sitekey={
              import.meta.env.DEV
                ? "10000000-ffff-ffff-ffff-000000000001"
                : "e8607c7c-6910-4202-b21c-b22e738ecfa2"
            }
            theme="dark"
            onVerify={(token) => close(token)}
            onExpire={() => captchaRef.current?.resetCaptcha()}
            ref={captchaRef}
          />
        </div>
        <button
          onClick={handleClose}
          className="mt-4 w-full text-sm text-text-muted hover:text-text-primary transition-colors text-center"
        >
          {t("cancel")}
        </button>
      </div>
    </div>
  );
}
