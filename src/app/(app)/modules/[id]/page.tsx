"use client";

import { use, useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { useSession } from "@/lib/auth/client";
import { useRouter } from "next/navigation";
import {
  Loader2, ArrowLeft,
  Plus, X, Check, MoreHorizontal, Pencil, Trash2,
  AlertTriangle,
  ListChecks, FileText, MessageSquare,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DocumentManager } from "@/components/documents/document-manager";
import { CommentSection } from "@/components/comments/comment-section";

function ChecklistTab({ moduleId, initialChecklist }: { moduleId: string; initialChecklist: { text: string; done: boolean }[] }) {
  const [items, setItems] = useState(initialChecklist || []);
  const [newItem, setNewItem] = useState("");
  const utils = trpc.useUtils();

  const updateChecklist = trpc.modules.updateChecklist.useMutation({
    onSuccess: () => {
      utils.modules.getById.invalidate({ id: moduleId });
    },
  });

  const doneCount = items.filter(i => i.done).length;
  const total = items.length;
  const pct = total === 0 ? 0 : Math.round((doneCount / total) * 100);

  const persist = (next: { text: string; done: boolean }[]) => {
    setItems(next);
    updateChecklist.mutate({ id: moduleId, checklist: next });
  };

  const addItem = () => {
    if (!newItem.trim()) return;
    persist([...items, { text: newItem.trim(), done: false }]);
    setNewItem("");
  };

  const toggleItem = (index: number) => {
    const next = [...items];
    next[index] = { ...next[index], done: !next[index].done };
    persist(next);
  };

  const removeItem = (index: number) => {
    persist(items.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-4">
      {total > 0 && (
        <div className="flex items-center gap-3">
          <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 transition-all duration-300 rounded-full"
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="text-sm font-semibold text-muted-foreground w-16 text-right">{doneCount}/{total}</span>
        </div>
      )}

      <div className="flex gap-2">
        <Input
          placeholder="Add a checklist item..."
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addItem()}
          className="flex-1"
        />
        <Button size="sm" onClick={addItem} disabled={!newItem.trim()}>
          <Plus className="h-4 w-4 mr-1" /> Add
        </Button>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Check className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
          <p className="text-sm">No checklist items yet. Add one above.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border divide-y divide-border overflow-hidden">
          {items.map((item, index) => (
            <div
              key={index}
              className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors group"
            >
              <button
                onClick={() => toggleItem(index)}
                className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-all duration-200
                  ${item.done
                    ? "bg-emerald-500 border-emerald-500 text-white"
                    : "border-muted-foreground/40 hover:border-emerald-400"
                  }`}
              >
                {item.done && <Check className="h-3 w-3" />}
              </button>
              <span className={`flex-1 text-sm transition-all ${item.done ? "line-through text-muted-foreground" : "text-foreground"}`}>
                {item.text}
              </span>
              <button
                onClick={() => removeItem(index)}
                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function EditModuleDialog({
  module,
  open,
  onOpenChange,
}: {
  module: { id: string; title: string; description?: string | null };
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const utils = trpc.useUtils();
  const [title, setTitle] = useState(module.title);
  const [description, setDescription] = useState(module.description || "");

  const updateModule = trpc.modules.update.useMutation({
    onSuccess: () => {
      utils.modules.getById.invalidate({ id: module.id });
      onOpenChange(false);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Module</DialogTitle>
          <DialogDescription>Update module information</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <label className="text-sm font-medium text-foreground">Title</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1" />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground">Description</label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} className="mt-1" rows={3} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={() => updateModule.mutate({
              id: module.id,
              title,
              description,
            })}
            disabled={updateModule.isPending || !title.trim()}
            className="bg-coral-500 hover:bg-coral-600 text-white"
          >
            {updateModule.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function ModuleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { data: session } = useSession();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const { data: module, isLoading, error } = trpc.modules.getById.useQuery({ id });

  const deleteModule = trpc.modules.delete.useMutation({
    onSuccess: () => {
      router.push(`/projects/${module?.projectId}`);
    },
  });

  // Permission check: admin/chairman/creator
  const userRole = (session?.user as { role?: string })?.role || "user";
  const isAdmin = userRole === "admin" || userRole === "chairman";
  const isCreator = module?.createdBy === session?.user?.id;
  const canManage = isAdmin || isCreator;

  if (isLoading) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-coral-500" />
      </div>
    );
  }

  if (error || !module) {
    return (
      <div className="p-8 text-center text-destructive flex flex-col items-center">
        <h2 className="text-xl font-bold mb-4">Module not found</h2>
        <Link href="/projects">
          <Button variant="outline">Back to Projects</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col pt-4 min-h-[calc(100vh-4rem)]">
      {/* Header Area */}
      <div className="px-8 pb-6 border-b border-border">
        <div className="mb-4 flex items-center justify-between">
          <Link
            href={`/projects/${module.projectId}`}
            className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Project: {module.project.title}
          </Link>

          {/* Actions Menu */}
          {canManage && (
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="h-8 w-8" />}>
                <MoreHorizontal className="h-4 w-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setEditOpen(true)}>
                  <Pencil className="h-4 w-4 mr-2" />
                  Edit Module
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => setDeleteConfirmOpen(true)}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Module
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        <div>
          <div className="flex items-center space-x-3 mb-2">
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              {module.title}
            </h1>
            <span className="text-xs font-mono text-muted-foreground bg-muted px-2 py-1 rounded">
              {module.id}
            </span>
          </div>
          <p className="text-lg text-muted-foreground max-w-2xl">
            {module.description || "No description provided."}
          </p>
        </div>
      </div>

      {/* Tabs Area */}
      <div className="flex-1 px-8 py-6">
        <Tabs defaultValue="checklist" className="space-y-6">
          <TabsList className="flex w-full justify-center gap-10 bg-transparent rounded-none h-auto p-0">
            <TabsTrigger
              value="checklist"
              className="flex-initial flex items-center gap-2 px-2 py-3.5 font-medium border-0 border-b-[3px] border-transparent hover:text-foreground text-muted-foreground data-[state=active]:border-coral-500 data-[state=active]:text-coral-500 bg-transparent data-[state=active]:!bg-transparent data-[state=active]:shadow-none rounded-none transition-all mb-[-1px] m-0 !bg-transparent"
            >
              <ListChecks className="h-4 w-4" />
              Checklist
            </TabsTrigger>
            <TabsTrigger
              value="documents"
              className="flex-initial flex items-center gap-2 px-2 py-3.5 font-medium border-0 border-b-[3px] border-transparent hover:text-foreground text-muted-foreground data-[state=active]:border-coral-500 data-[state=active]:text-coral-500 bg-transparent data-[state=active]:!bg-transparent data-[state=active]:shadow-none rounded-none transition-all mb-[-1px] m-0 !bg-transparent"
            >
              <FileText className="h-4 w-4" />
              Documents
            </TabsTrigger>
            <TabsTrigger
              value="comments"
              className="flex-initial flex items-center gap-2 px-2 py-3.5 font-medium border-0 border-b-[3px] border-transparent hover:text-foreground text-muted-foreground data-[state=active]:border-coral-500 data-[state=active]:text-coral-500 bg-transparent data-[state=active]:!bg-transparent data-[state=active]:shadow-none rounded-none transition-all mb-[-1px] m-0 !bg-transparent"
            >
              <MessageSquare className="h-4 w-4" />
              Comments
            </TabsTrigger>
          </TabsList>

          <TabsContent value="checklist" className="space-y-4 pt-2">
            <ChecklistTab
              moduleId={module.id}
              initialChecklist={(module.checklist as { text: string; done: boolean }[]) || []}
            />
          </TabsContent>

          <TabsContent value="documents" className="space-y-4 pt-2">
            <DocumentManager targetType="module" targetId={module.id} />
          </TabsContent>

          <TabsContent value="comments" className="h-[600px] border border-border/60 rounded-xl pt-4 p-6 shadow-sm">
            <CommentSection targetType="module" targetId={module.id} />
          </TabsContent>
        </Tabs>
      </div>

      {/* Edit Dialog */}
      {canManage && (
        <EditModuleDialog
          module={module}
          open={editOpen}
          onOpenChange={setEditOpen}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Delete Module
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{module.title}</strong>? This action cannot be undone.
              All checklist items, comments, and documents will be removed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmOpen(false)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => deleteModule.mutate({ id: module.id })}
              disabled={deleteModule.isPending}
            >
              {deleteModule.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
