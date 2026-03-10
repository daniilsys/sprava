import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Modal } from "../ui/Modal";
import { Input } from "../ui/Input";
import { Button } from "../ui/Button";
import { usePermission } from "../../hooks/usePermission";
import { P } from "../../constants/permissions";

interface InviteModalProps {
  open: boolean;
  onClose: () => void;
  inviteCode: string;
  serverId: string;
  onOpenInviteSettings?: () => void;
}

export function InviteModal({ open, onClose, inviteCode, serverId, onOpenInviteSettings }: InviteModalProps) {
  const { t } = useTranslation("server");
  const [copied, setCopied] = useState(false);

  const canRegenerate = usePermission(serverId, P.GENERATE_INVITE);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(`sprava.top/${inviteCode}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Modal open={open} onClose={onClose} title={t("invite.title")}>
      <p className="text-sm text-text-muted mb-3">
        {t("invite.description")}
      </p>
      <div className="flex gap-2">
        <Input value={`sprava.top/${inviteCode}`} readOnly className="flex-1" />
        <Button onClick={handleCopy} variant={copied ? "secondary" : "primary"}>
          {copied ? t("invite.copied") : t("invite.copy")}
        </Button>
      </div>
      {canRegenerate && onOpenInviteSettings && (
        <button
          onClick={onOpenInviteSettings}
          className="mt-3 text-xs text-text-muted hover:text-text-secondary transition-colors"
        >
          {t("invite.manage")}
        </button>
      )}
    </Modal>
  );
}
