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

const PRIORITY_OPTIONS = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
] as const;

export function CreateTaskDialog({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assigneeId, setAssigneeId] = useState<string>("");
  const [priority, setPriority] = useState<"low" | "medium" | "high" | "critical">("medium");
  const [deadline, setDeadline] = useState("");
  const [estimateDays, setEstimateDays] = useState<string>("");
  const [moduleId, setModuleId] = useState<string>("");

  const utils = trpc.useUtils();

  const { data: project } = trpc.projects.getById.useQuery(
    { id: projectId },
    { enabled: open }
  );

  const { data: modules } = trpc.modules.listByProject.useQuery(
    { projectId },
    { enabled: open }
  );

  const createTask = trpc.tasks.create.useMutation({
    onSuccess: () => {
      setOpen(false);
      resetForm();
      utils.tasks.listByProject.invalidate({ projectId });
    },
  });

  function resetForm() {
    setTitle("");
    setDescription("");
    setAssigneeId("");
    setPriority("medium");
    setDeadline("");
    setEstimateDays("");
    setModuleId("");
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    createTask.mutate({
      projectId,
      title: title.trim(),
      description: description.trim() || undefined,
      assigneeIds: assigneeId ? [assigneeId] : undefined,
      priority,
      deadline: deadline ? new Date(deadline).toISOString() : undefined,
      estimateDays: estimateDays ? parseInt(estimateDays, 10) : undefined,
      moduleId: moduleId || undefined,
    });
  };

  const members = project?.members ?? [];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" className="bg-gradient-to-r from-rose-500 to-orange-500 text-white shadow-md hover:shadow-lg transition-all" />}>
        <Plus className="mr-2 h-4 w-4" /> New Task
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create Task</DialogTitle>
            <DialogDescription>
              Add a new work item to track in this project.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {/* Title */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="task-title" className="text-right">
                Title
              </Label>
              <Input
                id="task-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Implement login flow"
                className="col-span-3"
                required
              />
            </div>

            {/* Description */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="task-description" className="text-right">
                Description
              </Label>
              <Input
                id="task-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional details..."
                className="col-span-3"
              />
            </div>

            {/* Assignee */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Assignee</Label>
              <Select value={assigneeId} onValueChange={(val: string | null) => setAssigneeId(val || "")}>
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select assignee" />
                </SelectTrigger>
                <SelectContent>
                  {members.map((member: { userId: string; user: { id: string; name: string | null } }) => (
                    <SelectItem key={member.userId} value={member.userId}>
                      {member.user.name ?? member.userId}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Priority */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Priority</Label>
              <Select value={priority} onValueChange={(val: string | null) => setPriority((val || "medium") as typeof priority)}>
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select priority" />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITY_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Deadline */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="task-deadline" className="text-right">
                Deadline
              </Label>
              <Input
                id="task-deadline"
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="col-span-3"
              />
            </div>

            {/* Estimate Days */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="task-estimate" className="text-right">
                Estimate
              </Label>
              <Input
                id="task-estimate"
                type="number"
                min={1}
                value={estimateDays}
                onChange={(e) => setEstimateDays(e.target.value)}
                placeholder="Days"
                className="col-span-3"
              />
            </div>

            {/* Module */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Module</Label>
              <Select value={moduleId} onValueChange={(val: string | null) => setModuleId(val || "")}>
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Optional module" />
                </SelectTrigger>
                <SelectContent>
                  {modules?.map((mod) => (
                    <SelectItem key={mod.id} value={mod.id}>
                      {mod.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="submit"
              disabled={createTask.isPending || !title.trim()}
              className="bg-rose-600 hover:bg-rose-700 text-white"
            >
              {createTask.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Task"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
