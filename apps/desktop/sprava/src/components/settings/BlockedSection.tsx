import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Avatar } from "../ui/Avatar";
import { Button } from "../ui/Button";
import { confirm } from "../ui/ConfirmDialog";
import { useFriendsStore } from "../../store/friends.store";
import { useAuthStore } from "../../store/auth.store";

export function BlockedSection() {
  const { t } = useTranslation("settings");
  const currentUserId = useAuthStore((s) => s.user?.id ?? "");
  const blocked = useFriendsStore((s) => s.blocked);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const handleUnblock = async (userId: string, username: string) => {
    if (!(await confirm(t("blocked.unblockConfirm", { username })))) return;
    setLoadingId(userId);
    try {
      await useFriendsStore.getState().unblockUser(userId);
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h4 className="text-sm font-medium text-text-primary mb-1">{t("blocked.title")}</h4>
        <p className="text-xs text-text-muted">
          {t("blocked.description")}
        </p>
      </div>

      {blocked.length === 0 ? (
        <div className="flex flex-col items-center py-12 text-center">
          <div className="w-12 h-12 rounded-full bg-elevated-2 flex items-center justify-center mb-3">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-text-muted">
              <circle cx="12" cy="12" r="10" />
              <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
            </svg>
          </div>
          <p className="text-sm text-text-muted">{t("blocked.empty")}</p>
        </div>
      ) : (
        <div className="space-y-1">
          {blocked.map((f) => {
            const user = f.sender.id === currentUserId ? f.receiver : f.sender;
            return (
              <div
                key={f.id}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-elevated group transition-colors"
              >
                <Avatar src={user.avatar} name={user.username} size="sm" />
                <span className="flex-1 text-sm text-text-primary truncate">{user.username}</span>
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => handleUnblock(user.id, user.username)}
                  loading={loadingId === user.id}
                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  {t("common:unblock")}
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
