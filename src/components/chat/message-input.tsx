"use client";

import { useState, useRef, useCallback } from "react";
import { trpc } from "@/lib/trpc/client";
import { Send, Paperclip, X, Loader2 } from "lucide-react";

interface Props {
  conversationId: string;
}

export function MessageInput({ conversationId }: Props) {
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [isUploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const utils = trpc.useUtils();
  const sendMessage = trpc.chat.sendMessage.useMutation({
    onSuccess: () => {
      utils.chat.getMessages.invalidate({ conversationId });
      utils.chat.listConversations.invalidate();
    },
  });
  const typing = trpc.chat.typing.useMutation();
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced typing indicator
  const emitTyping = useCallback(() => {
    if (typingTimeoutRef.current) return;
    typing.mutate({ conversationId });
    typingTimeoutRef.current = setTimeout(() => {
      typingTimeoutRef.current = null;
    }, 2000);
  }, [conversationId, typing]);

  const handleSend = async () => {
    if (!text.trim() && !file) return;

    if (file) {
      setUploading(true);
      try {
        // Get presigned URL
        const { presignedUrl, s3Key } =
          await utils.client.chat.getMediaUploadUrl.query({
            conversationId,
            filename: file.name,
            contentType: file.type,
          });

        // Upload to S3
        await fetch(presignedUrl, {
          method: "PUT",
          body: file,
          headers: { "Content-Type": file.type },
        });

        // Images: public URL (cache-friendly), Files: s3:// key (presigned on demand)
        const isImage = file.type.startsWith("image/");
        const mediaUrl = isImage
          ? `${process.env.NEXT_PUBLIC_MINIO_PUBLIC_URL}/${process.env.NEXT_PUBLIC_MINIO_BUCKET}/${s3Key}`
          : `s3://${s3Key}`;

        // Send message with media
        await sendMessage.mutateAsync({
          conversationId,
          content: text.trim() || undefined,
          messageType: isImage ? "image" : "file",
          mediaUrl,
          mediaType: file.type,
          fileName: file.name,
          fileSize: file.size,
        });
      } catch (err) {
        console.error("Upload failed:", err);
      } finally {
        setUploading(false);
        setFile(null);
        setFilePreview(null);
      }
    } else {
      await sendMessage.mutateAsync({
        conversationId,
        content: text.trim(),
      });
    }
    setText("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    if (selected.size > 20 * 1024 * 1024) {
      alert("File quá lớn (tối đa 20MB)");
      return;
    }
    setFile(selected);
    if (selected.type.startsWith("image/")) {
      setFilePreview(URL.createObjectURL(selected));
    } else {
      setFilePreview(null);
    }
  };

  const removeFile = () => {
    if (filePreview) URL.revokeObjectURL(filePreview);
    setFile(null);
    setFilePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const isPending = sendMessage.isPending || isUploading;

  return (
    <div className="border-t border-stone-100 dark:border-stone-800/50 bg-white dark:bg-stone-900">
      {/* File Preview */}
      {file && (
        <div className="px-3 pt-2 flex items-center gap-2">
          {filePreview ? (
            <img
              src={filePreview}
              alt="preview"
              className="h-16 w-16 rounded-lg object-cover border border-stone-200 dark:border-stone-700"
            />
          ) : (
            <div className="h-10 px-3 rounded-lg bg-stone-100 dark:bg-stone-800 flex items-center gap-2 text-sm text-stone-600 dark:text-stone-300">
              <Paperclip className="h-4 w-4" />
              {file.name}
            </div>
          )}
          <button
            onClick={removeFile}
            className="h-6 w-6 rounded-full bg-stone-200 dark:bg-stone-700 flex items-center justify-center hover:bg-rose-100 dark:hover:bg-rose-900/30 text-stone-500 hover:text-rose-500"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Input Bar */}
      <div className="flex items-end gap-2 px-3 py-2.5">
        {/* File Attach */}
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isPending}
          className="h-9 w-9 shrink-0 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 flex items-center justify-center text-stone-400 hover:text-indigo-500 transition-colors disabled:opacity-50"
        >
          <Paperclip className="h-5 w-5" />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={handleFileSelect}
          accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.zip,.rar,.txt,.csv"
        />

        {/* Text Input */}
        <textarea
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            emitTyping();
          }}
          onKeyDown={handleKeyDown}
          placeholder="Nhập tin nhắn..."
          rows={1}
          className="flex-1 resize-none h-9 max-h-24 px-3 py-2 rounded-lg border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 dark:text-stone-200 placeholder:text-stone-400"
          disabled={isPending}
        />

        {/* Send Button */}
        <button
          onClick={handleSend}
          disabled={isPending || (!text.trim() && !file)}
          className="h-9 w-9 shrink-0 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white flex items-center justify-center transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </button>
      </div>
    </div>
  );
}
