import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Avatar } from "../ui/Avatar";
import { IconButton } from "../ui/IconButton";
import { confirm } from "../ui/ConfirmDialog";
import { useFriendsStore } from "../../store/friends.store";
import type { Friendship } from "../../types/models";

interface PendingItemProps {
  friendship: Friendship;
  type: "incoming" | "outgoing";
}

export function PendingItem({ friendship, type }: PendingItemProps) {
  const { t } = useTranslation("friends");
  const [loading, setLoading] = useState(false);
  const user = type === "incoming" ? friendship.sender : friendship.receiver;

  const handleAccept = async () => {
    setLoading(true);
    try {
      await useFriendsStore.getState().acceptRequest(friendship.sender.id);
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    if (!(await confirm(t("pending.rejectConfirm", { username: user.username })))) return;
    setLoading(true);
    try {
      await useFriendsStore.getState().rejectRequest(friendship.sender.id);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!(await confirm(t("pending.cancelConfirm", { username: user.username })))) return;
    setLoading(true);
    try {
      await useFriendsStore.getState().cancelRequest(friendship.receiver.id);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-elevated group transition-colors">
      <Avatar src={user.avatar} name={user.username} size="md" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-text-primary truncate">{user.username}</p>
        <p className="text-xs text-text-muted">
          {type === "incoming" ? t("pending.incoming") : t("pending.outgoing")}
        </p>
      </div>
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {type === "incoming" ? (
          <>
            <IconButton size="sm" onClick={handleAccept} title={t("pending.accept")} disabled={loading}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-live">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </IconButton>
            <IconButton size="sm" onClick={handleReject} title={t("pending.reject")} disabled={loading}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-danger">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </IconButton>
          </>
        ) : (
          <IconButton size="sm" onClick={handleCancel} title={t("pending.cancel")} disabled={loading}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-danger">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </IconButton>
        )}
      </div>
    </div>
  );
}
