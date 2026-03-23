"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { useChat } from "./chat-provider";
import { ConversationItem } from "./conversation-item";
import { NewChatDialog } from "./new-chat-dialog";
import { Search, Plus, Loader2 } from "lucide-react";

export function ChatSidebar() {
  const [search, setSearch] = useState("");
  const [showNewChat, setShowNewChat] = useState(false);
  const { setActiveConversationId, unreadCounts, onlineUserIds } = useChat();

  const { data: conversations, isLoading } =
    trpc.chat.listConversations.useQuery();

  const filtered = (conversations ?? []).filter((conv) => {
    if (!search) return true;
    const q = search.toLowerCase();
    if (conv.title?.toLowerCase().includes(q)) return true;
    return conv.participants.some((p) =>
      p.name.toLowerCase().includes(q)
    );
  });

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Search + New Chat */}
      <div className="px-3 pt-3 pb-2 space-y-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
          <input
            type="text"
            placeholder="Tìm kiếm..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-9 pl-9 pr-3 rounded-lg border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 dark:text-stone-200 placeholder:text-stone-400"
          />
        </div>
        <button
          onClick={() => setShowNewChat(true)}
          className="w-full flex items-center gap-2 px-3 h-9 rounded-lg text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Cuộc trò chuyện mới
        </button>
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-stone-400" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-stone-500 dark:text-stone-400 italic">
            {search ? "Không tìm thấy" : "Chưa có cuộc trò chuyện nào"}
          </div>
        ) : (
          <div className="divide-y divide-stone-100 dark:divide-stone-800/50">
            {filtered.map((conv) => (
              <ConversationItem
                key={conv.id}
                conversation={conv}
                unreadCount={unreadCounts[conv.id] ?? 0}
                onlineUserIds={onlineUserIds}
                onClick={() => setActiveConversationId(conv.id)}
              />
            ))}
          </div>
        )}
      </div>

      {showNewChat && (
        <NewChatDialog onClose={() => setShowNewChat(false)} />
      )}
    </div>
  );
}
