import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useUIStore } from "../../store/ui.store";
import { useAppStore } from "../../store/app.store";
import { useAuthStore } from "../../store/auth.store";
import { Avatar } from "../ui/Avatar";
import { ContextMenu, type ContextMenuEntry } from "../ui/ContextMenu";
import { Icons } from "../ui/icons";
import type { DmConversation } from "../../types/models";

interface DmItemProps {
  dm: DmConversation;
}

function getOtherParticipant(dm: DmConversation, currentUserId: string) {
  return dm.participants?.find((p) => p.userId !== currentUserId);
}

function getDmDisplayName(dm: DmConversation, currentUserId: string): string | null {
  if (dm.name) return dm.name;
  const other = getOtherParticipant(dm, currentUserId);
  return other?.user?.username ?? null;
}

export function DmItem({ dm }: DmItemProps) {
  const { t } = useTranslation("dm");
  const activeDmId = useUIStore((s) => s.activeDmId);
  const currentUserId = useAuthStore((s) => s.user?.id ?? "");
  const isActive = activeDmId === dm.id;
  const readState = useAppStore((s) => s.readStates.get(dm.id));
  const hasUnread = dm.lastMessageId ? (!readState || dm.lastMessageId > readState) : false;

  // Check if there's an active voice call in this DM
  const callActive = useAppStore((s) =>
    s.voiceStates.some((vs) => vs.roomId === `dm:${dm.id}`),
  );

  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);

  const other = getOtherParticipant(dm, currentUserId);
  const displayName = getDmDisplayName(dm, currentUserId) ?? t("item.unknown");
  const avatarSrc = dm.type === "GROUP" ? dm.icon : other?.user?.avatar ?? null;
  const otherPresence = useAppStore((s) => other?.userId ? s.presence.get(other.userId) : undefined);
  const otherStatus = otherPresence?.status ?? "offline";
  const otherStatusMessage = otherPresence?.statusMessage ?? "";

  const menuItems: ContextMenuEntry[] = [
    { label: t("item.markAsRead"), icon: Icons.check, onClick: () => {
      if (dm.lastMessageId) {
        useAppStore.getState().markRead(dm.id, dm.lastMessageId);
      }
    }},
    { separator: true },
    { label: t("item.copyUserId"), icon: Icons.copy, onClick: () => {
      if (other?.userId) navigator.clipboard.writeText(other.userId);
    }},
  ];

  return (
    <>
      <button
        onClick={() => useUIStore.getState().navigateToDm(dm.id)}
        onContextMenu={(e) => { e.preventDefault(); setMenu({ x: e.clientX, y: e.clientY }); }}
        className={`flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-sm w-full text-left transition-colors duration-[var(--duration-feedback)] ${
          isActive
            ? "bg-elevated text-text-primary"
            : "text-text-secondary hover:bg-elevated hover:text-text-primary active:bg-elevated-2"
        }`}
      >
        <Avatar src={avatarSrc} name={displayName} size="sm" status={dm.type !== "GROUP" ? otherStatus : undefined} />
        <div className="flex-1 min-w-0">
          <span className={`block truncate text-sm ${hasUnread ? "font-semibold text-text-primary" : ""}`}>
            {displayName}
          </span>
          {dm.type !== "GROUP" && otherStatusMessage && (
            <span className="block truncate text-[11px] text-text-muted leading-tight">
              {otherStatusMessage}
            </span>
          )}
        </div>
        {callActive && (
          <span className="relative flex-shrink-0 mr-0.5" title={t("item.callActive")}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-live">
              <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" />
            </svg>
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-live animate-pulse" />
          </span>
        )}
        {hasUnread && !callActive && (
          <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0 animate-badge-pop" />
        )}
      </button>

      {menu && (
        <ContextMenu x={menu.x} y={menu.y} items={menuItems} onClose={() => setMenu(null)} />
      )}
    </>
  );
}
