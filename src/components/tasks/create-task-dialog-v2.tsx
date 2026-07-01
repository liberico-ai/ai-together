"use client";

import { useState, type ReactNode } from "react";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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

const WORK_TYPE_OPTIONS = [
  { value: "build", label: "Build" },
  { value: "change_request", label: "Change Request" },
  { value: "integration", label: "Integration" },
  { value: "report", label: "Report" },
  { value: "maintenance", label: "Maintenance" },
  { value: "ops", label: "Ops" },
] as const;

const IVP_OPTIONS = [
  { value: "0.5", label: "0.5" },
  { value: "1", label: "1" },
  { value: "2", label: "2" },
  { value: "3", label: "3" },
  { value: "5", label: "5" },
] as const;

const PRIORITY_OPTIONS = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
] as const;

type WorkType = (typeof WORK_TYPE_OPTIONS)[number]["value"];
type Priority = (typeof PRIORITY_OPTIONS)[number]["value"];

export function CreateTaskDialogV2({
  parentTaskId,
  defaultBuId,
  trigger,
  onCreated,
}: {
  parentTaskId?: string;
  /** BU gán sẵn khi mở dialog (ví dụ tạo việc từ 1 BU cụ thể trên BU Board). */
  defaultBuId?: string;
  /** Custom trigger node. Nếu không truyền → dùng nút mặc định. */
  trigger?: ReactNode;
  onCreated?: () => void;
} = {}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [workType, setWorkType] = useState<WorkType>("build");
  const [ivp, setIvp] = useState<string>("1");
  const [priority, setPriority] = useState<Priority>("medium");
  const [deadline, setDeadline] = useState("");
  const [buId, setBuId] = useState<string>(defaultBuId ?? "");

  const utils = trpc.useUtils();

  const { data: users } = trpc.users.searchUsers.useQuery(
    { query: "" },
    { enabled: open }
  );
  const { data: businessUnits } = trpc.businessUnits.list.useQuery(undefined, {
    enabled: open,
  });

  const createTask = trpc.tasks.create.useMutation({
    onSuccess: () => {
      setOpen(false);
      resetForm();
      utils.tasks.myTasks.invalidate();
      utils.businessUnits.status.invalidate();
      utils.businessUnits.blockers.invalidate();
      onCreated?.();
    },
  });

  function resetForm() {
    setTitle("");
    setDescription("");
    setAssigneeIds([]);
    setWorkType("build");
    setIvp("1");
    setPriority("medium");
    setDeadline("");
    setBuId(defaultBuId ?? "");
  }

  function toggleAssignee(id: string) {
    setAssigneeIds((prev) =>
      prev.includes(id) ? prev.filter((u) => u !== id) : [...prev, id]
    );
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    createTask.mutate({
      title: title.trim(),
      description: description.trim() || undefined,
      assigneeIds: assigneeIds.length ? assigneeIds : undefined,
      workType,
      ivp: parseFloat(ivp),
      priority,
      deadline: deadline ? new Date(deadline).toISOString() : undefined,
      buId: buId || undefined,
      parentTaskId,
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger ? (
        <DialogTrigger render={trigger as React.ReactElement} />
      ) : (
        <DialogTrigger
          render={
            <Button
              size="sm"
              className="bg-gradient-to-r from-pink-500 to-rose-600 text-white shadow-md transition-all hover:shadow-lg"
            />
          }
        >
          <Plus className="mr-2 h-4 w-4" />{" "}
          {parentTaskId ? "New Subtask" : "New Task"}
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-[560px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {parentTaskId ? "Create Subtask" : "Create Task"}
            </DialogTitle>
            <DialogDescription>
              Giao việc cho nhiều người, chọn loại việc, IVP và BU.
            </DialogDescription>
          </DialogHeader>

          <div className="grid max-h-[65vh] gap-4 overflow-y-auto py-4 pr-1">
            {/* Title */}
            <div className="grid gap-1.5">
              <Label htmlFor="v2-title">Title *</Label>
              <Input
                id="v2-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Tích hợp cổng thanh toán"
                required
              />
            </div>

            {/* Description */}
            <div className="grid gap-1.5">
              <Label htmlFor="v2-desc">Description</Label>
              <Textarea
                id="v2-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional details..."
                rows={2}
              />
            </div>

            {/* Assignees (multi-select checkboxes) */}
            <div className="grid gap-1.5">
              <Label>
                Assignees{" "}
                {assigneeIds.length > 0 && (
                  <span className="text-pink-600 dark:text-pink-400">
                    ({assigneeIds.length})
                  </span>
                )}
              </Label>
              <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border border-border p-2">
                {users && users.length > 0 ? (
                  users.map((u) => (
                    <label
                      key={u.id}
                      className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted"
                    >
                      <input
                        type="checkbox"
                        checked={assigneeIds.includes(u.id)}
                        onChange={() => toggleAssignee(u.id)}
                        className="h-4 w-4 accent-pink-500"
                      />
                      <span className="truncate">
                        {u.name ?? u.username ?? u.id}
                      </span>
                    </label>
                  ))
                ) : (
                  <p className="px-2 py-1 text-xs text-muted-foreground">
                    Loading users...
                  </p>
                )}
              </div>
            </div>

            {/* Work Type + IVP */}
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-1.5">
                <Label>Work Type</Label>
                <Select
                  value={workType}
                  onValueChange={(val: string | null) =>
                    setWorkType((val as WorkType) || "build")
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Work type" />
                  </SelectTrigger>
                  <SelectContent>
                    {WORK_TYPE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-1.5">
                <Label>IVP (điểm giá trị)</Label>
                <Select
                  value={ivp}
                  onValueChange={(val: string | null) => setIvp(val || "1")}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="IVP" />
                  </SelectTrigger>
                  <SelectContent>
                    {IVP_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Priority + BU */}
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-1.5">
                <Label>Priority</Label>
                <Select
                  value={priority}
                  onValueChange={(val: string | null) =>
                    setPriority((val as Priority) || "medium")
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Priority" />
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

              <div className="grid gap-1.5">
                <Label>Business Unit</Label>
                <Select
                  value={buId}
                  onValueChange={(val: string | null) => setBuId(val || "")}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Optional BU">
                      {businessUnits?.find((bu) => bu.id === buId)?.code}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {businessUnits?.map((bu) => (
                      <SelectItem key={bu.id} value={bu.id}>
                        {bu.code} — {bu.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Deadline */}
            <div className="grid gap-1.5">
              <Label htmlFor="v2-deadline">Deadline</Label>
              <Input
                id="v2-deadline"
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="submit"
              disabled={createTask.isPending || !title.trim()}
              className="bg-pink-600 text-white hover:bg-pink-700"
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
