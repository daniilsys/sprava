import { useState, useRef, useMemo, memo } from "react";
import { createPortal } from "react-dom";
import { Avatar } from "../ui/Avatar";
import { MessageItem } from "./MessageItem";
import { UserProfilePopup } from "../user/UserProfilePopup";
import { useUIStore } from "../../store/ui.store";
import { useAppStore } from "../../store/app.store";
import { getRoleColor } from "../../utils/roles";
import type { Message, User } from "../../types/models";

interface MessageGroupProps {
  group: {
    authorId: string;
    author: User;
    firstTimestamp: string;
    messages: Message[];
  };
  highlightId?: string | null;
  onJumpToMessage?: (messageId: string) => void;
}

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();

  const time = date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  if (isToday) return `Today at ${time}`;

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString())
    return `Yesterday at ${time}`;

  return `${date.toLocaleDateString()} ${time}`;
}

export const MessageGroup = memo(function MessageGroup({ group, highlightId, onJumpToMessage }: MessageGroupProps) {
  const [profileOpen, setProfileOpen] = useState(false);
  const avatarRef = useRef<HTMLDivElement>(null);
  const closedAtRef = useRef(0);
  const serverId = useUIStore((s) => s.activeServerId);

  // Role color for author username
  const rolesMap = useAppStore((s) => s.roles);
  const memberMap = useAppStore((s) => serverId ? s.members.get(serverId) : undefined);
  const roleColor = useMemo(() => {
    if (!serverId) return null;
    const member = memberMap?.get(group.authorId);
    return getRoleColor(member?.roleIds, rolesMap);
  }, [serverId, group.authorId, memberMap, rolesMap]);

  const handleAvatarClick = () => {
    if (Date.now() - closedAtRef.current < 100) return;
    setProfileOpen((v) => !v);
  };

  return (
    <div className="flex gap-3 py-1 -mx-2 px-2 rounded-lg hover:bg-elevated/30 transition-colors">
      <div ref={avatarRef} onClick={handleAvatarClick} className="cursor-pointer mt-0.5 flex-shrink-0 hover:scale-105 transition-transform">
        <Avatar
          src={group.author.avatar}
          name={group.author.username}
          size="md"
        />
      </div>
      {profileOpen && avatarRef.current && createPortal(
        <UserProfilePopup
          user={group.author}
          serverId={serverId}
          anchorRect={avatarRef.current.getBoundingClientRect()}
          onClose={() => { closedAtRef.current = Date.now(); setProfileOpen(false); }}
        />,
        document.body,
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span
            className={`font-medium text-sm ${roleColor ? "" : "text-text-primary"}`}
            style={roleColor ? { color: roleColor } : undefined}
          >
            {group.author.username}
          </span>
          <span className="font-mono text-xs text-text-muted">
            {formatTimestamp(group.firstTimestamp)}
          </span>
        </div>
        {group.messages.map((msg, i) => (
          <MessageItem key={msg.id} message={msg} isFirst={i === 0} highlighted={highlightId === msg.id} onJumpToMessage={onJumpToMessage} />
        ))}
      </div>
    </div>
  );
});
