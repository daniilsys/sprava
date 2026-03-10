import { useState, useRef } from "react";
import { useAuthStore } from "../../store/auth.store";
import { api } from "../../lib/api";
import { EmojiPicker } from "./EmojiPicker";
import type { Reaction } from "../../types/models";

interface ReactionBarProps {
  reactions: Reaction[];
  messageId: string;
}

interface GroupedReaction {
  emoji: string;
  count: number;
  userReacted: boolean;
}

function groupReactions(
  reactions: Reaction[],
  userId: string | undefined,
): GroupedReaction[] {
  const map = new Map<string, GroupedReaction>();

  for (const r of reactions) {
    const existing = map.get(r.emoji);
    if (existing) {
      existing.count++;
      if (r.userId === userId) {
        existing.userReacted = true;
      }
    } else {
      map.set(r.emoji, {
        emoji: r.emoji,
        count: 1,
        userReacted: r.userId === userId,
      });
    }
  }

  return Array.from(map.values());
}

export function ReactionBar({ reactions, messageId }: ReactionBarProps) {
  const userId = useAuthStore((s) => s.user?.id);
  const grouped = groupReactions(reactions, userId);
  const [pickerOpen, setPickerOpen] = useState(false);
  const addBtnRef = useRef<HTMLButtonElement>(null);

  if (grouped.length === 0) return null;

  const handleToggleReaction = async (emoji: string, alreadyReacted: boolean) => {
    try {
      if (alreadyReacted) {
        await api.messages.removeReaction(messageId, { emoji });
      } else {
        await api.messages.addReaction(messageId, { emoji });
      }
    } catch {
      // Error handled silently
    }
  };

  const handlePickerSelect = async (emoji: string) => {
    const existing = grouped.find((g) => g.emoji === emoji);
    if (existing?.userReacted) return;
    try {
      await api.messages.addReaction(messageId, { emoji });
    } catch {
      // Error handled silently
    }
    setPickerOpen(false);
  };

  return (
    <div className="flex gap-1 mt-1 flex-wrap items-center">
      {grouped.map((g) => (
        <button
          key={g.emoji}
          onClick={() => handleToggleReaction(g.emoji, g.userReacted)}
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs transition-all duration-150 active:scale-95 ${
            g.userReacted
              ? "bg-primary/20 border border-primary/40 text-primary"
              : "bg-elevated-2 border border-transparent hover:border-border-subtle text-text-secondary hover:text-text-primary"
          }`}
        >
          <span className="text-sm">{g.emoji}</span>
          <span>{g.count}</span>
        </button>
      ))}

      {/* Add reaction button */}
      <button
        ref={addBtnRef}
        onClick={() => setPickerOpen(!pickerOpen)}
        className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-elevated-2 border border-transparent hover:border-border-subtle text-text-muted hover:text-text-primary transition-all duration-150 text-xs active:scale-95"
        title="Add reaction"
      >
        +
      </button>
      {pickerOpen && (
        <EmojiPicker
          anchorRef={addBtnRef}
          onSelect={handlePickerSelect}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </div>
  );
}
