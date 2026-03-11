import { useState, useMemo, memo } from "react";
import { useTranslation } from "react-i18next";
import { MessageActions } from "./MessageActions";
import { ReactionBar } from "./ReactionBar";
import { ReplyPreview } from "./ReplyPreview";
import { MessageEditInput } from "./MessageEditInput";
import { AttachmentPreview } from "./AttachmentPreview";
import { InviteEmbed, extractInviteCode } from "./InviteEmbed";
import { ContextMenu, type ContextMenuEntry } from "../ui/ContextMenu";
import { Icons } from "../ui/icons";
import { useAuthStore } from "../../store/auth.store";
import { useUIStore } from "../../store/ui.store";
import { useMessagesStore } from "../../store/messages.store";
import { useChannelPermission } from "../../hooks/usePermission";
import { P } from "../../constants/permissions";
import { confirm } from "../ui/ConfirmDialog";
import { api } from "../../lib/api";
import { renderMarkdown } from "../../lib/markdown";
import type { Message } from "../../types/models";

interface MessageItemProps {
  message: Message;
  isFirst: boolean;
  highlighted?: boolean;
  onJumpToMessage?: (messageId: string) => void;
}

export const MessageItem = memo(function MessageItem({ message, isFirst, highlighted, onJumpToMessage }: MessageItemProps) {
  const { t } = useTranslation("chat");
  const [hovered, setHovered] = useState(false);
  const [editing, setEditing] = useState(false);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);

  const userId = useAuthStore.getState().user?.id;
  const isOwn = userId === message.authorId;
  const serverId = useUIStore((s) => s.activeServerId);
  const isDm = !!message.dmConversationId;
  const channelId = message.channelId;
  const canModerate = useChannelPermission(isDm ? undefined : serverId ?? undefined, isDm ? undefined : channelId ?? undefined, P.MODERATE_MESSAGES);
  const canDelete = isOwn || canModerate;

  const currentUsername = useAuthStore.getState().user?.username;
  const renderedContent = useMemo(() => {
    let html = renderMarkdown(message.content);
    // Apply mention highlighting
    html = html.replace(
      /<span class="md-mention" data-mention="(\w+)">@(\w+)<\/span>/g,
      (_match, username, display) => {
        const isSelf = currentUsername && username.toLowerCase() === currentUsername.toLowerCase();
        const cls = isSelf
          ? "bg-primary/30 text-primary rounded px-1"
          : "bg-primary/20 text-primary rounded px-1";
        return `<span class="${cls}">@${display}</span>`;
      },
    );
    return html;
  }, [message.content, currentUsername]);

  const inviteCode = useMemo(() => extractInviteCode(message.content), [message.content]);

  const handleSaveEdit = async (content: string) => {
    try {
      await api.messages.edit(message.id, { content });
      const contextId = message.channelId || message.dmConversationId;
      if (contextId) {
        useMessagesStore.getState().editMessage(contextId, message.id, content, new Date().toISOString());
      }
    } catch {
      // Ignore
    }
    setEditing(false);
  };

  const handleReply = () => {
    useUIStore.getState().setReplyingTo({
      id: message.id,
      content: message.content.slice(0, 100),
      author: message.author.username,
    });
  };

  const handleDelete = async () => {
    if (!(await confirm(t("message.deleteConfirm")))) return;
    try {
      await api.messages.delete(message.id);
      const contextId = message.channelId || message.dmConversationId;
      if (contextId) {
        useMessagesStore.getState().deleteMessage(contextId, message.id);
      }
    } catch {
      // Ignore
    }
  };

  const menuItems: ContextMenuEntry[] = [
    { label: t("context.reply"), icon: Icons.reply, onClick: handleReply },
    { label: t("context.copyText"), icon: Icons.copy, onClick: () => navigator.clipboard.writeText(message.content) },
    { label: t("context.copyMessageId"), icon: Icons.hash, onClick: () => navigator.clipboard.writeText(message.id) },
    ...(isOwn || canDelete ? [{ separator: true } as const] : []),
    ...(isOwn ? [{ label: t("context.editMessage"), icon: Icons.pencil, onClick: () => setEditing(true) }] : []),
    ...(canDelete ? [{ label: t("context.deleteMessage"), icon: Icons.trash, onClick: handleDelete, variant: "danger" as const }] : []),
  ];

  return (
    <div
      id={`msg-${message.id}`}
      className={`relative group -mx-2 px-2 py-0.5 rounded transition-colors ${highlighted ? "animate-highlight" : "hover:bg-elevated/50"} ${message.pending ? "opacity-50" : ""} ${message.failed ? "opacity-70" : ""}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onContextMenu={(e) => { e.preventDefault(); setMenu({ x: e.clientX, y: e.clientY }); }}
    >
      {isFirst && message.replyTo && (
        <ReplyPreview reply={message.replyTo} onJumpToMessage={onJumpToMessage} />
      )}

      {editing ? (
        <MessageEditInput
          initialContent={message.content}
          onSave={handleSaveEdit}
          onCancel={() => setEditing(false)}
        />
      ) : (
        <div className="text-sm text-text-primary leading-relaxed break-words md-content">
          <span dangerouslySetInnerHTML={{ __html: renderedContent }} />
          {message.editedAt && (
            <span className="text-xs text-text-muted ml-1">{t("message.edited")}</span>
          )}
          {message.failed && (
            <span className="text-xs text-danger ml-2">{t("message.failedToSend")}</span>
          )}
        </div>
      )}

      {inviteCode && <InviteEmbed inviteCode={inviteCode} />}

      {message.attachments.length > 0 && (
        <AttachmentPreview attachments={message.attachments} />
      )}

      <ReactionBar reactions={message.reactions} messageId={message.id} />

      {hovered && !editing && (
        <MessageActions message={message} onEdit={() => setEditing(true)} />
      )}

      {menu && (
        <ContextMenu x={menu.x} y={menu.y} items={menuItems} onClose={() => setMenu(null)} />
      )}
    </div>
  );
}, (prev, next) =>
  prev.message.id === next.message.id &&
  prev.message.content === next.message.content &&
  prev.message.editedAt === next.message.editedAt &&
  prev.message.reactions.length === next.message.reactions.length &&
  prev.message.pending === next.message.pending &&
  prev.message.failed === next.message.failed &&
  prev.isFirst === next.isFirst &&
  prev.highlighted === next.highlighted &&
  prev.onJumpToMessage === next.onJumpToMessage,
);
