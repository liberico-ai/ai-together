"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { useChat } from "./chat-provider";
import {
  Search,
  X,
  Loader2,
  UserPlus,
  Check,
} from "lucide-react";

interface Props {
  onClose: () => void;
}

export function NewChatDialog({ onClose }: Props) {
  const [mode, setMode] = useState<"direct" | "group">("direct");
  const [search, setSearch] = useState("");
  const [groupTitle, setGroupTitle] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const { setActiveConversationId, setWidgetOpen } = useChat();

  const utils = trpc.useUtils();
  const { data: allUsers, isLoading } = trpc.users.searchUsers.useQuery(
    { query: search }
  );
  const createDirect = trpc.chat.createDirect.useMutation({
    onSuccess: (data) => {
      utils.chat.listConversations.invalidate();
      setActiveConversationId(data.id);
      onClose();
    },
  });
  const createGroup = trpc.chat.createGroup.useMutation({
    onSuccess: (data) => {
      utils.chat.listConversations.invalidate();
      setActiveConversationId(data.id);
      onClose();
    },
  });

  const filtered = allUsers ?? [];

  const toggleUser = (id: string) => {
    if (mode === "direct") {
      createDirect.mutate({ userId: id });
      return;
    }
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleCreateGroup = () => {
    if (!groupTitle.trim() || selectedIds.length === 0) return;
    createGroup.mutate({ title: groupTitle.trim(), participantIds: selectedIds });
  };

  return (
    <div className="absolute inset-0 z-20 bg-white dark:bg-stone-900 flex flex-col animate-in slide-in-from-bottom-2 duration-200">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-stone-100 dark:border-stone-800/50">
        <h3 className="font-semibold text-sm text-stone-900 dark:text-stone-100">
          {mode === "direct" ? "Nhắn tin mới" : "Tạo nhóm mới"}
        </h3>
        <button
          onClick={onClose}
          className="h-7 w-7 rounded-md hover:bg-stone-100 dark:hover:bg-stone-800 flex items-center justify-center text-stone-400 hover:text-stone-600"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Mode Toggle */}
      <div className="flex px-3 pt-3 gap-2">
        <button
          onClick={() => { setMode("direct"); setSelectedIds([]); }}
          className={`flex-1 h-8 rounded-lg text-xs font-medium transition-colors ${
            mode === "direct"
              ? "bg-indigo-500 text-white"
              : "bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700"
          }`}
        >
          Chat 1-1
        </button>
        <button
          onClick={() => setMode("group")}
          className={`flex-1 h-8 rounded-lg text-xs font-medium transition-colors ${
            mode === "group"
              ? "bg-indigo-500 text-white"
              : "bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700"
          }`}
        >
          Tạo nhóm
        </button>
      </div>

      {/* Group Title */}
      {mode === "group" && (
        <div className="px-3 pt-3">
          <input
            type="text"
            placeholder="Tên nhóm..."
            value={groupTitle}
            onChange={(e) => setGroupTitle(e.target.value)}
            className="w-full h-9 px-3 rounded-lg border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 dark:text-stone-200"
          />
        </div>
      )}

      {/* Search */}
      <div className="px-3 pt-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
          <input
            type="text"
            placeholder="Tìm người dùng..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-9 pl-9 pr-3 rounded-lg border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 dark:text-stone-200"
          />
        </div>
      </div>

      {/* User List */}
      <div className="flex-1 overflow-y-auto mt-2">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-stone-400" />
          </div>
        ) : (
          filtered.map((user) => (
            <button
              key={user.id}
              onClick={() => toggleUser(user.id)}
              disabled={createDirect.isPending}
              className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-stone-50 dark:hover:bg-stone-800/50 transition-colors"
            >
              {user.image ? (
                <img
                  src={user.image}
                  alt=""
                  className="h-9 w-9 rounded-full object-cover"
                />
              ) : (
                <div className="h-9 w-9 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-sm font-semibold">
                  {user.name.charAt(0).toUpperCase()}
                </div>
              )}
              <span className="flex-1 text-sm text-stone-700 dark:text-stone-300 text-left truncate">
                {user.name}
              </span>
              {mode === "group" && (
                <div
                  className={`h-5 w-5 rounded border ${
                    selectedIds.includes(user.id)
                      ? "bg-indigo-500 border-indigo-500"
                      : "border-stone-300 dark:border-stone-600"
                  } flex items-center justify-center`}
                >
                  {selectedIds.includes(user.id) && (
                    <Check className="h-3 w-3 text-white" />
                  )}
                </div>
              )}
            </button>
          ))
        )}
      </div>

      {/* Create Group Button */}
      {mode === "group" && selectedIds.length > 0 && (
        <div className="px-3 py-3 border-t border-stone-100 dark:border-stone-800/50">
          <button
            onClick={handleCreateGroup}
            disabled={!groupTitle.trim() || createGroup.isPending}
            className="w-full h-9 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {createGroup.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <UserPlus className="h-4 w-4" />
                Tạo nhóm ({selectedIds.length} thành viên)
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
