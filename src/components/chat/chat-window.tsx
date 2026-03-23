"use client";

import { useEffect, useRef, useCallback } from "react";
import { trpc } from "@/lib/trpc/client";
import { useChat } from "./chat-provider";
import { MessageBubble } from "./message-bubble";
import { MessageInput } from "./message-input";
import { TypingIndicator } from "./typing-indicator";
import { ArrowLeft, Settings, Loader2, Users } from "lucide-react";
import { useState } from "react";
import { GroupSettings } from "./group-settings";

interface Props {
  conversationId: string;
  onBack: () => void;
}

export function ChatWindow({ conversationId, onBack }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showSettings, setShowSettings] = useState(false);
  const { typingUsers, onlineUserIds } = useChat();

  // Mark as read
  const markAsRead = trpc.chat.markAsRead.useMutation();

  // Get conversations list to find current conv info
  const { data: conversations } = trpc.chat.listConversations.useQuery();
  const conv = conversations?.find((c) => c.id === conversationId);

  // Get messages with infinite scroll
  const {
    data,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = trpc.chat.getMessages.useInfiniteQuery(
    { conversationId, limit: 20 },
    {
      getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    }
  );

  const allMessages = data?.pages.flatMap((p) => p.items).reverse() ?? [];

  // Mark as read when opening or getting new messages
  useEffect(() => {
    markAsRead.mutate({ conversationId });
  }, [conversationId, allMessages.length]);

  // Auto-scroll to bottom when new message arrives
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [allMessages.length]);

  // Load more on scroll to top
  const handleScroll = useCallback(() => {
    if (!scrollRef.current || !hasNextPage || isFetchingNextPage) return;
    if (scrollRef.current.scrollTop < 100) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Typing users for this conversation
  const activeTyping = typingUsers.filter(
    (t) => t.conversationId === conversationId
  );

  // Display info
  const displayName =
    conv?.type === "direct"
      ? conv.participants.find((p) => true)?.name ?? "Chat"
      : conv?.title ?? "Nhóm chat";

  const isOnline =
    conv?.type === "direct" &&
    conv.participants.some((p) => onlineUserIds.includes(p.id));

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Chat Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-stone-100 dark:border-stone-800/50 bg-white dark:bg-stone-900">
        <button
          onClick={onBack}
          className="h-8 w-8 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors flex items-center justify-center text-stone-500"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-stone-900 dark:text-stone-100 truncate">
              {displayName}
            </span>
            {isOnline && (
              <span className="h-2 w-2 rounded-full bg-emerald-400 shrink-0" />
            )}
          </div>
          {conv?.type !== "direct" && (
            <span className="text-[11px] text-stone-400">
              {conv?.participants.length ?? 0} thành viên
            </span>
          )}
          {isOnline && conv?.type === "direct" && (
            <span className="text-[11px] text-emerald-500">Đang hoạt động</span>
          )}
        </div>
        {conv?.type !== "direct" && (
          <button
            onClick={() => setShowSettings(true)}
            className="h-8 w-8 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors flex items-center justify-center text-stone-500"
          >
            <Settings className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Messages Area */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-3 py-3 space-y-1"
      >
        {isFetchingNextPage && (
          <div className="flex justify-center py-2">
            <Loader2 className="h-4 w-4 animate-spin text-stone-400" />
          </div>
        )}
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-stone-400" />
          </div>
        ) : allMessages.length === 0 ? (
          <div className="text-center py-12 text-sm text-stone-400 italic">
            Bắt đầu cuộc trò chuyện! 💬
          </div>
        ) : (
          allMessages.map((msg) => (
            <MessageBubble
              key={msg.id}
              message={msg}
              conversationId={conversationId}
            />
          ))
        )}

        {/* Typing indicator */}
        {activeTyping.length > 0 && (
          <TypingIndicator
            users={activeTyping.map((t) => t.userName)}
          />
        )}
      </div>

      {/* Input */}
      <MessageInput conversationId={conversationId} />

      {/* Group Settings Dialog */}
      {showSettings && conv && (
        <GroupSettings
          conversation={conv}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}
