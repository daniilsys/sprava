import { useEffect, useRef, useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAppStore } from "../../store/app.store";
import { useUIStore } from "../../store/ui.store";
import { Avatar } from "../ui/Avatar";

interface MentionAutocompleteProps {
  query: string;
  onSelect: (username: string) => void;
  onClose: () => void;
  visible: boolean;
}

export function MentionAutocomplete({
  query,
  onSelect,
  onClose,
  visible,
}: MentionAutocompleteProps) {
  const { t } = useTranslation("chat");
  const activeServerId = useUIStore((s) => s.activeServerId);
  const members = useAppStore((s) =>
    activeServerId ? s.members.get(activeServerId) : undefined,
  );

  const [selectedIndex, setSelectedIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const filtered = (() => {
    if (!members) return [];
    const q = query.toLowerCase();
    const results: { userId: string; username: string; avatar: string | null }[] = [];
    for (const member of members.values()) {
      if (!member.user) continue;
      if (member.user.username.toLowerCase().includes(q)) {
        results.push({
          userId: member.userId,
          username: member.user.username,
          avatar: member.user.avatar,
        });
      }
      if (results.length >= 5) break;
    }
    return results;
  })();

  // Reset selection when query or visibility changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query, visible]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!visible || filtered.length === 0) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % filtered.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + filtered.length) % filtered.length);
      } else if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        e.stopPropagation();
        onSelect(filtered[selectedIndex].username);
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    },
    [visible, filtered, selectedIndex, onSelect, onClose],
  );

  useEffect(() => {
    if (visible) {
      document.addEventListener("keydown", handleKeyDown, true);
      return () => document.removeEventListener("keydown", handleKeyDown, true);
    }
  }, [visible, handleKeyDown]);

  if (!visible || filtered.length === 0) return null;

  return (
    <div
      ref={listRef}
      className="absolute bottom-full left-0 right-0 mb-1 mx-4 bg-elevated border border-border rounded-xl shadow-lg overflow-hidden z-20"
    >
      <div className="py-1.5 px-2">
        <p className="text-xs text-text-muted px-2 py-1 font-medium uppercase tracking-wide">
          {t("mention.members")}
        </p>
        {filtered.map((member, i) => (
          <button
            key={member.userId}
            className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-left transition-colors ${
              i === selectedIndex
                ? "bg-primary/15 text-text-primary"
                : "text-text-secondary hover:bg-elevated-2"
            }`}
            onMouseDown={(e) => {
              e.preventDefault();
              onSelect(member.username);
            }}
            onMouseEnter={() => setSelectedIndex(i)}
          >
            <Avatar src={member.avatar} name={member.username} size="xs" />
            <span className="text-sm font-medium truncate">
              {member.username}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
