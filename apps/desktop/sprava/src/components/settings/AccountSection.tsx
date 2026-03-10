import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Input } from "../ui/Input";
import { Button } from "../ui/Button";
import { useAuthStore } from "../../store/auth.store";
import { api } from "../../lib/api";
import { translateError } from "../../lib/errorMapping";
import type { User, UserProfile } from "../../types/models";

export function AccountSection() {
  const { t } = useTranslation("settings");
  const user = useAuthStore((s) => s.user);
  const [email, setEmail] = useState<string | null>(null);
  const [username, setUsername] = useState(user?.username || "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [usernameLoading, setUsernameLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [usernameMsg, setUsernameMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [passwordMsg, setPasswordMsg] = useState<{ text: string; ok: boolean } | null>(null);

  useEffect(() => {
    api.users.getMe().then((me) => {
      const profile = me as UserProfile;
      if (profile.email) setEmail(profile.email);
    }).catch(() => {});
  }, []);

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

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword) return;
    setPasswordLoading(true);
    setPasswordMsg(null);
    try {
      await api.auth.changePassword({ currentPassword, newPassword });
      setCurrentPassword("");
      setNewPassword("");
      setPasswordMsg({ text: t("account.passwordChanged"), ok: true });
      setTimeout(() => setPasswordMsg(null), 3000);
    } catch (e: any) {
      setPasswordMsg({ text: translateError(e), ok: false });
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <div className="max-w-lg space-y-8">
      {/* Username */}
      <div>
        <label className="block text-xs font-medium text-text-muted mb-1.5 uppercase tracking-wider">
          {t("account.username")}
        </label>
        <div className="flex gap-2">
          <div className="flex-1">
            <Input value={username} onChange={(e) => setUsername(e.target.value)} />
          </div>
          <Button
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

      {/* Email (read-only) */}
      {email && (
        <div>
          <label className="block text-xs font-medium text-text-muted mb-1.5 uppercase tracking-wider">
            {t("account.email")}
          </label>
          <p className="text-sm text-text-secondary">{email}</p>
        </div>
      )}

      <div className="border-t border-border-subtle" />

      {/* Password */}
      <div>
        <label className="block text-xs font-medium text-text-muted mb-3 uppercase tracking-wider">
          {t("account.changePassword")}
        </label>
        <div className="space-y-3 max-w-sm">
          <Input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder={t("account.currentPassword")}
          />
          <Input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder={t("account.newPassword")}
          />
          <div className="flex items-center gap-3">
            <Button
              onClick={handleChangePassword}
              loading={passwordLoading}
              disabled={!currentPassword || !newPassword}
            >
              {t("account.changePassword")}
            </Button>
            {passwordMsg && (
              <span className={`text-xs ${passwordMsg.ok ? "text-live" : "text-danger"}`}>
                {passwordMsg.text}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
