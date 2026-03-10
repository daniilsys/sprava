import { useTranslation } from "react-i18next";
import { useAppStore } from "../../store/app.store";
import { useAuthStore } from "../../store/auth.store";
import { useUIStore } from "../../store/ui.store";
import { useMessages } from "../../hooks/useMessages";
import { useTyping } from "../../hooks/useTyping";
import { useChannelPermission } from "../../hooks/usePermission";
import { P } from "../../constants/permissions";
import { MessageList } from "./MessageList";
import { MessageInput } from "./MessageInput";
import { TypingIndicator } from "./TypingIndicator";
import { DmHeader } from "./DmHeader";
import { SearchPanel } from "./SearchPanel";
import { PinnedMessagesPanel } from "./PinnedMessagesPanel";
import { IconButton } from "../ui/IconButton";

interface MessageAreaProps {
  contextId: string;
  type: "channel" | "dm";
}

export function MessageArea({ contextId, type }: MessageAreaProps) {
  const { t } = useTranslation("chat");
  const { messages, hasMore, loading, loadMore, markRead, jumpToMessage, jumpToPresent, isJumped, jumpedMessageId } = useMessages(contextId, type);
  const { typingUsernames, startTyping, stopTyping } = useTyping(contextId, type);
  const channel = useAppStore((s) =>
    type === "channel" ? s.channels.get(contextId) : undefined,
  );
  const dm = useAppStore((s) =>
    type === "dm" ? s.dms.get(contextId) : undefined,
  );
  const server = useAppStore((s) =>
    type === "channel" && channel ? s.servers.get(channel.serverId) : undefined,
  );
  const currentUserId = useAuthStore((s) => s.user?.id ?? "");
  const searchPanelOpen = useUIStore((s) => s.searchPanelOpen);
  const pinnedPanelOpen = useUIStore((s) => s.pinnedPanelOpen);

  const serverId = channel?.serverId;
  const canSend = type === "dm" || useChannelPermission(serverId, type === "channel" ? contextId : undefined, P.POST_MESSAGES);
  const canUpload = type === "dm" || useChannelPermission(serverId, type === "channel" ? contextId : undefined, P.UPLOAD);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      {type === "channel" && (
        <div className="h-12 flex items-center justify-between px-4 border-b border-border-subtle flex-shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            {server && (
              <>
                <span className="text-xs text-text-muted truncate max-w-[120px]">{server.name}</span>
                <span className="text-text-muted text-xs">/</span>
              </>
            )}
            <span className="text-text-muted">#</span>
            <h3 className="font-medium text-sm truncate">{channel?.name}</h3>
          </div>
          <div className="flex items-center gap-1">
            <IconButton
              size="sm"
              onClick={() => useUIStore.getState().togglePinnedPanel()}
              title={t("pinned.tooltip")}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="17" x2="12" y2="22" />
                <path d="M5 17h14v-1.76a2 2 0 00-1.11-1.79l-1.78-.9A2 2 0 0115 10.76V6h1a2 2 0 000-4H8a2 2 0 000 4h1v4.76a2 2 0 01-1.11 1.79l-1.78.9A2 2 0 005 15.24z" />
              </svg>
            </IconButton>
            <IconButton
              size="sm"
              onClick={() => useUIStore.getState().toggleSearchPanel()}
              title={t("search.tooltip")}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </IconButton>
            <IconButton
              size="sm"
              onClick={() => useUIStore.getState().toggleMemberList()}
              title={t("members.tooltip")}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4-4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 00-3-3.87" />
                <path d="M16 3.13a4 4 0 010 7.75" />
              </svg>
            </IconButton>
          </div>
        </div>
      )}
      {type === "dm" && dm && (
        <DmHeader dm={dm} currentUserId={currentUserId} contextId={contextId} onJumpToMessage={jumpToMessage} />
      )}

      {/* Main content area with optional side panels */}
      <div className="flex flex-1 min-h-0">
        <div className="flex-1 flex flex-col min-w-0">
          {/* Messages */}
          <MessageList
            messages={messages}
            hasMore={hasMore}
            loading={loading}
            onLoadMore={loadMore}
            onScrollBottom={markRead}
            highlightMessageId={jumpedMessageId}
            isJumped={isJumped}
            onJumpToPresent={jumpToPresent}
            onJumpToMessage={jumpToMessage}
          />

          {/* Typing */}
          <TypingIndicator names={typingUsernames} />

          {/* Input */}
          <MessageInput
            contextId={contextId}
            type={type}
            onTyping={startTyping}
            onStopTyping={stopTyping}
            canSend={canSend}
            canUpload={canUpload}
          />
        </div>

        {/* Search Panel */}
        {searchPanelOpen && (
          <SearchPanel
            contextId={contextId}
            type={type}
            onJumpToMessage={jumpToMessage}
            onClose={() => useUIStore.getState().toggleSearchPanel()}
          />
        )}

        {/* Pinned Messages Panel */}
        {pinnedPanelOpen && (
          <PinnedMessagesPanel
            contextId={contextId}
            type={type}
            onJumpToMessage={jumpToMessage}
            onClose={() => useUIStore.getState().togglePinnedPanel()}
          />
        )}
      </div>
    </div>
  );
}
