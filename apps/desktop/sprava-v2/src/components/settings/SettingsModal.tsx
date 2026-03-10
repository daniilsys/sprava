import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { AccountSection } from "./AccountSection";
import { ProfileSection } from "./ProfileSection";
import { PrivacySection } from "./PrivacySection";
import { AppSettingsSection } from "./AppSettingsSection";
import { BlockedSection } from "./BlockedSection";
import { Button } from "../ui/Button";
import { useAuthStore } from "../../store/auth.store";

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
}

type SettingsTab = "account" | "profile" | "privacy" | "blocked" | "app";

const tabs: { id: SettingsTab; labelKey: string; icon: React.ReactNode }[] = [
  {
    id: "account",
    labelKey: "tabs.account",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    ),
  },
  {
    id: "profile",
    labelKey: "tabs.profile",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <circle cx="12" cy="10" r="3" />
        <path d="M7 21v-1a5 5 0 0 1 10 0v1" />
      </svg>
    ),
  },
  {
    id: "privacy",
    labelKey: "tabs.privacy",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
  },
  {
    id: "blocked",
    labelKey: "tabs.blocked",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
      </svg>
    ),
  },
  {
    id: "app",
    labelKey: "tabs.app",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    ),
  },
];

export function SettingsModal({ open, onClose }: SettingsModalProps) {
  const { t } = useTranslation("settings");
  const [tab, setTab] = useState<SettingsTab>("account");
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

  useEffect(() => {
    if (!visible || closing) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [visible, closing, onClose]);

  if (!visible) return null;

  const handleLogout = async () => {
    await useAuthStore.getState().logout();
    onClose();
  };

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex bg-black/60 backdrop-blur-[2px]"
      style={{
        animation: closing
          ? "modal-overlay-out 180ms ease-in both"
          : "modal-overlay-in 200ms ease-out both",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="m-auto bg-surface border border-border-subtle rounded-2xl shadow-2xl w-full max-w-5xl h-[85vh] flex overflow-hidden"
        style={{
          animation: closing
            ? "modal-content-out 180ms ease-in both"
            : "modal-content-in 300ms var(--ease-spring) both",
        }}
      >
        {/* Sidebar */}
        <div className="w-56 bg-elevated border-r border-border-subtle flex flex-col flex-shrink-0">
          <div className="p-4 pb-3">
            <h2 className="text-[11px] font-semibold text-text-muted uppercase tracking-widest px-2">
              {t("title")}
            </h2>
          </div>

          <div className="flex-1 px-2 space-y-0.5">
            {tabs.map((item) => (
              <button
                key={item.id}
                onClick={() => setTab(item.id)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all duration-150 flex items-center gap-2.5 ${
                  tab === item.id
                    ? "bg-primary/10 text-primary"
                    : "text-text-secondary hover:bg-elevated-2 hover:text-text-primary"
                }`}
              >
                <span className={tab === item.id ? "text-primary" : "text-text-muted"}>{item.icon}</span>
                {t(item.labelKey)}
              </button>
            ))}
          </div>

          <div className="p-3 border-t border-border-subtle">
            <Button variant="danger" size="sm" onClick={handleLogout} className="w-full">
              {t("common:logOut")}
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col min-h-0">
          {/* Header */}
          <div className="flex justify-between items-center px-8 py-5 border-b border-border-subtle flex-shrink-0">
            <h3 className="text-lg font-display font-bold tracking-tight">
              {t(tabs.find((item) => item.id === tab)?.labelKey ?? "")}
            </h3>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-elevated-2 transition-all duration-150"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto px-8 py-6">
            {tab === "account" && <AccountSection />}
            {tab === "profile" && <ProfileSection />}
            {tab === "privacy" && <PrivacySection />}
            {tab === "blocked" && <BlockedSection />}
            {tab === "app" && <AppSettingsSection />}
          </div>
        </div>
      </div>
    </div>
  );
}
