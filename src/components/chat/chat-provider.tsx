"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import { trpc } from "@/lib/trpc/client";

// ── Types ───────────────────────────────────────────────────

interface TypingUser {
  userId: string;
  userName: string;
  conversationId: string;
  expiresAt: number;
}

interface ChatContextValue {
  isConnected: boolean;
  typingUsers: TypingUser[];
  activeConversationId: string | null;
  setActiveConversationId: (id: string | null) => void;
  unreadCounts: Record<string, number>;
  onlineUserIds: string[];
  isWidgetOpen: boolean;
  setWidgetOpen: (open: boolean) => void;
}

const ChatContext = createContext<ChatContextValue | null>(null);

// ── Provider ────────────────────────────────────────────────

export function ChatProvider({ children }: { children: ReactNode }) {
  const [isConnected, setConnected] = useState(false);
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<
    string | null
  >(null);
  const [onlineUserIds, setOnlineUserIds] = useState<string[]>([]);
  const [isWidgetOpen, setWidgetOpen] = useState(false);
  const wasConnectedRef = useRef(false);

  const utils = trpc.useUtils();

  // Fetch unread counts via tRPC
  const { data: unreadCounts = {} } = trpc.chat.getUnreadCounts.useQuery(
    undefined,
    { refetchInterval: 30_000 }
  );

  // Fetch online users
  useEffect(() => {
    const fetchOnline = async () => {
      try {
        const res = await fetch("/api/chat/online");
        if (res.ok) {
          const data = await res.json();
          setOnlineUserIds(data.onlineUserIds || []);
        }
      } catch {
        // Silently fail — will retry
      }
    };
    fetchOnline();
    const interval = setInterval(fetchOnline, 15_000);
    return () => clearInterval(interval);
  }, []);

  // ── SSE Connection with reconnect handling ──
  useEffect(() => {
    let es: EventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let isMounted = true;

    function connect() {
      if (!isMounted) return;
      es = new EventSource("/api/sse/chat");

      es.onopen = () => {
        if (!isMounted) return;
        // If this is a REconnect (was previously connected), invalidate all cached data
        if (wasConnectedRef.current) {
          console.log("[Chat SSE] Reconnected — refreshing data");
          utils.chat.listConversations.invalidate();
          utils.chat.getUnreadCounts.invalidate();
          if (activeConversationId) {
            utils.chat.getMessages.invalidate({
              conversationId: activeConversationId,
            });
          }
        }
        wasConnectedRef.current = true;
        setConnected(true);
      };

      es.onerror = () => {
        if (!isMounted) return;
        setConnected(false);
        // EventSource auto-reconnects, but if it closes permanently
        // (readyState === CLOSED), we reconnect manually after a delay
        if (es?.readyState === EventSource.CLOSED) {
          console.log("[Chat SSE] Connection closed, reconnecting in 5s...");
          reconnectTimer = setTimeout(connect, 5000);
        }
      };

      es.onmessage = (event) => {
        if (!isMounted) return;
        try {
          const data = JSON.parse(event.data);

          switch (data.type) {
            case "connected":
              setConnected(true);
              break;

            case "new_message":
              utils.chat.listConversations.invalidate();
              utils.chat.getUnreadCounts.invalidate();
              if (data.conversationId === activeConversationId) {
                utils.chat.getMessages.invalidate({
                  conversationId: data.conversationId,
                });
              }
              break;

            case "typing": {
              const newTyping: TypingUser = {
                userId: data.userId,
                userName: data.userName,
                conversationId: data.conversationId,
                expiresAt: Date.now() + 3000,
              };
              setTypingUsers((prev) => [
                ...prev.filter(
                  (t) =>
                    t.userId !== data.userId ||
                    t.conversationId !== data.conversationId
                ),
                newTyping,
              ]);
              break;
            }

            case "read_receipt":
              if (data.conversationId === activeConversationId) {
                utils.chat.getMessages.invalidate({
                  conversationId: data.conversationId,
                });
              }
              break;

            case "reaction":
              if (data.conversationId === activeConversationId) {
                utils.chat.getMessages.invalidate({
                  conversationId: data.conversationId,
                });
              }
              break;

            case "conv_joined":
              // New conversation was created or user was added — refresh list
              utils.chat.listConversations.invalidate();
              break;

            case "presence":
              if (data.status === "online") {
                setOnlineUserIds((prev) =>
                  prev.includes(data.userId) ? prev : [...prev, data.userId]
                );
              } else {
                setOnlineUserIds((prev) =>
                  prev.filter((id) => id !== data.userId)
                );
              }
              break;
          }
        } catch (err) {
          console.error("[Chat SSE] Parse error", err);
        }
      };
    }

    connect();

    return () => {
      isMounted = false;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      es?.close();
      setConnected(false);
    };
  }, [activeConversationId, utils]);

  // Clean up expired typing indicators
  useEffect(() => {
    const interval = setInterval(() => {
      setTypingUsers((prev) => prev.filter((t) => t.expiresAt > Date.now()));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <ChatContext.Provider
      value={{
        isConnected,
        typingUsers,
        activeConversationId,
        setActiveConversationId,
        unreadCounts,
        onlineUserIds,
        isWidgetOpen,
        setWidgetOpen,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export const useChat = () => {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChat must be used within ChatProvider");
  return ctx;
};
