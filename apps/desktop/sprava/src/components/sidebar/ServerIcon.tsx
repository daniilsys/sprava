import { useState } from "react";
import { createPortal } from "react-dom";
import { useUIStore } from "../../store/ui.store";
import { useAppStore } from "../../store/app.store";
import { useAuthStore } from "../../store/auth.store";
import { api } from "../../lib/api";
import { confirm } from "../ui/ConfirmDialog";
import { Tooltip } from "../ui/Tooltip";
import { ContextMenu, type ContextMenuEntry } from "../ui/ContextMenu";
import { InviteModal } from "../server/InviteModal";
import { Icons } from "../ui/icons";
import type { Server } from "../../types/models";

interface ServerIconProps {
  server: Server;
}

function getInitials(name: string): string {
  return name
    .split(/[\s_-]+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

export function ServerIcon({ server }: ServerIconProps) {
  const activeServerId = useUIStore((s) => s.activeServerId);
  const currentUserId = useAuthStore((s) => s.user?.id);
  const isActive = activeServerId === server.id;
  const isOwner = server.ownerId === currentUserId;

  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const [iconFailed, setIconFailed] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);

  const hasUnread = useAppStore((s) => {
    const channels = s.channels;
    const readStates = s.readStates;
    for (const ch of channels.values()) {
      if (ch.serverId === server.id && ch.lastMessageId) {
        const lastRead = readStates.get(ch.id);
        if (!lastRead || lastRead < ch.lastMessageId) return true;
      }
    }
    return false;
  });

  const handleLeave = async () => {
    if (!(await confirm(`Leave "${server.name}"?`))) return;
    try {
      await api.servers.leave(server.id);
      useAppStore.getState().removeServer(server.id);
      useUIStore.getState().navigateToFriends();
    } catch (e) {
      console.error("Failed to leave server:", e);
    }
  };

  const menuItems: ContextMenuEntry[] = [
    { label: "Mark as Read", icon: Icons.check, onClick: () => {
      const channels = useAppStore.getState().channels;
      for (const ch of channels.values()) {
        if (ch.serverId === server.id && ch.lastMessageId) {
          useAppStore.getState().markRead(ch.id, ch.lastMessageId);
        }
      }
    }},
    { separator: true },
    { label: "Invite People", icon: Icons.userPlus, onClick: () => setInviteOpen(true) },
    { label: "Copy Server ID", icon: Icons.copy, onClick: () => navigator.clipboard.writeText(server.id) },
    ...(!isOwner ? [
      { separator: true } as const,
      { label: "Leave Server", icon: Icons.logOut, onClick: handleLeave, variant: "danger" as const },
    ] : []),
  ];

  return (
    <Tooltip content={server.name} side="right">
      <div className="relative flex items-center justify-center">
        {isActive && (
          <div className="absolute -left-1 w-1 h-8 rounded-r-full bg-primary animate-indicator" />
        )}
        {!isActive && hasUnread && (
          <div className="absolute -left-1 w-1 h-2 rounded-r-full bg-text-primary animate-badge-pop" />
        )}
        <button
          onClick={() => useUIStore.getState().navigateToServer(server.id)}
          onContextMenu={(e) => { e.preventDefault(); setMenu({ x: e.clientX, y: e.clientY }); }}
          className={`w-12 h-12 flex items-center justify-center overflow-hidden transition-all duration-[var(--duration-hover)] ${
            isActive
              ? "rounded-xl bg-primary text-text-inverse shadow-lg shadow-primary/20"
              : "rounded-2xl bg-elevated-2 text-text-secondary hover:rounded-xl hover:bg-primary hover:text-text-inverse hover:shadow-lg hover:shadow-primary/20"
          }`}
        >
          {server.icon && !iconFailed ? (
            <img src={server.icon} alt={server.name} className="w-full h-full object-cover" onError={() => setIconFailed(true)} />
          ) : (
            <span className="text-sm font-medium">{getInitials(server.name)}</span>
          )}
        </button>

        {menu && (
          <ContextMenu x={menu.x} y={menu.y} items={menuItems} onClose={() => setMenu(null)} />
        )}

        {inviteOpen && createPortal(
          <InviteModal
            open={inviteOpen}
            onClose={() => setInviteOpen(false)}
            inviteCode={server.inviteCode}
            serverId={server.id}
          />,
          document.body,
        )}
      </div>
    </Tooltip>
  );
}
