import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Avatar } from "../ui/Avatar";
import { Button } from "../ui/Button";
import { useVoice } from "../../hooks/useVoice";
import { useAppStore } from "../../store/app.store";
import { playRingtone } from "../../lib/sounds";


interface DmCallBannerProps {
  dmConversationId: string;
  callerId: string;
  onDismiss: () => void;
}

export function DmCallBanner({ dmConversationId, callerId, onDismiss }: DmCallBannerProps) {
  const { t } = useTranslation("voice");
  const { join, joining } = useVoice();
  const stopRingtoneRef = useRef<(() => void) | null>(null);

  // Find caller info from DM participants
  const dm = useAppStore((s) => s.dms.get(dmConversationId));
  const caller = dm?.participants?.find((p) => p.userId === callerId)?.user;
  const callerName = caller?.username ?? t("call.unknown");
  const callerAvatar = caller?.avatar ?? null;

  const handleAccept = async () => {
    stopRingtoneRef.current?.();
    try {
      await join(dmConversationId, "dm");
      onDismiss();
    } catch {
      // Ignore
    }
  };

  const handleDecline = () => {
    stopRingtoneRef.current?.();
    onDismiss();
  };

  // Play ringtone on mount
  useEffect(() => {
    stopRingtoneRef.current = playRingtone();
    return () => {
      stopRingtoneRef.current?.();
    };
  }, []);

  // Auto-dismiss after 20 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      stopRingtoneRef.current?.();
      onDismiss();
    }, 20000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <div className="fixed top-4 right-4 z-50 bg-surface border border-border-subtle rounded-xl shadow-xl p-4 w-72 animate-in slide-in-from-top fade-in duration-300">
      <div className="flex items-center gap-3 mb-3">
        <div className="relative">
          <div className="absolute inset-0 rounded-full bg-live/30 animate-ping" />
          <Avatar src={callerAvatar} name={callerName} size="md" />
        </div>
        <div>
          <p className="text-sm font-medium text-text-primary">{t("call.incoming")}</p>
          <p className="text-xs text-text-muted">{callerName}</p>
        </div>
      </div>
      <div className="flex gap-2">
        <Button size="sm" className="flex-1 !bg-live hover:!bg-live/90" onClick={handleAccept} loading={joining}>
          {t("call.accept")}
        </Button>
        <Button size="sm" variant="danger" className="flex-1" onClick={handleDecline}>
          {t("call.decline")}
        </Button>
      </div>
    </div>
  );
}
