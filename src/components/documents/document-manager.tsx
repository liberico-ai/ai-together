"use client";

import { useState, useRef } from "react";
import { trpc } from "@/lib/trpc/client";
import { useSession } from "@/lib/auth/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { FileText, Link as LinkIcon, UploadCloud, Loader2, Trash2, ArrowUpRight } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { formatBytes } from "@/lib/utils";

interface DocumentManagerProps {
  targetType: "project" | "module" | "task";
  targetId: string;
}

export function DocumentManager({ targetType, targetId }: DocumentManagerProps) {
  const { data: session } = useSession();
  const utils = trpc.useUtils();
  const [isUploading, setIsUploading] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkTitle, setLinkTitle] = useState("");
  const [isLinking, setIsLinking] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: documents, isLoading } = trpc.documents.listByTarget.useQuery({ targetType, targetId });

  const getPresignedUrl = trpc.documents.getPresignedUrl.useMutation();
  const confirmUpload = trpc.documents.confirmUpload.useMutation();
  const attachLink = trpc.documents.attachLink.useMutation();
  const deleteDoc = trpc.documents.delete.useMutation({
    onSuccess: () => utils.documents.listByTarget.invalidate({ targetType, targetId }),
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      // 1. Get presigned URL
      const { presignedUrl, s3Key } = await getPresignedUrl.mutateAsync({
        filename: file.name,
        contentType: file.type || "application/octet-stream",
        targetType,
        targetId,
      });

      // 2. Upload directly to S3/MinIO
      const res = await fetch(presignedUrl, {
        method: "PUT",
        body: file,
        headers: {
          "Content-Type": file.type || "application/octet-stream",
        },
      });

      if (!res.ok) throw new Error("Upload to S3 failed");

      // 3. Confirm upload
      await confirmUpload.mutateAsync({
        title: file.name,
        s3Key,
        fileSize: file.size,
        targetType,
        targetId,
      });

      utils.documents.listByTarget.invalidate({ targetType, targetId });
    } catch (err) {
      console.error("Upload error:", err);
      alert("Failed to upload file.");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleAttachLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkUrl || !linkTitle) return;

    setIsLinking(true);
    try {
      await attachLink.mutateAsync({
        title: linkTitle,
        url: linkUrl,
        targetType,
        targetId,
      });
      setLinkUrl("");
      setLinkTitle("");
      utils.documents.listByTarget.invalidate({ targetType, targetId });
    } catch (err) {
      console.error(err);
      alert("Failed to attach link");
    } finally {
      setIsLinking(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Upload File Card */}
        <Card className="border-dashed border-2 bg-stone-50/50 dark:bg-stone-900/50">
          <CardContent className="flex flex-col items-center justify-center h-40 pt-6">
            <input 
              type="file" 
              className="hidden" 
              ref={fileInputRef} 
              onChange={handleFileUpload}
            />
            <div className="w-12 h-12 rounded-full bg-coral-100 dark:bg-coral-900/30 flex items-center justify-center mb-3 text-coral-600 dark:text-coral-400">
              {isUploading ? <Loader2 className="h-6 w-6 animate-spin" /> : <UploadCloud className="h-6 w-6" />}
            </div>
            <p className="text-sm font-medium mb-1">Upload a Document</p>
            <p className="text-xs text-stone-500 mb-4 text-center max-w-[200px]">
              Drag & drop or click to browse files. Max 50MB.
            </p>
            <Button 
              size="sm" 
              variant="outline" 
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
            >
              Select File
            </Button>
          </CardContent>
        </Card>

        {/* Attach Link Card */}
        <Card className="border-stone-200 dark:border-stone-800 bg-white/50 dark:bg-stone-950/50">
          <CardContent className="h-40 pt-6 flex flex-col justify-center">
            <div className="flex items-center space-x-2 mb-4 text-sm font-medium">
              <LinkIcon className="h-4 w-4 text-blue-500" />
              <span>Attach External Link</span>
            </div>
            <form onSubmit={handleAttachLink} className="space-y-3">
              <Input 
                placeholder="Google Drive, Figma, Notion URL..." 
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                className="h-8 text-xs"
                required
                type="url"
              />
              <div className="flex space-x-2">
                <Input 
                  placeholder="Link Title" 
                  value={linkTitle}
                  onChange={(e) => setLinkTitle(e.target.value)}
                  className="h-8 text-xs flex-1"
                  required
                />
                <Button size="sm" type="submit" disabled={isLinking} className="h-8 group">
                   {isLinking ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUpRight className="h-4 w-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* Document List */}
      <div>
        <h4 className="text-sm font-semibold uppercase tracking-wider text-stone-500 mb-4">Attached Files & Links</h4>
        
        {isLoading ? (
          <div className="flex justify-center p-4">
            <Loader2 className="h-6 w-6 animate-spin text-stone-400" />
          </div>
        ) : !documents || documents.length === 0 ? (
          <div className="text-center p-8 text-stone-400 text-sm border rounded-lg border-stone-200 dark:border-stone-800 bg-white/20 dark:bg-stone-900/20">
            No documents attached yet.
          </div>
        ) : (
          <div className="space-y-2">
            {documents.map(doc => (
              <div key={doc.id} className="group flex items-center justify-between p-3 rounded-lg border border-stone-100 dark:border-stone-800 bg-white dark:bg-stone-900 hover:border-coral-200 dark:hover:border-coral-900/50 hover:shadow-sm transition-all">
                <div className="flex items-center space-x-3 overflow-hidden">
                  <div className={`p-2 rounded-md ${doc.type === 'link' ? 'bg-blue-50 text-blue-500 dark:bg-blue-900/30' : 'bg-coral-50 text-coral-500 dark:bg-coral-900/30'}`}>
                    {doc.type === 'link' ? <LinkIcon className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                  </div>
                  <div className="truncate">
                    <a href={doc.url} target="_blank" rel="noreferrer" className="text-sm font-medium hover:underline hover:text-coral-500 transition-colors truncate block">
                      {doc.title}
                    </a>
                    <div className="flex items-center space-x-2 text-xs text-stone-500">
                      <span>{doc.uploader?.name}</span>
                      <span>•</span>
                      <span>{formatDistanceToNow(new Date(doc.createdAt), { addSuffix: true })}</span>
                      {doc.fileSize && (
                        <>
                          <span>•</span>
                          <span>{formatBytes(doc.fileSize)}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                
                {/* Delete button: only show if user is uploader or chairman/admin. We assume true for simplicity in UI, backend guards it */}
                {(session?.user?.id === doc.uploadedBy || (session?.user as any)?.role === 'chairman' || (session?.user as any)?.role === 'admin') && (
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="opacity-0 group-hover:opacity-100 text-stone-400 hover:text-rose-500 focus:opacity-100 transition-all"
                    onClick={() => {
                        if (confirm(`Remove ${doc.title}?`)) deleteDoc.mutate({ id: doc.id })
                    }}
                    disabled={deleteDoc.isPending && deleteDoc.variables?.id === doc.id}
                  >
                    {deleteDoc.isPending && deleteDoc.variables?.id === doc.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
