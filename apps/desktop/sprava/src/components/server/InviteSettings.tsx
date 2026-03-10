import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { api } from "../../lib/api";
import { useAppStore } from "../../store/app.store";
import { usePermission } from "../../hooks/usePermission";
import { P } from "../../constants/permissions";
import type { Server } from "../../types/models";

interface InviteSettingsProps {
  server: Server;
}

export function InviteSettings({ server }: InviteSettingsProps) {
  const { t } = useTranslation("server");
  const [regenerating, setRegenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  const currentServer = useAppStore((s) => s.servers.get(server.id)) ?? server;
  const canRegenerate = usePermission(server.id, P.GENERATE_INVITE);
  const inviteLink = `sprava.top/${currentServer.inviteCode}`;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRegenerate = async () => {
    setRegenerating(true);
    try {
      const updated = (await api.servers.regenerateInvite(server.id)) as Server;
      useAppStore.getState().updateServer(updated);
    } catch (e) {
      console.error("Failed to regenerate invite:", e);
    } finally {
      setRegenerating(false);
    }
  };

  return (
    <div className="space-y-6 max-w-lg">
      <div>
        <h4 className="text-sm font-semibold text-text-primary mb-1">{t("inviteSettings.linkTitle")}</h4>
        <p className="text-xs text-text-muted mb-3">
          {t("inviteSettings.linkDescription")}
        </p>
        <div className="flex gap-2">
          <Input value={inviteLink} readOnly className="flex-1 font-mono text-sm" />
          <Button onClick={handleCopy} variant={copied ? "secondary" : "primary"} size="sm">
            {copied ? t("invite.copied") : t("invite.copy")}
          </Button>
        </div>
      </div>

      {canRegenerate && (
        <div className="border-t border-border-subtle pt-5">
          <h4 className="text-sm font-semibold text-text-primary mb-1">{t("inviteSettings.regenerateTitle")}</h4>
          <p className="text-xs text-text-muted mb-3">
            {t("inviteSettings.regenerateDescription")}
          </p>
          <Button
            variant="danger"
            size="sm"
            onClick={handleRegenerate}
            loading={regenerating}
          >
            {t("inviteSettings.regenerate")}
          </Button>
        </div>
      )}
    </div>
  );
}
