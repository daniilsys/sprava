import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useUIStore } from "../../store/ui.store";
import { useAppStore } from "../../store/app.store";
import { useChannelPermission, usePermission } from "../../hooks/usePermission";
import { P } from "../../constants/permissions";
import { api } from "../../lib/api";
import { EditChannelModal } from "./EditChannelModal";
import { ContextMenu, type ContextMenuEntry } from "../ui/ContextMenu";
import { confirm } from "../ui/ConfirmDialog";
import { Icons } from "../ui/icons";
import { Tooltip } from "../ui/Tooltip";
import type { Channel } from "../../types/models";

interface ChannelItemProps {
  channel: Channel;
  serverId: string;
}

function ChannelIcon({ type }: { type: string }) {
  if (type === "VOICE") {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
        <path d="M19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07" />
      </svg>
    );
  }
  if (type === "ANNOUNCEMENT") {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 01-3.46 0" />
      </svg>
    );
  }
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="4" y1="9" x2="20" y2="9" />
      <line x1="4" y1="15" x2="20" y2="15" />
      <line x1="10" y1="3" x2="8" y2="21" />
      <line x1="16" y1="3" x2="14" y2="21" />
    </svg>
  );
}

export function ChannelItem({ channel, serverId }: ChannelItemProps) {
  const { t } = useTranslation(["server", "common"]);
  const activeChannelId = useUIStore((s) => s.activeChannelId);
  const readState = useAppStore((s) => s.readStates.get(channel.id));
  const isActive = activeChannelId === channel.id;
  const hasUnread = channel.lastMessageId ? (!readState || channel.lastMessageId > readState) : false;
  const canManageChannels = usePermission(serverId, P.CONFIGURE_CHANNELS);
  const canJoinVoice = useChannelPermission(serverId, channel.id, P.JOIN_VOICE);
  const isVoiceLocked = channel.type === "VOICE" && !canJoinVoice;

  // Voice channel member count
  const voiceCount = useAppStore((s) => {
    if (channel.type !== "VOICE") return 0;
    const roomId = `channel:${channel.id}`;
    return s.voiceStates.filter((vs) => vs.roomId === roomId).length;
  });

  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  const handleDelete = async () => {
    if (!(await confirm(t("channel.deleteChannelConfirm", { name: channel.name })))) return;
    try {
      await api.channels.delete(channel.id);
      useAppStore.getState().removeChannel(channel.id, channel.serverId);
    } catch {
      // Ignore
    }
  };

  const isMuted = useUIStore((s) => s.mutedContexts.has(channel.id));

  const menuItems: ContextMenuEntry[] = [
    { label: t("server:channel.markAsRead"), icon: Icons.check, onClick: () => {
      if (channel.lastMessageId) {
        api.channels.updateReadState(channel.id, { lastReadMessageId: channel.lastMessageId });
        useAppStore.getState().markRead(channel.id, channel.lastMessageId);
      }
    }},
    { label: isMuted ? t("server:channel.unmuteChannel") : t("server:channel.muteChannel"), icon: isMuted ? Icons.check : Icons.hash, onClick: () => {
      useUIStore.getState().toggleMuteContext(channel.id);
    }},
    ...(canManageChannels ? [
      { separator: true } as ContextMenuEntry,
      { label: t("server:channel.editChannel"), icon: Icons.pencil, onClick: () => setEditOpen(true) },
    ] : []),
    { separator: true },
    { label: t("server:channel.copyChannelId"), icon: Icons.copy, onClick: () => navigator.clipboard.writeText(channel.id) },
    ...(canManageChannels ? [
      { separator: true } as ContextMenuEntry,
      { label: t("server:channel.deleteChannel"), icon: Icons.trash, onClick: handleDelete, variant: "danger" as const },
    ] : []),
  ];

  return (
    <>
      <Tooltip content={isVoiceLocked ? t("common:permissions.noJoinVoice") : undefined}>
        <button
          onClick={() => {
            if (isVoiceLocked) return;
            useUIStore.getState().navigateToChannel(serverId, channel.id);
          }}
          onContextMenu={(e) => { e.preventDefault(); setMenu({ x: e.clientX, y: e.clientY }); }}
          className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm w-full text-left transition-colors duration-[var(--duration-feedback)] ${
            isVoiceLocked
              ? "text-text-muted opacity-60 cursor-not-allowed"
              : isActive
                ? "bg-elevated text-text-primary"
                : hasUnread
                  ? "text-text-primary font-semibold hover:bg-elevated"
                  : "text-text-secondary hover:bg-elevated hover:text-text-primary active:bg-elevated-2"
          }`}
        >
          <span className={`flex-shrink-0 ${isMuted ? "opacity-40" : "opacity-70"} relative`}>
            <ChannelIcon type={channel.type} />
            {isVoiceLocked && (
              <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" className="absolute -bottom-0.5 -right-0.5 text-text-muted">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0110 0v4" fill="none" stroke="currentColor" strokeWidth="2" />
              </svg>
            )}
          </span>
          <span className="truncate flex-1">{channel.name}</span>
          {voiceCount > 0 && (
            <span className="text-[10px] font-medium text-live bg-live/15 px-1.5 py-0.5 rounded-full flex-shrink-0">
              {voiceCount}
            </span>
          )}
          {hasUnread && !isActive && (
            <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0 animate-badge-pop" />
          )}
        </button>
      </Tooltip>

      {menu && (
        <ContextMenu x={menu.x} y={menu.y} items={menuItems} onClose={() => setMenu(null)} />
      )}

      <EditChannelModal open={editOpen} onClose={() => setEditOpen(false)} channel={channel} />
    </>
  );
}

