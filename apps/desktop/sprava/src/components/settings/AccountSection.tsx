import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Input } from "../ui/Input";
import { Button } from "../ui/Button";
import { useAuthStore } from "../../store/auth.store";
import { api } from "../../lib/api";
import { translateError } from "../../lib/errorMapping";
import type { User, UserProfile } from "../../types/models";

function ChangeEmailModal({ currentEmail, onClose, onChanged }: { currentEmail: string; onClose: () => void; onChanged: (newEmail: string) => void }) {
  const { t } = useTranslation("settings");
  const [password, setPassword] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [closing, setClosing] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  const handleClose = () => setClosing(true);

  useEffect(() => {
    if (!closing) return;
    const el = overlayRef.current;
    if (!el) { onClose(); return; }
    const handler = () => onClose();
    el.addEventListener("animationend", handler, { once: true });
    return () => el.removeEventListener("animationend", handler);
  }, [closing, onClose]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") handleClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const handleSubmit = async () => {
    if (!password || !newEmail) return;
    setLoading(true);
    setMsg(null);
    try {
      await api.auth.changeEmail({ password, newEmail });
      setMsg({ text: t("account.emailChanged"), ok: true });
      onChanged(newEmail);
      setTimeout(handleClose, 1500);
    } catch (e: any) {
      setMsg({ text: translateError(e), ok: false });
    } finally {
      setLoading(false);
    }
  };

  const isValid = password.length > 0 && newEmail.length > 0 && newEmail !== currentEmail;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-[2px]"
      style={{
        animation: closing
          ? "modal-overlay-out 180ms ease-in both"
          : "modal-overlay-in 200ms ease-out both",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
    >
      <div
        className="w-full max-w-sm rounded-xl border border-border-subtle bg-surface shadow-2xl"
        style={{
          animation: closing
            ? "modal-content-out 180ms ease-in both"
            : "modal-content-in 300ms var(--ease-spring) both",
        }}
      >
        <div className="flex items-center justify-between px-5 pt-5 pb-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="4" width="20" height="16" rx="2" />
                <path d="M22 7l-10 6L2 7" />
              </svg>
            </div>
            <h3 className="text-sm font-display font-bold text-text-primary">
              {t("account.changeEmail")}
            </h3>
          </div>
          <button
            onClick={handleClose}
            className="w-7 h-7 rounded-md flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-elevated-2 transition-colors cursor-pointer"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="p-5 space-y-3">
          {msg && (
            <div className={`flex items-center gap-2 text-xs rounded-lg px-3 py-2 border ${
              msg.ok
                ? "text-live bg-live/8 border-live/15"
                : "text-danger bg-danger/8 border-danger/10"
            }`}>
              {msg.ok ? (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="15" y1="9" x2="9" y2="15" />
                  <line x1="9" y1="9" x2="15" y2="15" />
                </svg>
              )}
              {msg.text}
            </div>
          )}

          <div>
            <label className="block text-[11px] font-medium text-text-muted mb-1 ml-0.5 uppercase tracking-wider">
              {t("account.newEmail")}
            </label>
            <Input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="you@example.com"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-text-muted mb-1 ml-0.5 uppercase tracking-wider">
              {t("account.currentPassword")}
            </label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 px-5 pb-5">
          <Button variant="ghost" size="sm" onClick={handleClose}>
            {t("common:cancel")}
          </Button>
          <Button
            size="sm"
            onClick={handleSubmit}
            loading={loading}
            disabled={!isValid}
          >
            {t("account.changeEmail")}
          </Button>
        </div>
      </div>
    </div>
  );
}

function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation("settings");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [closing, setClosing] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  const handleClose = () => setClosing(true);

  useEffect(() => {
    if (!closing) return;
    const el = overlayRef.current;
    if (!el) { onClose(); return; }
    const handler = () => onClose();
    el.addEventListener("animationend", handler, { once: true });
    return () => el.removeEventListener("animationend", handler);
  }, [closing, onClose]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") handleClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const handleSubmit = async () => {
    if (!currentPassword || !newPassword) return;
    setLoading(true);
    setMsg(null);
    try {
      await api.auth.changePassword({ currentPassword, newPassword });
      setMsg({ text: t("account.passwordChanged"), ok: true });
      setCurrentPassword("");
      setNewPassword("");
      setTimeout(handleClose, 1200);
    } catch (e: any) {
      setMsg({ text: translateError(e), ok: false });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-[2px]"
      style={{
        animation: closing
          ? "modal-overlay-out 180ms ease-in both"
          : "modal-overlay-in 200ms ease-out both",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
    >
      <div
        className="w-full max-w-sm rounded-xl border border-border-subtle bg-surface shadow-2xl"
        style={{
          animation: closing
            ? "modal-content-out 180ms ease-in both"
            : "modal-content-in 300ms var(--ease-spring) both",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </div>
            <h3 className="text-sm font-display font-bold text-text-primary">
              {t("account.changePassword")}
            </h3>
          </div>
          <button
            onClick={handleClose}
            className="w-7 h-7 rounded-md flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-elevated-2 transition-colors cursor-pointer"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-3">
          {msg && (
            <div className={`flex items-center gap-2 text-xs rounded-lg px-3 py-2 border ${
              msg.ok
                ? "text-live bg-live/8 border-live/15"
                : "text-danger bg-danger/8 border-danger/10"
            }`}>
              {msg.ok ? (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="15" y1="9" x2="9" y2="15" />
                  <line x1="9" y1="9" x2="15" y2="15" />
                </svg>
              )}
              {msg.text}
            </div>
          )}

          <div>
            <label className="block text-[11px] font-medium text-text-muted mb-1 ml-0.5 uppercase tracking-wider">
              {t("account.currentPassword")}
            </label>
            <Input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="••••••••"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-text-muted mb-1 ml-0.5 uppercase tracking-wider">
              {t("account.newPassword")}
            </label>
            <Input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="••••••••"
            />
            <p className="text-[10px] text-text-muted mt-1 ml-0.5">8 characters minimum</p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-5 pb-5">
          <Button variant="ghost" size="sm" onClick={handleClose}>
            {t("common:cancel")}
          </Button>
          <Button
            size="sm"
            onClick={handleSubmit}
            loading={loading}
            disabled={!currentPassword || newPassword.length < 8}
          >
            {t("account.changePassword")}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function AccountSection() {
  const { t } = useTranslation("settings");
  const user = useAuthStore((s) => s.user);
  const [email, setEmail] = useState<string | null>(null);
  const [verified, setVerified] = useState<boolean | null>(null);
  const [username, setUsername] = useState(user?.username || "");
  const [usernameLoading, setUsernameLoading] = useState(false);
  const [usernameMsg, setUsernameMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendMsg, setResendMsg] = useState<{ text: string; ok: boolean } | null>(null);

  useEffect(() => {
    api.users.getMe().then((me) => {
      const profile = me as UserProfile;
      if (profile.email) setEmail(profile.email);
      setVerified(profile.verified);
    }).catch(() => {});
  }, []);

  const handleResendVerification = async () => {
    setResendLoading(true);
    setResendMsg(null);
    try {
      await api.auth.resendVerification();
      setResendMsg({ text: t("account.verificationSent"), ok: true });
      setTimeout(() => setResendMsg(null), 5000);
    } catch (e: any) {
      setResendMsg({ text: translateError(e), ok: false });
    } finally {
      setResendLoading(false);
    }
  };

  const handleUpdateUsername = async () => {
    const trimmed = username.trim();
    if (!trimmed || trimmed === user?.username) return;
    setUsernameLoading(true);
    setUsernameMsg(null);
    try {
      const updated = (await api.users.updateAccount({ username: trimmed })) as User;
      useAuthStore.getState().setUser(updated);
      setUsernameMsg({ text: t("account.usernameUpdated"), ok: true });
      setTimeout(() => setUsernameMsg(null), 3000);
    } catch (e: any) {
      setUsernameMsg({ text: translateError(e), ok: false });
    } finally {
      setUsernameLoading(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      {/* Unified account card */}
      <div className="rounded-xl border border-border-subtle bg-elevated/50 overflow-hidden">
        {/* Username row */}
        <div className="px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/8 flex items-center justify-center flex-shrink-0">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-medium text-text-muted uppercase tracking-wider mb-1">
                {t("account.username")}
              </p>
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <Input value={username} onChange={(e) => setUsername(e.target.value)} />
                </div>
                <Button
                  size="sm"
                  onClick={handleUpdateUsername}
                  loading={usernameLoading}
                  disabled={username.trim() === user?.username}
                >
                  {t("common:save")}
                </Button>
              </div>
              {usernameMsg && (
                <p className={`text-xs mt-1.5 ${usernameMsg.ok ? "text-live" : "text-danger"}`}>
                  {usernameMsg.text}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="mx-5 border-t border-border-subtle" />

        {/* Email row */}
        {email && (
          <div className="px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-primary/8 flex items-center justify-center flex-shrink-0">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="4" width="20" height="16" rx="2" />
                  <path d="M22 7l-10 6L2 7" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-medium text-text-muted uppercase tracking-wider mb-0.5">
                  {t("account.email")}
                </p>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm text-text-primary truncate">{email}</span>
                  {verified ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-live bg-live/10 rounded-full px-2 py-0.5">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      {t("account.emailVerified")}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-warning bg-warning/10 rounded-full px-2 py-0.5">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="8" x2="12" y2="12" />
                        <line x1="12" y1="16" x2="12.01" y2="16" />
                      </svg>
                      {t("account.emailNotVerified")}
                    </span>
                  )}
                </div>
                {!verified && (
                  <div className="mt-1.5 flex items-center gap-2">
                    <button
                      onClick={handleResendVerification}
                      disabled={resendLoading}
                      className="text-xs text-primary hover:text-primary-hover transition-colors font-medium disabled:opacity-50 cursor-pointer"
                    >
                      {resendLoading ? "..." : t("account.resendVerification")}
                    </button>
                    {resendMsg && (
                      <span className={`text-xs ${resendMsg.ok ? "text-live" : "text-danger"}`}>
                        {resendMsg.text}
                      </span>
                    )}
                  </div>
                )}
              </div>
              <Button variant="ghost" size="sm" onClick={() => setEmailModalOpen(true)} className="flex-shrink-0">
                {t("account.changeEmail")}
              </Button>
            </div>
          </div>
        )}

        <div className="mx-5 border-t border-border-subtle" />

        {/* Password row */}
        <div className="px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/8 flex items-center justify-center flex-shrink-0">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-medium text-text-muted uppercase tracking-wider mb-0.5">
                {t("account.changePassword")}
              </p>
              <p className="text-sm text-text-muted tracking-wider">••••••••••••</p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setPasswordModalOpen(true)} className="flex-shrink-0">
              {t("account.changePassword")}
            </Button>
          </div>
        </div>
      </div>

      {passwordModalOpen && (
        <ChangePasswordModal onClose={() => setPasswordModalOpen(false)} />
      )}
      {emailModalOpen && email && (
        <ChangeEmailModal
          currentEmail={email}
          onClose={() => setEmailModalOpen(false)}
          onChanged={(newEmail) => { setEmail(newEmail); setVerified(false); }}
        />
      )}
    </div>
  );
}
