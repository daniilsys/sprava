import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../../lib/api";
import { useChannelPermission } from "../../hooks/usePermission";
import { P } from "../../constants/permissions";
import { useUIStore } from "../../store/ui.store";
import type { Pin } from "../../types/models";

interface PinnedMessagesPanelProps {
  contextId: string;
  type: "channel" | "dm";
  onJumpToMessage: (messageId: string) => void;
  onClose: () => void;
}

export function PinnedMessagesPanel({ contextId, type, onJumpToMessage, onClose }: PinnedMessagesPanelProps) {
  const { t } = useTranslation("chat");
  const [pins, setPins] = useState<Pin[]>([]);
  const [loading, setLoading] = useState(true);
  const serverId = useUIStore((s) => s.activeServerId);
  const canModerateHook = useChannelPermission(type === "channel" ? serverId ?? undefined : undefined, type === "channel" ? contextId : undefined, P.MODERATE_MESSAGES);
  const canModerate = type === "dm" || canModerateHook;

  useEffect(() => {
    const fetchPins = async () => {
      setLoading(true);
      try {
        let result: Pin[];
        if (type === "dm") {
          result = (await api.dm.getPins(contextId)) as Pin[];
        } else {
          result = (await api.channels.getPins(contextId)) as Pin[];
        }
        setPins(result);
      } catch {
        setPins([]);
      } finally {
        setLoading(false);
      }
    };
    fetchPins();
  }, [contextId, type]);

  const handleUnpin = async (messageId: string) => {
    try {
      if (type === "dm") {
        await api.dm.unpinMessage(contextId, { messageId });
      } else {
        await api.channels.unpinMessage(contextId, { messageId });
      }
      setPins((prev) => prev.filter((p) => p.messageId !== messageId));
    } catch {
      // Error handled silently
    }
  };

  return (
    <div className="w-72 border-l border-border-subtle flex flex-col bg-surface flex-shrink-0 animate-fade-slide-left">
      <div className="h-12 flex items-center justify-between px-3 border-b border-border-subtle flex-shrink-0">
        <div className="flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-text-muted flex-shrink-0">
            <line x1="12" y1="17" x2="12" y2="22" />
            <path d="M5 17h14v-1.76a2 2 0 00-1.11-1.79l-1.78-.9A2 2 0 0115 10.76V6h1a2 2 0 000-4H8a2 2 0 000 4h1v4.76a2 2 0 01-1.11 1.79l-1.78.9A2 2 0 005 15.24z" />
          </svg>
          <span className="text-sm font-medium text-text-primary">{t("pinned.title")}</span>
        </div>
        <button onClick={onClose} className="text-text-muted hover:text-text-primary">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="flex justify-center py-8">
            <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          </div>
        )}
        {!loading && pins.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 px-4">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-text-muted mb-3">
              <line x1="12" y1="17" x2="12" y2="22" />
              <path d="M5 17h14v-1.76a2 2 0 00-1.11-1.79l-1.78-.9A2 2 0 0115 10.76V6h1a2 2 0 000-4H8a2 2 0 000 4h1v4.76a2 2 0 01-1.11 1.79l-1.78.9A2 2 0 005 15.24z" />
            </svg>
            <p className="text-xs text-text-muted text-center">{t("pinned.empty")}</p>
          </div>
        )}
        {!loading && pins.map((pin) => (
          <div
            key={pin.id}
            className="border-b border-border-subtle hover:bg-elevated transition-colors"
          >
            <button
              onClick={() => onJumpToMessage(pin.messageId)}
              className="w-full text-left px-3 py-2.5"
            >
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-xs font-medium text-text-primary truncate">
                  {pin.message.author.username}
                </span>
                <span className="text-[10px] text-text-muted">
                  {new Date(pin.message.createdAt).toLocaleDateString()}
                </span>
              </div>
              <p className="text-xs text-text-secondary line-clamp-3 leading-relaxed">
                {pin.message.content}
              </p>
            </button>
            {canModerate && (
              <div className="px-3 pb-2">
                <button
                  onClick={() => handleUnpin(pin.messageId)}
                  className="text-[10px] text-text-muted hover:text-danger transition-colors"
                >
                  {t("pinned.unpin")}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
