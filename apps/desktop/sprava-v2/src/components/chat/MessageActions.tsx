import { useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "../../store/auth.store";
import { useUIStore } from "../../store/ui.store";
import { useMessagesStore } from "../../store/messages.store";
import { useChannelPermission } from "../../hooks/usePermission";
import { P } from "../../constants/permissions";
import { confirm } from "../ui/ConfirmDialog";
import { api } from "../../lib/api";
import { Tooltip } from "../ui/Tooltip";
import { EmojiPicker } from "./EmojiPicker";
import type { Message } from "../../types/models";

interface MessageActionsProps {
  message: Message;
  onEdit?: () => void;
}

const actionBtnClass =
  "inline-flex items-center justify-center w-7 h-7 rounded-md transition-all duration-150 text-text-secondary hover:text-text-primary hover:bg-white/[0.08] active:scale-90 active:bg-white/[0.12]";

const dangerBtnClass =
  "inline-flex items-center justify-center w-7 h-7 rounded-md transition-all duration-150 text-text-secondary hover:text-danger hover:bg-danger/10 active:scale-90 active:bg-danger/15";

export function MessageActions({ message, onEdit }: MessageActionsProps) {
  const { t } = useTranslation("chat");
  const userId = useAuthStore.getState().user?.id;
  const isOwn = userId === message.authorId;
  const serverId = useUIStore((s) => s.activeServerId);
  const isDm = !!message.dmConversationId;
  const channelId = message.channelId;
  const canModerateHook = useChannelPermission(isDm ? undefined : serverId ?? undefined, isDm ? undefined : channelId ?? undefined, P.MODERATE_MESSAGES);
  const canModerate = !isDm && serverId && channelId ? canModerateHook : false;
  const canDelete = isOwn || canModerate;
  const canPin = isDm || canModerate;
  const canReactHook = useChannelPermission(isDm ? undefined : serverId ?? undefined, isDm ? undefined : channelId ?? undefined, P.REACT);
  const canReact = isDm || !serverId || !channelId || canReactHook;

  const [pinLoading, setPinLoading] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerAnchorRef = useRef<HTMLButtonElement>(null);

  const handleReply = () => {
    useUIStore.getState().setReplyingTo({
      id: message.id,
      content: message.content.slice(0, 100),
      author: message.author.username,
    });
  };

  const handleDelete = async (e: React.MouseEvent) => {
    if (!e.shiftKey) {
      if (!(await confirm(t("message.deleteConfirm")))) return;
    }
    try {
      await api.messages.delete(message.id);
      const contextId = message.channelId || message.dmConversationId;
      if (contextId) {
        useMessagesStore.getState().deleteMessage(contextId, message.id);
      }
    } catch {
      // Error handled silently
    }
  };

  const handlePin = async () => {
    if (pinLoading) return;
    setPinLoading(true);
    try {
      const contextId = message.channelId || message.dmConversationId;
      if (!contextId) return;

      if (isDm) {
        await api.dm.pinMessage(contextId, { messageId: message.id });
      } else {
        await api.channels.pinMessage(contextId, { messageId: message.id });
      }
    } catch {
      // Error handled silently
    } finally {
      setPinLoading(false);
    }
  };

  const handleQuickReact = async () => {
    const emoji = "\u{2764}\u{FE0F}";
    const alreadyReacted = message.reactions.some(
      (r) => r.emoji === emoji && r.userId === userId,
    );
    try {
      if (alreadyReacted) {
        await api.messages.removeReaction(message.id, { emoji });
      } else {
        await api.messages.addReaction(message.id, { emoji });
      }
    } catch {
      // Error handled silently
    }
  };

  const handlePickerSelect = async (emoji: string) => {
    const alreadyReacted = message.reactions.some(
      (r) => r.emoji === emoji && r.userId === userId,
    );
    if (alreadyReacted) return;
    try {
      await api.messages.addReaction(message.id, { emoji });
    } catch {
      // Error handled silently
    }
    setPickerOpen(false);
  };

  return (
    <div className="absolute -top-4 right-2 bg-elevated border border-border rounded-lg shadow-lg flex gap-0.5 p-0.5 z-10 animate-fade-slide-up">
      {/* Quick react ❤️ */}
      {canReact && (
        <Tooltip content={t("actions.reactHeart")}>
          <button className={actionBtnClass} onClick={handleQuickReact}>
            <span className="text-sm leading-none">❤️</span>
          </button>
        </Tooltip>
      )}

      {/* Emoji picker */}
      {canReact && (
        <Tooltip content={t("actions.addReaction")}>
          <button
            ref={pickerAnchorRef}
            className={actionBtnClass}
            onClick={() => setPickerOpen(!pickerOpen)}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M8 14s1.5 2 4 2 4-2 4-2" />
              <line x1="9" y1="9" x2="9.01" y2="9" />
              <line x1="15" y1="9" x2="15.01" y2="9" />
            </svg>
          </button>
        </Tooltip>
      )}

      {/* Reply */}
      <Tooltip content={t("actions.reply")}>
        <button className={actionBtnClass} onClick={handleReply}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 17 4 12 9 7" />
            <path d="M20 18v-2a4 4 0 00-4-4H4" />
          </svg>
        </button>
      </Tooltip>

      {/* Pin */}
      {canPin && (
        <Tooltip content={t("actions.pinMessage")}>
          <button className={actionBtnClass} onClick={handlePin}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="17" x2="12" y2="22" />
              <path d="M5 17h14v-1.76a2 2 0 00-1.11-1.79l-1.78-.9A2 2 0 0115 10.76V6h1a2 2 0 000-4H8a2 2 0 000 4h1v4.76a2 2 0 01-1.11 1.79l-1.78.9A2 2 0 005 15.24z" />
            </svg>
          </button>
        </Tooltip>
      )}

      {/* Edit (own messages only) */}
      {isOwn && onEdit && (
        <Tooltip content={t("actions.edit")}>
          <button className={actionBtnClass} onClick={onEdit}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </button>
        </Tooltip>
      )}

      {/* Delete (own messages or moderate permission) */}
      {canDelete && (
        <Tooltip content={t("actions.delete")}>
          <button className={dangerBtnClass} onClick={(e) => handleDelete(e)}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
            </svg>
          </button>
        </Tooltip>
      )}

      {pickerOpen && (
        <EmojiPicker
          anchorRef={pickerAnchorRef}
          onSelect={handlePickerSelect}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </div>
  );
}
