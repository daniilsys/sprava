import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useAppStore } from "../../store/app.store";
import { useAuthStore } from "../../store/auth.store";
import { useUIStore } from "../../store/ui.store";
import { useFriendsStore } from "../../store/friends.store";
import { Avatar } from "../ui/Avatar";
import { api } from "../../lib/api";
import type { DmConversation } from "../../types/models";

export function OnlineFriendsWidget() {
  const { t } = useTranslation("friends");
  const currentUserId = useAuthStore((s) => s.user?.id ?? "");
  const friends = useFriendsStore((s) => s.friends);
  const presence = useAppStore((s) => s.presence);

  const onlineFriends = useMemo(() => {
    return friends
      .map((f) => {
        const friend = f.sender.id === currentUserId ? f.receiver : f.sender;
        const ps = presence.get(friend.id);
        return { user: friend, status: ps?.status ?? "offline" };
      })
      .filter((f) => f.status !== "offline")
      .slice(0, 10);
  }, [friends, currentUserId, presence]);

  if (onlineFriends.length === 0) return null;

  const handleClick = async (userId: string) => {
    try {
      const dm = (await api.dm.create({ participantIds: [currentUserId, userId] })) as DmConversation;
      useAppStore.getState().addDm(dm);
      useUIStore.getState().navigateToDm(dm.id);
    } catch {
      // Try to find existing DM
      const dms = useAppStore.getState().dms;
      for (const [id, dm] of dms) {
        if (dm.participants?.some((p) => p.userId === userId)) {
          useUIStore.getState().navigateToDm(id);
          return;
        }
      }
    }
  };

  return (
    <div className="px-2 py-2 border-t border-border-subtle">
      <p className="px-2 pb-1.5 text-[10px] font-medium text-text-muted uppercase tracking-wider">
        {t("section.online", { count: onlineFriends.length })}
      </p>
      <div className="flex flex-wrap gap-1">
        {onlineFriends.map((f) => (
          <button
            key={f.user.id}
            onClick={() => handleClick(f.user.id)}
            title={f.user.username}
            className="p-0.5 rounded-full hover:bg-elevated transition-colors"
          >
            <Avatar
              src={f.user.avatar}
              name={f.user.username}
              size="sm"
              status={f.status as "online" | "idle" | "dnd"}
            />
          </button>
        ))}
      </div>
    </div>
  );
}
