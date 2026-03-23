"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { useChat } from "./chat-provider";
import {
  X,
  Loader2,
  UserPlus,
  UserMinus,
  LogOut,
  Check,
  Search,
  Pencil,
  Users,
} from "lucide-react";

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
  myRole: string;
  participants: Participant[];
}

interface Props {
  conversation: ConversationData;
  onClose: () => void;
}

export function GroupSettings({ conversation, onClose }: Props) {
  const conv = conversation;
  const [isEditing, setEditing] = useState(false);
  const [title, setTitle] = useState(conv.title ?? "");
  const [search, setSearch] = useState("");
  const [showAddMember, setShowAddMember] = useState(false);

  const utils = trpc.useUtils();
  const { setActiveConversationId } = useChat();

  const updateGroup = trpc.chat.updateGroup.useMutation({
    onSuccess: () => {
      utils.chat.listConversations.invalidate();
      setEditing(false);
    },
  });

  const removeMember = trpc.chat.removeParticipant.useMutation({
    onSuccess: () => {
      utils.chat.listConversations.invalidate();
    },
  });

  const leaveGroup = trpc.chat.removeParticipant.useMutation({
    onSuccess: () => {
      utils.chat.listConversations.invalidate();
      setActiveConversationId(null);
      onClose();
    },
  });

  const isAdmin = conv.myRole === "admin";

  return (
    <div className="absolute inset-0 z-20 bg-white dark:bg-stone-900 flex flex-col animate-in slide-in-from-right-2 duration-200">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-stone-100 dark:border-stone-800/50">
        <h3 className="font-semibold text-sm text-stone-900 dark:text-stone-100">
          Cài đặt nhóm
        </h3>
        <button
          onClick={onClose}
          className="h-7 w-7 rounded-md hover:bg-stone-100 dark:hover:bg-stone-800 flex items-center justify-center text-stone-400"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Group Info */}
        <div className="px-4 py-4 space-y-3">
          <div className="flex items-center justify-center">
            <div className="h-16 w-16 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white">
              <Users className="h-8 w-8" />
            </div>
          </div>

          {/* Title Edit */}
          {isEditing ? (
            <div className="flex gap-2">
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="flex-1 h-9 px-3 rounded-lg border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-sm dark:text-stone-200"
                autoFocus
              />
              <button
                onClick={() =>
                  updateGroup.mutate({
                    conversationId: conv.id,
                    title,
                  })
                }
                disabled={updateGroup.isPending}
                className="h-9 px-3 rounded-lg bg-indigo-500 text-white text-sm"
              >
                {updateGroup.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2">
              <span className="font-semibold text-stone-900 dark:text-stone-100">
                {conv.title}
              </span>
              {isAdmin && (
                <button
                  onClick={() => setEditing(true)}
                  className="text-stone-400 hover:text-indigo-500"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Members */}
        <div className="px-4 pb-2">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-stone-500 uppercase tracking-wider">
              Thành viên ({conv.participants.length})
            </span>
            {isAdmin && (
              <button
                onClick={() => setShowAddMember(!showAddMember)}
                className="text-xs text-indigo-500 hover:text-indigo-600 flex items-center gap-1"
              >
                <UserPlus className="h-3.5 w-3.5" />
                Thêm
              </button>
            )}
          </div>

          <div className="space-y-1">
            {conv.participants.map((p) => (
              <div
                key={p.id}
                className="flex items-center gap-3 px-2 py-2 rounded-lg"
              >
                {p.avatarUrl || p.image ? (
                  <img
                    src={p.avatarUrl || p.image || ""}
                    alt=""
                    className="h-8 w-8 rounded-full object-cover"
                  />
                ) : (
                  <div className="h-8 w-8 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-xs font-semibold">
                    {p.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <span className="text-sm text-stone-700 dark:text-stone-300 truncate block">
                    {p.name}
                  </span>
                  {p.role === "admin" && (
                    <span className="text-[10px] text-indigo-500 font-medium">
                      Quản trị viên
                    </span>
                  )}
                </div>
                {isAdmin && p.role !== "admin" && (
                  <button
                    onClick={() =>
                      removeMember.mutate({
                        conversationId: conv.id,
                        userId: p.id,
                      })
                    }
                    disabled={removeMember.isPending}
                    className="h-7 w-7 rounded-md hover:bg-rose-50 dark:hover:bg-rose-900/20 flex items-center justify-center text-stone-400 hover:text-rose-500"
                  >
                    <UserMinus className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Leave Group */}
        <div className="px-4 py-4 border-t border-stone-100 dark:border-stone-800/50 mt-4">
          <button
            onClick={() => {
              if (confirm("Bạn chắc chắn muốn rời nhóm?")) {
                leaveGroup.mutate({
                  conversationId: conv.id,
                  userId: "self", // The backend will use ctx.user.id
                });
              }
            }}
            className="w-full flex items-center justify-center gap-2 h-9 rounded-lg text-sm font-medium text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Rời nhóm
          </button>
        </div>
      </div>
    </div>
  );
}
