import { useTranslation } from "react-i18next";
import type { ReplyTo } from "../../types/models";

interface ReplyPreviewProps {
  reply: ReplyTo;
  onJumpToMessage?: (messageId: string) => void;
}

export function ReplyPreview({ reply, onJumpToMessage }: ReplyPreviewProps) {
  const { t } = useTranslation("chat");
  const handleClick = () => {
    if (!reply.deleted && onJumpToMessage) {
      onJumpToMessage(reply.id);
    }
  };

  return (
    <div
      className={`flex items-center gap-1.5 mb-1 text-xs text-text-secondary ${!reply.deleted ? "cursor-pointer hover:text-text-primary transition-colors" : ""}`}
      onClick={handleClick}
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
        <polyline points="9 17 4 12 9 7" />
        <path d="M20 18v-2a4 4 0 00-4-4H4" />
      </svg>
      {reply.deleted ? (
        <span className="italic">{t("message.replyDeleted")}</span>
      ) : (
        <>
          {reply.author && (
            <span className="font-medium text-text-primary">
              {reply.author.username}
            </span>
          )}
          <span className="truncate">{reply.content}</span>
        </>
      )}
    </div>
  );
}
