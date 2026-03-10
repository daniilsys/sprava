import { useState, useRef, useEffect, KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";

interface MessageEditInputProps {
  initialContent: string;
  onSave: (content: string) => void;
  onCancel: () => void;
}

export function MessageEditInput({ initialContent, onSave, onCancel }: MessageEditInputProps) {
  const { t } = useTranslation("chat");
  const [content, setContent] = useState(initialContent);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
    if (textareaRef.current) {
      textareaRef.current.selectionStart = textareaRef.current.value.length;
    }
  }, []);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      const trimmed = content.trim();
      if (trimmed) onSave(trimmed);
    }
    if (e.key === "Escape") {
      onCancel();
    }
  };

  return (
    <div className="mt-1">
      <textarea
        ref={textareaRef}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onKeyDown={handleKeyDown}
        rows={1}
        className="w-full bg-elevated border border-border rounded-lg px-3 py-2 text-sm text-text-primary outline-none resize-none focus:border-primary transition-colors"
        onInput={() => {
          if (textareaRef.current) {
            textareaRef.current.style.height = "auto";
            textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + "px";
          }
        }}
      />
      <p className="text-xs text-text-muted mt-1">
        {t("edit.hint")}
      </p>
    </div>
  );
}
