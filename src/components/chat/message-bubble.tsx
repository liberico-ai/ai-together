"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { formatDistanceToNow } from "date-fns";
import { vi } from "date-fns/locale";
import { Check, CheckCheck, CornerUpLeft, Trash2, Pencil, Smile } from "lucide-react";
import { EmojiPicker } from "./emoji-picker";
import { MediaPreview } from "./media-preview";

interface Props {
  message: {
    id: string;
    content: string | null;
    messageType: string;
    mediaUrl: string | null;
    mediaType: string | null;
    fileName: string | null;
    fileSize: number | null;
    isEdited: boolean;
    isDeleted: boolean;
    createdAt: Date;
    sender: { id: string; name: string; image: string | null; avatarUrl: string | null } | null;
    replyTo?: {
      id: string;
      content: string | null;
      isDeleted: boolean;
      sender: { id: string; name: string } | null;
    } | null;
    reactions: { id: string; emoji: string; userId: string; user: { id: string; name: string } }[];
  };
  conversationId: string;
}

export function MessageBubble({ message, conversationId }: Props) {
  const [showEmoji, setShowEmoji] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const msg = message;

  const react = trpc.chat.react.useMutation();
  const deleteMsg = trpc.chat.deleteMessage.useMutation();

  // System message
  if (msg.messageType === "system" || !msg.sender) {
    return (
      <div className="flex justify-center py-1">
        <span className="text-[11px] text-stone-400 dark:text-stone-500 bg-stone-100 dark:bg-stone-800/50 px-3 py-1 rounded-full">
          {msg.content}
        </span>
      </div>
    );
  }

  // Deleted message
  if (msg.isDeleted) {
    return (
      <div className="flex justify-center py-0.5">
        <span className="text-[11px] text-stone-400 italic">
          Tin nhắn đã bị xóa
        </span>
      </div>
    );
  }

  // Group reactions by emoji
  const reactionGroups = msg.reactions.reduce(
    (acc, r) => {
      if (!acc[r.emoji]) acc[r.emoji] = [];
      acc[r.emoji].push(r.user.name);
      return acc;
    },
    {} as Record<string, string[]>
  );

  return (
    <div
      className="group flex gap-2 py-0.5"
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => {
        setShowActions(false);
        setShowEmoji(false);
      }}
    >
      {/* Avatar */}
      <div className="shrink-0 mt-1">
        {msg.sender.avatarUrl || msg.sender.image ? (
          <img
            src={msg.sender.avatarUrl || msg.sender.image || ""}
            alt=""
            className="h-7 w-7 rounded-full object-cover"
          />
        ) : (
          <div className="h-7 w-7 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-[11px] font-semibold">
            {msg.sender.name.charAt(0).toUpperCase()}
          </div>
        )}
      </div>

      {/* Message Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="text-xs font-semibold text-stone-700 dark:text-stone-300">
            {msg.sender.name}
          </span>
          <span className="text-[10px] text-stone-400">
            {formatDistanceToNow(new Date(msg.createdAt), {
              addSuffix: false,
              locale: vi,
            })}
          </span>
          {msg.isEdited && (
            <span className="text-[10px] text-stone-400 italic">(đã sửa)</span>
          )}
        </div>

        {/* Reply Quote */}
        {msg.replyTo && (
          <div className="mt-1 pl-2 border-l-2 border-indigo-300 dark:border-indigo-600">
            <span className="text-[11px] text-stone-400">
              {msg.replyTo.sender?.name ?? "User"}:
            </span>
            <span className="text-[11px] text-stone-500 ml-1">
              {msg.replyTo.isDeleted
                ? "Tin nhắn đã xóa"
                : msg.replyTo.content?.slice(0, 80) ?? "Media"}
            </span>
          </div>
        )}

        {/* Text Content */}
        {msg.content && (
          <p className="text-sm text-stone-800 dark:text-stone-200 whitespace-pre-wrap break-words mt-0.5">
            {msg.content}
          </p>
        )}

        {/* Media */}
        {msg.mediaUrl && (
          <MediaPreview
            url={msg.mediaUrl}
            type={msg.mediaType}
            fileName={msg.fileName}
            fileSize={msg.fileSize}
            conversationId={conversationId}
          />
        )}

        {/* Reactions */}
        {Object.keys(reactionGroups).length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {Object.entries(reactionGroups).map(([emoji, users]) => (
              <button
                key={emoji}
                onClick={() =>
                  react.mutate({ messageId: msg.id, emoji })
                }
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-stone-100 dark:bg-stone-800 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 text-xs transition-colors"
                title={users.join(", ")}
              >
                <span>{emoji}</span>
                <span className="text-stone-500 text-[10px]">
                  {users.length}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Action Buttons */}
      {showActions && (
        <div className="shrink-0 flex items-start gap-0.5 mt-1">
          <button
            onClick={() => setShowEmoji(!showEmoji)}
            className="h-6 w-6 rounded hover:bg-stone-100 dark:hover:bg-stone-800 flex items-center justify-center text-stone-400 hover:text-stone-600"
            title="React"
          >
            <Smile className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => deleteMsg.mutate({ messageId: msg.id })}
            className="h-6 w-6 rounded hover:bg-stone-100 dark:hover:bg-stone-800 flex items-center justify-center text-stone-400 hover:text-rose-500"
            title="Xóa"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Emoji Picker Popup */}
      {showEmoji && (
        <EmojiPicker
          onSelect={(emoji) => {
            react.mutate({ messageId: msg.id, emoji });
            setShowEmoji(false);
          }}
          onClose={() => setShowEmoji(false)}
        />
      )}
    </div>
  );
}
