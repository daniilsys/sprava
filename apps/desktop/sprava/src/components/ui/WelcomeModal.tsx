import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Modal } from "./Modal";

const STORAGE_KEY = "sprava_welcome_shown";

export function WelcomeModal() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) {
      setOpen(true);
    }
  }, []);

  const handleClose = () => {
    localStorage.setItem(STORAGE_KEY, "1");
    setOpen(false);
  };

  return (
    <Modal open={open} onClose={handleClose} size="sm">
      <div className="flex flex-col items-center text-center">
        {/* Mascot */}
        <div
          className="mb-5"
          style={{ animation: "welcome-mascot-in 600ms var(--ease-spring) both" }}
        >
          <div className="w-20 h-20 rounded-[22px] bg-[#0A1020] border-[3px] border-primary flex items-center justify-center shadow-[0_0_40px_rgba(240,140,80,0.15)]">
            <svg viewBox="24 24 208 208" width="56" height="56" aria-hidden="true">
              <circle cx="98" cy="108" r="14" fill="#EDECF6" />
              <circle cx="158" cy="108" r="14" fill="#EDECF6" />
              <path
                d="M88 158 Q104 140 120 158 T152 158 T184 158"
                stroke="#2DD4BF"
                strokeWidth="12"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            </svg>
          </div>
        </div>

        {/* Title */}
        <h2
          className="text-xl font-display font-bold text-text-primary mb-1"
          style={{ animation: "welcome-fade-up 500ms var(--ease-out) 100ms both" }}
        >
          {t("welcome.title")}
        </h2>

        {/* Beta badge */}
        <div
          className="mb-4"
          style={{ animation: "welcome-fade-up 500ms var(--ease-out) 150ms both" }}
        >
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-widest bg-primary/12 text-primary border border-primary/20">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            {t("welcome.beta")}
          </span>
        </div>

        {/* Description */}
        <p
          className="text-sm text-text-secondary leading-relaxed mb-5 max-w-[280px]"
          style={{ animation: "welcome-fade-up 500ms var(--ease-out) 200ms both" }}
        >
          {t("welcome.description")}
        </p>

        {/* GitHub link */}
        <a
          href="https://github.com/daniilsys"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-elevated border border-border-subtle text-xs text-text-secondary hover:text-text-primary hover:border-border transition-all duration-150 mb-5 group"
          style={{ animation: "welcome-fade-up 500ms var(--ease-out) 280ms both" }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="opacity-60 group-hover:opacity-100 transition-opacity">
            <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
          </svg>
          <span className="font-medium">Daniil</span>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-40">
            <path d="M7 17L17 7M17 7H7M17 7v10" />
          </svg>
        </a>

        {/* Feedback hint */}
        <p
          className="text-[11px] text-text-muted leading-relaxed mb-6 max-w-[260px]"
          style={{ animation: "welcome-fade-up 500ms var(--ease-out) 340ms both" }}
        >
          {t("welcome.feedback")}
        </p>

        {/* CTA */}
        <button
          onClick={handleClose}
          className="w-full py-2.5 rounded-xl bg-primary text-text-inverse text-sm font-semibold hover:bg-primary-hover active:bg-primary-active transition-colors duration-150 cursor-pointer"
          style={{ animation: "welcome-fade-up 500ms var(--ease-out) 400ms both" }}
        >
          {t("welcome.cta")}
        </button>
      </div>
    </Modal>
  );
}
