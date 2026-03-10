import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Avatar } from "../ui/Avatar";
import { IconButton } from "../ui/IconButton";
import { ContextMenu, type ContextMenuEntry } from "../ui/ContextMenu";
import { Icons } from "../ui/icons";
import { useAppStore } from "../../store/app.store";
import { useFriendsStore } from "../../store/friends.store";
import { useUIStore } from "../../store/ui.store";
import { confirm } from "../ui/ConfirmDialog";
import { api } from "../../lib/api";
import type { Friendship } from "../../types/models";

interface FriendItemProps {
  friendship: Friendship;
  currentUserId: string;
}

export function FriendItem({ friendship, currentUserId }: FriendItemProps) {
  const { t } = useTranslation("friends");
  const [loading, setLoading] = useState(false);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const friend = friendship.sender.id === currentUserId ? friendship.receiver : friendship.sender;
  const presenceState = useAppStore((s) => s.presence.get(friend.id));
  const status = presenceState?.status ?? "offline";

  const handleMessage = async () => {
    try {
      const dm = await api.dm.create({ participantIds: [currentUserId, friend.id] }) as { id: string };
      useAppStore.getState().addDm(dm as any);
      useUIStore.getState().navigateToDm(dm.id);
    } catch {
      const dms = useAppStore.getState().dms;
      for (const [id, dm] of dms) {
        if (dm.type === "DIRECT" && dm.participants?.some((p) => p.userId === friend.id)) {
          useUIStore.getState().navigateToDm(id);
          return;
        }
      }
    }
  };

  const handleRemove = async () => {
    if (!(await confirm(t("item.removeConfirm", { username: friend.username })))) return;
    setLoading(true);
    try {
      await useFriendsStore.getState().removeFriend(friend.id);
    } finally {
      setLoading(false);
    }
  };

  const handleBlock = async () => {
    if (!(await confirm(t("item.blockConfirm", { username: friend.username })))) return;
    setLoading(true);
    try {
      await useFriendsStore.getState().blockUser(friend.id);
    } finally {
      setLoading(false);
    }
  };

  const menuItems: ContextMenuEntry[] = [
    { label: t("item.message"), icon: Icons.message, onClick: handleMessage },
    { separator: true },
    { label: t("item.copyUserId"), icon: Icons.copy, onClick: () => navigator.clipboard.writeText(friend.id) },
    { separator: true },
    { label: t("item.removeFriend"), icon: Icons.userMinus, onClick: handleRemove, variant: "danger" },
    { label: t("item.block"), icon: Icons.slash, onClick: handleBlock, variant: "danger" },
  ];

  return (
    <div
      className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-elevated group transition-colors"
      onContextMenu={(e) => { e.preventDefault(); setMenu({ x: e.clientX, y: e.clientY }); }}
    >
      <Avatar src={friend.avatar} name={friend.username} size="md" status={status} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-text-primary truncate">{friend.username}</p>
        <p className="text-xs text-text-muted capitalize">{status === "dnd" ? t("common:status.dnd") : status}</p>
      </div>
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <IconButton size="sm" onClick={handleMessage} title={t("item.message")} disabled={loading}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
          </svg>
        </IconButton>
        <IconButton size="sm" onClick={handleRemove} title={t("item.remove")} disabled={loading}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4-4v2" />
            <circle cx="8.5" cy="7" r="4" />
            <line x1="18" y1="8" x2="23" y2="13" />
            <line x1="23" y1="8" x2="18" y2="13" />
          </svg>
        </IconButton>
        <IconButton size="sm" onClick={handleBlock} title={t("item.block")} disabled={loading}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
          </svg>
        </IconButton>
      </div>

      {menu && (
        <ContextMenu x={menu.x} y={menu.y} items={menuItems} onClose={() => setMenu(null)} />
      )}
    </div>
  );
}
