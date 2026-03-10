import { useState, useRef, useCallback, KeyboardEvent, DragEvent, ChangeEvent } from "react";
import { useTranslation } from "react-i18next";
import { useUIStore } from "../../store/ui.store";
import { useAuthStore } from "../../store/auth.store";
import { useMessagesStore } from "../../store/messages.store";
import { AttachmentUpload } from "./AttachmentUpload";
import { MentionAutocomplete } from "./MentionAutocomplete";
import { uploadAttachment } from "../../lib/upload";
import { translateError } from "../../lib/errorMapping";
import { api } from "../../lib/api";
import type { Message } from "../../types/models";

interface MessageInputProps {
  contextId: string;
  type: "channel" | "dm";
  onTyping: () => void;
  onStopTyping: () => void;
  canSend?: boolean;
  canUpload?: boolean;
}

export function MessageInput({
  contextId,
  type,
  onTyping,
  onStopTyping,
  canSend = true,
  canUpload = true,
}: MessageInputProps) {
  const { t } = useTranslation(["chat", "common"]);
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState<
    { url: string; filename: string; size: number; mimeType: string }[]
  >([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const replyingTo = useUIStore((s) => s.replyingTo);

  // Mention autocomplete state
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionVisible, setMentionVisible] = useState(false);
  const mentionStartRef = useRef<number | null>(null);

  const extractMentionQuery = useCallback((text: string, cursorPos: number) => {
    // Walk backward from cursor to find an unmatched '@'
    const before = text.slice(0, cursorPos);
    const atIndex = before.lastIndexOf("@");
    if (atIndex === -1) {
      setMentionVisible(false);
      return;
    }
    // '@' must be at start or preceded by a space/newline
    if (atIndex > 0 && !/[\s]/.test(before[atIndex - 1])) {
      setMentionVisible(false);
      return;
    }
    const query = before.slice(atIndex + 1);
    // No spaces in the query (single-word usernames)
    if (/\s/.test(query)) {
      setMentionVisible(false);
      return;
    }
    mentionStartRef.current = atIndex;
    setMentionQuery(query);
    setMentionVisible(true);
  }, []);

  const handleMentionSelect = useCallback((username: string) => {
    const start = mentionStartRef.current;
    if (start === null) return;
    const before = content.slice(0, start);
    const cursorPos = textareaRef.current?.selectionStart ?? content.length;
    const after = content.slice(cursorPos);
    const newContent = `${before}@${username} ${after}`;
    setContent(newContent);
    setMentionVisible(false);
    // Restore cursor position after the inserted mention
    const newCursorPos = start + username.length + 2; // @username + space
    requestAnimationFrame(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
      }
    });
  }, [content]);

  const handleMentionClose = useCallback(() => {
    setMentionVisible(false);
  }, []);

  const handleSend = async () => {
    const text = content.trim();
    if ((!text && pendingAttachments.length === 0) || sending || !canSend) return;

    setSending(true);
    onStopTyping();

    // Create optimistic message
    const user = useAuthStore.getState().user;
    const clientId = `optimistic-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    if (text && user) {
      const optimisticMsg: Message = {
        id: clientId,
        type: "DEFAULT",
        content: text,
        authorId: user.id,
        createdAt: new Date().toISOString(),
        editedAt: null,
        replyToId: replyingTo?.id ?? null,
        replyTo: null,
        author: user,
        reactions: [],
        attachments: [],
        pending: true,
        clientId,
      };
      useMessagesStore.getState().addMessage(contextId, optimisticMsg);
    }

    // Clear input immediately for responsiveness
    setContent("");
    const savedAttachments = [...pendingAttachments];
    setPendingAttachments([]);
    const savedReplyTo = replyingTo;
    useUIStore.getState().setReplyingTo(null);
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    try {
      const body: Record<string, unknown> = {};
      if (text) body.content = text;
      if (savedReplyTo?.id) body.replyToId = savedReplyTo.id;
      if (savedAttachments.length > 0) body.attachments = savedAttachments;

      if (type === "channel") {
        await api.channels.sendMessage(contextId, body);
      } else {
        await api.dm.sendMessage(contextId, body);
      }
    } catch (e: any) {
      console.error("Failed to send message:", e?.message || e);
      // Mark optimistic message as failed
      if (text) {
        useMessagesStore.setState((s) => {
          const messagesByContext = new Map(s.messagesByContext);
          const current = messagesByContext.get(contextId);
          if (current) {
            messagesByContext.set(
              contextId,
              current.map((m) => m.clientId === clientId ? { ...m, pending: false, failed: true } : m),
            );
          }
          return { messagesByContext };
        });
      }
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Let MentionAutocomplete handle keys when visible
    if (mentionVisible && (e.key === "ArrowUp" || e.key === "ArrowDown" || e.key === "Enter" || e.key === "Tab" || e.key === "Escape")) {
      return; // Handled by MentionAutocomplete's document keydown listener
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = () => {
    onTyping();
    // Auto-resize
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height =
        Math.min(textareaRef.current.scrollHeight, 200) + "px";
    }
  };

  const [uploadError, setUploadError] = useState("");
  const [dragging, setDragging] = useState(false);

  const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024; // 10 MB

  const handleFileSelected = async (file: File) => {
    if (file.size > MAX_ATTACHMENT_SIZE) {
      setUploadError(t("input.fileTooLarge", { size: `${(file.size / 1024 / 1024).toFixed(1)} MB` }));
      return;
    }
    setUploading(true);
    setUploadError("");
    try {
      const att = await uploadAttachment(file);
      setPendingAttachments((prev) => [...prev, att]);
    } catch (e: any) {
      setUploadError(translateError(e));
    } finally {
      setUploading(false);
    }
  };

  const removePendingAttachment = (index: number) => {
    setPendingAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(true);
  };

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(false);
  };

  const handleDrop = async (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(false);
    if (!canUpload) return;
    const files = Array.from(e.dataTransfer.files);
    for (const file of files) {
      await handleFileSelected(file);
    }
  };

  return (
    <div
      className="px-4 pb-4 pt-1 relative"
      onDragOver={handleDragOver}
      onDragEnter={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {dragging && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-primary/10 border-2 border-dashed border-primary rounded-xl m-2 pointer-events-none">
          <p className="text-sm font-medium text-primary">{t("input.dropFiles")}</p>
        </div>
      )}
      {/* Mention autocomplete */}
      <MentionAutocomplete
        query={mentionQuery}
        onSelect={handleMentionSelect}
        onClose={handleMentionClose}
        visible={mentionVisible}
      />

      {/* Reply preview */}
      {replyingTo && (
        <div className="flex items-center gap-2 px-4 py-2 mb-1 bg-elevated rounded-t-xl border-l-2 border-primary animate-fade-slide-up">
          <span className="text-xs text-text-secondary truncate flex-1">
            Replying to <span className="font-medium">{replyingTo.author}</span>
            : {replyingTo.content}
          </span>
          <button
            onClick={() => useUIStore.getState().setReplyingTo(null)}
            className="text-text-muted hover:text-text-primary flex-shrink-0"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      )}

      {/* Pending attachments */}
      {pendingAttachments.length > 0 && (
        <div className="flex gap-2 mb-1 flex-wrap">
          {pendingAttachments.map((att, i) => (
            <div key={i} className="flex items-center gap-1.5 px-2 py-1 bg-elevated rounded-lg text-xs">
              <span className="text-text-secondary truncate max-w-[120px]">{att.filename}</span>
              <button onClick={() => removePendingAttachment(i)} className="text-text-muted hover:text-danger">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {uploadError && (
        <p className="text-xs text-danger px-2 mb-1">{uploadError}</p>
      )}
      <div className={`flex items-end gap-2 bg-elevated rounded-xl border border-border px-4 py-3 transition-all ${canSend ? "input-glow" : "opacity-60"}`}>
        {canUpload && <AttachmentUpload onFileSelected={handleFileSelected} uploading={uploading} />}
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e: ChangeEvent<HTMLTextAreaElement>) => {
            if (!canSend) return;
            setContent(e.target.value);
            extractMentionQuery(e.target.value, e.target.selectionStart);
          }}
          onKeyDown={handleKeyDown}
          onInput={handleInput}
          placeholder={canSend ? t("chat:input.placeholder") : t("common:permissions.noSendMessages")}
          disabled={!canSend}
          rows={1}
          className={`flex-1 bg-transparent text-sm placeholder:text-text-muted outline-none resize-none max-h-[200px] leading-relaxed ${canSend ? "text-text-primary" : "text-text-muted cursor-not-allowed"}`}
        />
        <button
          onClick={handleSend}
          disabled={!canSend || (!content.trim() && pendingAttachments.length === 0) || sending}
          className="flex-shrink-0 text-primary hover:text-primary-hover disabled:text-text-muted transition-all active:scale-90"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
          </svg>
        </button>
      </div>
    </div>
  );
}
