"use client";

import { useChat } from "./chat-provider";
import { ChatSidebar } from "./chat-sidebar";
import { ChatWindow } from "./chat-window";
import { MessageSquare, X, Minus } from "lucide-react";
import { useMemo } from "react";

export function ChatWidget() {
  const { isWidgetOpen, setWidgetOpen, unreadCounts, isConnected } = useChat();

  const totalUnread = useMemo(
    () => Object.values(unreadCounts).reduce((a, b) => a + b, 0),
    [unreadCounts]
  );

  return (
    <>
      {/* ── Chat Bubble Button ── */}
      {!isWidgetOpen && (
        <button
          onClick={() => setWidgetOpen(true)}
          className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-500/30 hover:shadow-xl hover:shadow-indigo-500/40 hover:scale-105 transition-all duration-200 flex items-center justify-center"
          aria-label="Open chat"
        >
          <MessageSquare className="h-6 w-6" />
          {totalUnread > 0 && (
            <span className="absolute -top-1 -right-1 h-5 min-w-5 px-1 rounded-full bg-rose-500 text-[11px] font-bold text-white flex items-center justify-center ring-2 ring-white dark:ring-stone-950">
              {totalUnread > 99 ? "99+" : totalUnread}
            </span>
          )}
        </button>
      )}

      {/* ── Chat Widget Panel ── */}
      {isWidgetOpen && (
        <div className="fixed bottom-6 right-6 z-50 w-[420px] h-[640px] rounded-2xl overflow-hidden shadow-2xl shadow-black/20 dark:shadow-black/50 border border-stone-200 dark:border-stone-700/50 flex flex-col bg-white dark:bg-stone-900 animate-in slide-in-from-bottom-4 duration-300">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-stone-100 dark:border-stone-800/50 bg-gradient-to-r from-indigo-500 to-purple-600">
            <div className="flex items-center gap-2 text-white">
              <MessageSquare className="h-5 w-5" />
              <h3 className="font-semibold text-sm">Chat</h3>
              <span
                className={`h-2 w-2 rounded-full ${
                  isConnected
                    ? "bg-emerald-300"
                    : "bg-amber-400 animate-pulse"
                }`}
                title={isConnected ? "Đã kết nối" : "Đang kết nối lại..."}
              />
              {totalUnread > 0 && (
                <span className="h-5 min-w-5 px-1 rounded-full bg-white/20 text-[11px] font-bold flex items-center justify-center">
                  {totalUnread}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setWidgetOpen(false)}
                className="h-7 w-7 rounded-md hover:bg-white/20 transition-colors flex items-center justify-center text-white/80 hover:text-white"
              >
                <Minus className="h-4 w-4" />
              </button>
              <button
                onClick={() => setWidgetOpen(false)}
                className="h-7 w-7 rounded-md hover:bg-white/20 transition-colors flex items-center justify-center text-white/80 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Body */}
          <ChatBody />
        </div>
      )}
    </>
  );
}

function ChatBody() {
  const { activeConversationId, setActiveConversationId } = useChat();

  if (activeConversationId) {
    return (
      <ChatWindow
        conversationId={activeConversationId}
        onBack={() => setActiveConversationId(null)}
      />
    );
  }

  return <ChatSidebar />;
}
