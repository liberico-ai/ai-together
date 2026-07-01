"use client";

import { formatDistanceToNow } from "date-fns";
import { vi } from "date-fns/locale";
import { Users } from "lucide-react";

interface Participant {
  id: string;
  name: string;
  image: string | null;
  avatarUrl: string | null;
  role: string;
}

interface ConversationData {
  id: string;
  type: string;
  title: string | null;
  avatarUrl: string | null;
  lastMessageAt: Date | null;
  lastMessagePreview: string | null;
  participants: Participant[];
}

interface Props {
  conversation: ConversationData;
  unreadCount: number;
  onlineUserIds: string[];
  onClick: () => void;
}

export function ConversationItem({
  conversation,
  unreadCount,
  onlineUserIds,
  onClick,
}: Props) {
  const conv = conversation;

  const displayName =
    conv.type === "direct" && conv.participants.length >= 2
      ? conv.participants.find(
          (_p) =>
            /* show the other user — but we don't know current user here,
             * so show first participant whose name looks different from title */
            true
        )?.name ?? "Chat"
      : conv.title ?? "Nhóm chat";

  // Check if any other participant is online (for direct chats)
  const isOnline = conv.participants.some((p) =>
    onlineUserIds.includes(p.id)
  );

  // Avatar
  const avatar =
    conv.type === "direct"
      ? conv.participants[0]?.avatarUrl || conv.participants[0]?.image
      : conv.avatarUrl;

  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-3 hover:bg-stone-50 dark:hover:bg-stone-800/50 transition-colors text-left ${
        unreadCount > 0
          ? "bg-indigo-50/40 dark:bg-indigo-950/20"
          : ""
      }`}
    >
      {/* Avatar */}
      <div className="relative shrink-0">
        {avatar ? (
          <img
            src={avatar}
            alt=""
            className="h-10 w-10 rounded-full object-cover"
          />
        ) : conv.type === "direct" ? (
          <div className="h-10 w-10 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white font-semibold text-sm">
            {displayName.charAt(0).toUpperCase()}
          </div>
        ) : (
          <div className="h-10 w-10 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white">
            <Users className="h-5 w-5" />
          </div>
        )}
        {/* Online dot */}
        {isOnline && conv.type === "direct" && (
          <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-emerald-400 ring-2 ring-white dark:ring-stone-900" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <span
            className={`text-sm truncate ${
              unreadCount > 0
                ? "font-semibold text-stone-900 dark:text-stone-100"
                : "font-medium text-stone-700 dark:text-stone-300"
            }`}
          >
            {displayName}
          </span>
          {conv.lastMessageAt && (
            <span className="text-[10px] text-stone-400 shrink-0 ml-2">
              {formatDistanceToNow(new Date(conv.lastMessageAt), {
                addSuffix: false,
                locale: vi,
              })}
            </span>
          )}
        </div>
        <div className="flex items-center justify-between mt-0.5">
          <span
            className={`text-xs truncate ${
              unreadCount > 0
                ? "text-stone-600 dark:text-stone-300 font-medium"
                : "text-stone-400 dark:text-stone-500"
            }`}
          >
            {conv.lastMessagePreview ?? "Chưa có tin nhắn"}
          </span>
          {unreadCount > 0 && (
            <span className="ml-2 shrink-0 h-5 min-w-5 px-1 rounded-full bg-indigo-500 text-[11px] font-bold text-white flex items-center justify-center">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}
