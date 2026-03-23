"use client";

import { FileText, Download, Loader2 } from "lucide-react";
import { useState, useCallback } from "react";
import { trpc } from "@/lib/trpc/client";

interface Props {
  url: string;
  type: string | null;
  fileName: string | null;
  fileSize: number | null;
  conversationId: string;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function MediaPreview({ url, type, fileName, fileSize, conversationId }: Props) {
  const [lightbox, setLightbox] = useState(false);

  // Image — always uses public URL (cache-friendly)
  if (type?.startsWith("image/")) {
    return (
      <>
        <img
          src={url}
          alt={fileName ?? "image"}
          className="mt-1 max-w-[240px] max-h-[200px] rounded-lg object-cover cursor-pointer hover:opacity-90 transition-opacity border border-stone-200 dark:border-stone-700"
          onClick={() => setLightbox(true)}
        />
        {/* Lightbox */}
        {lightbox && (
          <div
            className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-8"
            onClick={() => setLightbox(false)}
          >
            <img
              src={url}
              alt={fileName ?? "image"}
              className="max-w-full max-h-full rounded-lg object-contain"
            />
          </div>
        )}
      </>
    );
  }

  // File download card — uses presigned URL for s3:// files
  const isS3 = url.startsWith("s3://");

  return isS3 ? (
    <SecureFileCard
      s3Key={url.replace("s3://", "")}
      conversationId={conversationId}
      fileName={fileName}
      fileSize={fileSize}
    />
  ) : (
    <FileCard url={url} fileName={fileName} fileSize={fileSize} />
  );
}

/** Direct link file card (legacy/public URLs) */
function FileCard({ url, fileName, fileSize }: { url: string; fileName: string | null; fileSize: number | null }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-1 flex items-center gap-3 px-3 py-2.5 rounded-lg bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors max-w-[280px]"
    >
      <div className="h-9 w-9 rounded-lg bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center shrink-0">
        <FileText className="h-5 w-5 text-indigo-500" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-stone-700 dark:text-stone-300 truncate">
          {fileName ?? "File"}
        </p>
        {fileSize && (
          <p className="text-[11px] text-stone-400">{formatFileSize(fileSize)}</p>
        )}
      </div>
      <Download className="h-4 w-4 text-stone-400 shrink-0" />
    </a>
  );
}

/** Presigned URL file card — fetches temporary download link on click */
function SecureFileCard({
  s3Key,
  conversationId,
  fileName,
  fileSize,
}: {
  s3Key: string;
  conversationId: string;
  fileName: string | null;
  fileSize: number | null;
}) {
  const [loading, setLoading] = useState(false);
  const utils = trpc.useUtils();

  const handleDownload = useCallback(async () => {
    setLoading(true);
    try {
      const { presignedUrl } = await utils.client.chat.getMediaDownloadUrl.query({
        s3Key,
        conversationId,
      });
      window.open(presignedUrl, "_blank");
    } catch (err) {
      console.error("Download failed:", err);
    } finally {
      setLoading(false);
    }
  }, [s3Key, conversationId, utils]);

  return (
    <button
      onClick={handleDownload}
      disabled={loading}
      className="mt-1 flex items-center gap-3 px-3 py-2.5 rounded-lg bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors max-w-[280px] text-left"
    >
      <div className="h-9 w-9 rounded-lg bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center shrink-0">
        <FileText className="h-5 w-5 text-indigo-500" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-stone-700 dark:text-stone-300 truncate">
          {fileName ?? "File"}
        </p>
        {fileSize && (
          <p className="text-[11px] text-stone-400">{formatFileSize(fileSize)}</p>
        )}
      </div>
      {loading ? (
        <Loader2 className="h-4 w-4 text-stone-400 animate-spin shrink-0" />
      ) : (
        <Download className="h-4 w-4 text-stone-400 shrink-0" />
      )}
    </button>
  );
}
