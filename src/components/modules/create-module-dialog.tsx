"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Plus } from "lucide-react";

export function CreateModuleDialog({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [deadline, setDeadline] = useState("");
  const [assigneeId, setAssigneeId] = useState<string>("unassigned");

  const utils = trpc.useUtils();
  const { data: project } = trpc.projects.getById.useQuery({ id: projectId }, { enabled: open });

  const createModule = trpc.modules.create.useMutation({
    onSuccess: () => {
      setOpen(false);
      setTitle("");
      setDescription("");
      setDeadline("");
      setAssigneeId("unassigned");
      utils.modules.listByProject.invalidate({ projectId }); // Refresh module list
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    createModule.mutate({
      projectId,
      title,
      description,
      assigneeId: assigneeId === "unassigned" ? undefined : assigneeId,
      deadline: deadline || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" className="bg-gradient-to-r from-rose-500 to-orange-500 text-white shadow-md hover:shadow-lg transition-all" />}>
        <Plus className="mr-2 h-4 w-4" /> New Module
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create Project Module</DialogTitle>
            <DialogDescription>
              A module is a major milestone or feature epic within your project.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="title" className="text-right">
                Title
              </Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Authentication System"
                className="col-span-3"
                required
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="description" className="text-right">
                Description
              </Label>
              <Input
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Briefly describe what this covers..."
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="deadline" className="text-right">
                Deadline
              </Label>
              <Input
                id="deadline"
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="assignee" className="text-right">
                Assignee
              </Label>
              <div className="col-span-3">
                <Select value={assigneeId} onValueChange={(val) => setAssigneeId(val || "unassigned")}>
                  <SelectTrigger id="assignee" className="w-full">
                    <SelectValue placeholder="Select assignee">
                      {assigneeId === "unassigned"
                        ? "Unassigned"
                        : assigneeId === project?.chairman?.id
                        ? `${project?.chairman?.name} (Chairman)`
                        : project?.members?.find((m: any) => m.user.id === assigneeId)?.user.name || "Select assignee"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                    {project?.chairman && (
                      <SelectItem value={project.chairman.id}>
                        {project.chairman.name} (Chairman)
                      </SelectItem>
                    )}
                    {project?.members?.map((m: any) => (
                      <SelectItem key={m.user.id} value={m.user.id}>
                        {m.user.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="submit"
              disabled={createModule.isPending || !title.trim()}
              className="bg-rose-600 hover:bg-rose-700 text-white"
            >
              {createModule.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                "Save Module"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
