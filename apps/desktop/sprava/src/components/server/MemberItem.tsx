import { useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import { createPortal } from "react-dom";
import { Avatar } from "../ui/Avatar";
import { UserProfilePopup } from "../user/UserProfilePopup";
import { ContextMenu, type ContextMenuEntry } from "../ui/ContextMenu";
import { Icons } from "../ui/icons";
import { useAppStore } from "../../store/app.store";
import { useAuthStore } from "../../store/auth.store";
import { useUIStore } from "../../store/ui.store";
import { api } from "../../lib/api";

interface MemberItemProps {
  userId: string;
  username: string;
  avatar: string | null;
  serverId: string;
  isOwner?: boolean;
  roleColor?: string | null;
  onKick?: () => void;
  onBan?: () => void;
}

export function MemberItem({ userId, username, avatar, serverId, isOwner, roleColor, onKick, onBan }: MemberItemProps) {
  const { t } = useTranslation("server");
  const presenceState = useAppStore((s) => s.presence.get(userId));
  const status = presenceState?.status ?? "offline";
  const statusMessage = presenceState?.statusMessage ?? "";
  const online = status !== "offline";
  const currentUserId = useAuthStore((s) => s.user?.id);
  const isSelf = userId === currentUserId;
  const [profileOpen, setProfileOpen] = useState(false);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const itemRef = useRef<HTMLDivElement>(null);
  const closedAtRef = useRef(0);

  const handleMessage = async () => {
    if (!currentUserId) return;
    try {
      const dm = await api.dm.create({ participantIds: [currentUserId, userId] }) as { id: string };
      useAppStore.getState().addDm(dm as any);
      useUIStore.getState().navigateToDm(dm.id);
    } catch {
      const dms = useAppStore.getState().dms;
      for (const [id, dm] of dms) {
        if (dm.participants?.some((p) => p.userId === userId)) {
          useUIStore.getState().navigateToDm(id);
          return;
        }
      }
    }
  };

  const menuItems: ContextMenuEntry[] = [
    { label: t("members.viewProfile"), icon: Icons.user, onClick: () => setProfileOpen(true) },
    ...(!isSelf ? [
      { label: t("members.message"), icon: Icons.message, onClick: handleMessage },
    ] : []),
    { separator: true },
    { label: t("members.copyUserId"), icon: Icons.copy, onClick: () => navigator.clipboard.writeText(userId) },
    ...(!isSelf && (onKick || onBan) ? [
      { separator: true } as const,
      ...(onKick ? [{ label: t("members.kick"), icon: Icons.kick, onClick: onKick, variant: "danger" as const }] : []),
      ...(onBan ? [{ label: t("members.ban"), icon: Icons.slash, onClick: onBan, variant: "danger" as const }] : []),
    ] : []),
  ];

  return (
    <>
      <div
        ref={itemRef}
        onClick={() => {
          // If the popup just closed via outside-click on this same element, don't reopen
          if (Date.now() - closedAtRef.current < 100) return;
          setProfileOpen((v) => !v);
        }}
        onContextMenu={(e) => { e.preventDefault(); setMenu({ x: e.clientX, y: e.clientY }); }}
        className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-elevated active:bg-elevated-2 group transition-colors cursor-pointer"
      >
        <Avatar src={avatar} name={username} size="sm" status={status} />
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline">
            <span
              className={`text-sm truncate ${!roleColor && (online ? "text-text-primary" : "text-text-secondary")}`}
              style={roleColor && online ? { color: roleColor } : undefined}
            >
              {username}
            </span>
            {isOwner && (
              <span className="ml-1.5 text-xs text-primary">{t("members.owner")}</span>
            )}
          </div>
          {statusMessage && (
            <p className="text-[11px] text-text-muted truncate leading-tight">
              {(() => {
                const emojiMatch = statusMessage.match(/^(\p{Emoji_Presentation}|\p{Emoji}\uFE0F?)\s*/u);
                if (emojiMatch) {
                  return (
                    <>
                      <span className="text-xs">{emojiMatch[0].trim()}</span>
                      {" "}
                      {statusMessage.slice(emojiMatch[0].length)}
                    </>
                  );
                }
                return statusMessage;
              })()}
            </p>
          )}
        </div>
      </div>

      {menu && (
        <ContextMenu x={menu.x} y={menu.y} items={menuItems} onClose={() => setMenu(null)} />
      )}

      {profileOpen && itemRef.current && createPortal(
        <UserProfilePopup
          user={{ id: userId, username, avatar }}
          serverId={serverId}
          anchorRect={itemRef.current.getBoundingClientRect()}
          onClose={() => { closedAtRef.current = Date.now(); setProfileOpen(false); }}
        />,
        document.body,
      )}
    </>
  );
}
