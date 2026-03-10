import { useState, useEffect, useRef, useCallback } from "react";
import { getSocket } from "../lib/socket";

interface TypingEntry {
  username: string;
  timeout: ReturnType<typeof setTimeout>;
}

export function useTyping(
  contextId: string | null,
  type: "channel" | "dm",
) {
  const [typingUsernames, setTypingUsernames] = useState<string[]>([]);
  const typingMapRef = useRef<Map<string, TypingEntry>>(new Map());
  const lastSentRef = useRef(0);

  // Listen for typing events
  useEffect(() => {
    const socket = getSocket();
    if (!socket || !contextId) return;

    const eventName = type === "channel" ? "channel:typing" : "dm:typing";

    const handler = (data: {
      userId: string;
      username?: string;
      channelId?: string;
      dmConversationId?: string;
      typing: boolean;
    }) => {
      const incomingId =
        type === "channel" ? data.channelId : data.dmConversationId;
      if (incomingId !== contextId) return;

      const map = typingMapRef.current;
      const existing = map.get(data.userId);
      if (existing) clearTimeout(existing.timeout);

      if (data.typing) {
        const timeout = setTimeout(() => {
          map.delete(data.userId);
          setTypingUsernames(Array.from(map.values()).map((e) => e.username));
        }, 5000);
        map.set(data.userId, { username: data.username ?? "Someone", timeout });
      } else {
        map.delete(data.userId);
      }

      setTypingUsernames(Array.from(map.values()).map((e) => e.username));
    };

    socket.on(eventName, handler);

    return () => {
      socket.off(eventName, handler);
      typingMapRef.current.forEach((t) => clearTimeout(t.timeout));
      typingMapRef.current.clear();
      setTypingUsernames([]);
    };
  }, [contextId, type]);

  const startTyping = useCallback(() => {
    const socket = getSocket();
    if (!socket || !contextId) return;

    const now = Date.now();
    if (now - lastSentRef.current < 3000) return;
    lastSentRef.current = now;

    const payload =
      type === "channel"
        ? { channelId: contextId }
        : { dmConversationId: contextId };
    socket.emit("typing:start", payload);
  }, [contextId, type]);

  const stopTyping = useCallback(() => {
    const socket = getSocket();
    if (!socket || !contextId) return;

    lastSentRef.current = 0;
    const payload =
      type === "channel"
        ? { channelId: contextId }
        : { dmConversationId: contextId };
    socket.emit("typing:stop", payload);
  }, [contextId, type]);

  return { typingUsernames, startTyping, stopTyping };
}
