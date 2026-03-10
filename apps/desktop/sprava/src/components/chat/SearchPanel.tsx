import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../../lib/api";
import type { Message } from "../../types/models";

interface SearchPanelProps {
  contextId: string;
  type: "channel" | "dm";
  onJumpToMessage: (messageId: string) => void;
  onClose: () => void;
}

export function SearchPanel({ contextId, type, onJumpToMessage, onClose }: SearchPanelProps) {
  const { t } = useTranslation("chat");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const doSearch = async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      setSearched(false);
      return;
    }
    setLoading(true);
    setSearched(true);
    try {
      let msgs: Message[];
      if (type === "dm") {
        msgs = (await api.dm.searchMessages(contextId, q.trim())) as Message[];
      } else {
        msgs = (await api.channels.searchMessages(contextId, q.trim())) as Message[];
      }
      setResults(msgs);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(value), 400);
  };

  return (
    <div className="w-72 border-l border-border-subtle flex flex-col bg-surface flex-shrink-0 animate-fade-slide-left">
      <div className="h-12 flex items-center gap-2 px-3 border-b border-border-subtle flex-shrink-0">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-text-muted flex-shrink-0">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          placeholder={t("search.placeholder")}
          className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-muted outline-none"
          onKeyDown={(e) => {
            if (e.key === "Escape") onClose();
          }}
        />
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
        {!loading && searched && results.length === 0 && (
          <p className="text-xs text-text-muted text-center py-8">{t("search.noResults")}</p>
        )}
        {!loading && results.map((msg) => (
          <button
            key={msg.id}
            onClick={() => onJumpToMessage(msg.id)}
            className="w-full text-left px-3 py-2.5 hover:bg-elevated transition-colors border-b border-border-subtle"
          >
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-xs font-medium text-text-primary truncate">
                {msg.author.username}
              </span>
              <span className="text-[10px] text-text-muted">
                {new Date(msg.createdAt).toLocaleDateString()}
              </span>
            </div>
            <p className="text-xs text-text-secondary line-clamp-2 leading-relaxed">
              {msg.content}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}
