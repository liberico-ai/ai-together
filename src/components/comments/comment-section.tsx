"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { trpc } from "@/lib/trpc/client";
import { useSession } from "@/lib/auth/client";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";
import { Loader2, Send, Trash2 } from "lucide-react";
import { MarkdownEditor, MarkdownPreview } from "@/components/ui/markdown-editor";

interface CommentSectionProps {
  targetType: "module" | "task";
  targetId: string;
}

function MentionPopup({
  query,
  onSelect,
  onClose,
  position,
}: {
  query: string;
  onSelect: (user: { id: string; name: string; username: string | null }) => void;
  onClose: () => void;
  position: { top: number; left: number };
}) {
  const { data: users, isLoading } = trpc.users.searchUsers.useQuery(
    { query },
    { enabled: query.length >= 0 }
  );
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!users || users.length === 0) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % users.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + users.length) % users.length);
      } else if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        onSelect(users[selectedIndex]);
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [users, selectedIndex, onSelect, onClose]);

  if (!users && !isLoading) return null;

  return (
    <div
      className="absolute z-50 min-w-[240px] max-h-[200px] overflow-y-auto
        rounded-xl border border-border bg-popover shadow-xl
        animate-in fade-in-0 zoom-in-95 duration-150"
      style={{ bottom: position.top, left: position.left }}
    >
      {isLoading ? (
        <div className="flex items-center justify-center p-4">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      ) : !users || users.length === 0 ? (
        <div className="p-3 text-sm text-muted-foreground text-center">No users found</div>
      ) : (
        users.map((user, idx) => (
          <button
            key={user.id}
            onClick={() => onSelect(user)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors
              ${idx === selectedIndex
                ? "bg-primary/10 text-primary"
                : "hover:bg-muted/50 text-foreground"
              }`}
          >
            <Avatar className="h-6 w-6 shrink-0">
              <AvatarFallback className="bg-coral-100 text-coral-700 dark:bg-coral-900/30 dark:text-coral-400 text-[10px]">
                {user.name?.charAt(0) || "?"}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user.name}</p>
              {user.username && (
                <p className="text-xs text-muted-foreground truncate">@{user.username}</p>
              )}
            </div>
          </button>
        ))
      )}
    </div>
  );
}

export function CommentSection({ targetType, targetId }: CommentSectionProps) {
  const { data: session } = useSession();
  const utils = trpc.useUtils();
  const [content, setContent] = useState("");
  const [mentionState, setMentionState] = useState<{
    active: boolean;
    query: string;
    startPos: number;
  }>({ active: false, query: "", startPos: 0 });
  const editorRef = useRef<HTMLDivElement>(null);

  const { data: comments, isLoading } = trpc.comments.listByTarget.useQuery({ targetType, targetId });

  const createComment = trpc.comments.create.useMutation({
    onSuccess: () => {
      setContent("");
      utils.comments.listByTarget.invalidate({ targetType, targetId });
    }
  });

  const deleteComment = trpc.comments.delete.useMutation({
    onSuccess: () => {
      utils.comments.listByTarget.invalidate({ targetType, targetId });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    createComment.mutate({ targetType, targetId, content });
  };

  // Detect "@" typing in the content
  const handleContentChange = useCallback((val?: string) => {
    const newVal = val || "";
    setContent(newVal);

    // Check if the user just typed "@"
    const lastAtIdx = newVal.lastIndexOf("@");
    if (lastAtIdx >= 0) {
      const afterAt = newVal.slice(lastAtIdx + 1);
      // Only trigger if there's no space after @, and it's at the end or followed by word chars
      const match = afterAt.match(/^(\w{0,20})$/);
      if (match) {
        setMentionState({ active: true, query: match[1], startPos: lastAtIdx });
        return;
      }
    }
    setMentionState({ active: false, query: "", startPos: 0 });
  }, []);

  const handleMentionSelect = useCallback(
    (user: { id: string; name: string; username: string | null }) => {
      const tag = user.username ? `@${user.username}` : `@${user.name}`;
      const before = content.slice(0, mentionState.startPos);
      const after = content.slice(mentionState.startPos + mentionState.query.length + 1); // +1 for the "@"
      const newContent = `${before}**${tag}** ${after}`;
      setContent(newContent);
      setMentionState({ active: false, query: "", startPos: 0 });
    },
    [content, mentionState]
  );

  // Render @mentions in comment content as styled tags
  const renderContent = (text: string) => {
    return text.replace(
      /\*\*@(\w+(?:\s\w+)*)\*\*/g,
      '<span class="mention-tag">@$1</span>'
    );
  };

  return (
    <div className="flex flex-col h-full">
      {/* Comments List */}
      <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-2">
        {isLoading ? (
          <div className="flex justify-center p-4">
            <Loader2 className="h-6 w-6 animate-spin text-stone-400" />
          </div>
        ) : !comments || comments.length === 0 ? (
          <div className="text-center p-8 text-muted-foreground text-sm italic border border-dashed border-border rounded-lg">
            No comments yet. Start the discussion!
          </div>
        ) : (
          comments.map(comment => (
            <div key={comment.id} className="group flex space-x-3">
              <Avatar className="h-8 w-8 shrink-0">
                <AvatarFallback className="bg-coral-100 text-coral-700 dark:bg-coral-900/30 dark:text-coral-400 text-xs">
                  {comment.author?.name?.charAt(0) || "?"}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-semibold text-foreground">
                      {comment.author?.name}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
                    </span>
                  </div>
                  
                  {(session?.user?.id === comment.authorId || (session?.user as any)?.role === 'chairman' || (session?.user as any)?.role === 'admin') && (
                    <button 
                      onClick={() => {
                        if (confirm('Delete this comment?')) deleteComment.mutate({ id: comment.id });
                      }}
                      disabled={deleteComment.isPending}
                      className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                <div className="text-sm bg-muted/50 p-3 rounded-xl rounded-tl-none border border-border inline-block w-full overflow-hidden">
                  <MarkdownPreview source={comment.content} className="!bg-transparent text-foreground !font-sans text-sm" />
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Input Box */}
      <div className="pt-4 border-t border-border mt-auto shrink-0 relative" ref={editorRef}>
        {/* @Mention Popup */}
        {mentionState.active && (
          <MentionPopup
            query={mentionState.query}
            onSelect={handleMentionSelect}
            onClose={() => setMentionState({ active: false, query: "", startPos: 0 })}
            position={{ top: 8, left: 0 }}
          />
        )}

        <form onSubmit={handleSubmit}>
          <MarkdownEditor
            value={content}
            onChange={handleContentChange}
            placeholder="Type your comment here... Use @ to mention users"
            height={150}
          />
          <div className="flex justify-between items-center mt-3">
             <p className="text-[10px] text-muted-foreground tracking-wide">Markdown is supported · Type <kbd className="px-1 py-0.5 rounded bg-muted text-[9px] font-mono">@</kbd> to mention someone</p>
             <Button 
               type="submit" 
               className="h-8 bg-coral-500 hover:bg-coral-600 text-white rounded-lg transition-all"
               disabled={createComment.isPending || !content.trim()}
             >
               {createComment.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Send className="h-4 w-4 mr-1.5" />}
               Send Comment
             </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
