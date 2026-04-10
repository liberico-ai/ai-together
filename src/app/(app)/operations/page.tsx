"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { format, isPast } from "date-fns";
import {
  LifeBuoy,
  Plus,
  Filter,
  Calendar,
  ChevronRight,
  Loader2,
  ExternalLink,
} from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const STATUS_CONFIG: Record<
  string,
  { label: string; dotColor: string; className: string }
> = {
  planned: {
    label: "Planned",
    dotColor: "bg-stone-400",
    className: "text-stone-600 dark:text-stone-400",
  },
  in_progress: {
    label: "In Progress",
    dotColor: "bg-blue-500",
    className: "text-blue-600 dark:text-blue-400",
  },
  in_review: {
    label: "In Review",
    dotColor: "bg-amber-500",
    className: "text-amber-600 dark:text-amber-400",
  },
  changes_requested: {
    label: "Needs Changes",
    dotColor: "bg-rose-500",
    className: "text-rose-600 dark:text-rose-400",
  },
  done: {
    label: "Done",
    dotColor: "bg-emerald-500",
    className: "text-emerald-600 dark:text-emerald-400",
  },
};

const PRIORITY_CONFIG: Record<string, { label: string; className: string }> = {
  critical: {
    label: "Critical",
    className:
      "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400",
  },
  high: {
    label: "High",
    className:
      "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  },
  medium: {
    label: "Medium",
    className:
      "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  },
  low: {
    label: "Low",
    className:
      "bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-400",
  },
};

const PRIORITY_OPTIONS = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
] as const;

function CreateOperationsTaskDialog() {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [domain, setDomain] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [priority, setPriority] =
    useState<"low" | "medium" | "high" | "critical">("medium");
  const [deadline, setDeadline] = useState("");
  const [estimateDays, setEstimateDays] = useState("");
  const [jiraIssueKey, setJiraIssueKey] = useState("");

  const utils = trpc.useUtils();

  const { data: allUsers } = trpc.users.searchUsers.useQuery(
    { query: "" },
    { enabled: open }
  );

  const createTask = trpc.tasks.createOperations.useMutation({
    onSuccess: () => {
      setOpen(false);
      resetForm();
      utils.tasks.listOperations.invalidate();
    },
  });

  function resetForm() {
    setTitle("");
    setDescription("");
    setDomain("");
    setAssigneeId("");
    setPriority("medium");
    setDeadline("");
    setEstimateDays("");
    setJiraIssueKey("");
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !domain.trim()) return;

    createTask.mutate({
      title: title.trim(),
      description: description.trim() || undefined,
      domain: domain.trim(),
      assigneeId: assigneeId || undefined,
      priority,
      deadline: deadline ? new Date(deadline).toISOString() : undefined,
      estimateDays: estimateDays ? parseInt(estimateDays, 10) : undefined,
      jiraIssueKey: jiraIssueKey.trim() || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            size="sm"
            className="bg-gradient-to-r from-rose-500 to-orange-500 text-white shadow-md hover:shadow-lg transition-all"
          />
        }
      >
        <Plus className="mr-2 h-4 w-4" /> New Task
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create Operations Task</DialogTitle>
            <DialogDescription>
              Add a new operations/maintenance task.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {/* Title */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="ops-title" className="text-right">
                Title *
              </Label>
              <Input
                id="ops-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Fix SSL certificate renewal"
                className="col-span-3"
                required
              />
            </div>

            {/* Domain */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="ops-domain" className="text-right">
                Domain *
              </Label>
              <Input
                id="ops-domain"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                placeholder="e.g. BTNET, LBROS, Xeca, Infra"
                className="col-span-3"
                required
              />
            </div>

            {/* Description */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="ops-desc" className="text-right">
                Description
              </Label>
              <Input
                id="ops-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional details..."
                className="col-span-3"
              />
            </div>

            {/* Jira Issue Key */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="ops-jira" className="text-right">
                Jira Key
              </Label>
              <Input
                id="ops-jira"
                value={jiraIssueKey}
                onChange={(e) => setJiraIssueKey(e.target.value)}
                placeholder="e.g. LBR-123"
                className="col-span-3"
              />
            </div>

            {/* Assignee */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Assignee</Label>
              <Select
                value={assigneeId}
                onValueChange={(val: string | null) => setAssigneeId(val || "")}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select assignee" />
                </SelectTrigger>
                <SelectContent>
                  {allUsers?.map(
                    (u: {
                      id: string;
                      name: string | null;
                      username: string | null;
                    }) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.name ?? u.username ?? u.id}
                      </SelectItem>
                    )
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Priority */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Priority</Label>
              <Select
                value={priority}
                onValueChange={(val: string | null) =>
                  setPriority(
                    (val as "low" | "medium" | "high" | "critical") || "medium"
                  )
                }
              >
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
              <Label htmlFor="ops-deadline" className="text-right">
                Deadline
              </Label>
              <Input
                id="ops-deadline"
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="col-span-3"
              />
            </div>

            {/* Estimate */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="ops-estimate" className="text-right">
                Estimate
              </Label>
              <Input
                id="ops-estimate"
                type="number"
                min={1}
                value={estimateDays}
                onChange={(e) => setEstimateDays(e.target.value)}
                placeholder="Days"
                className="col-span-3"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="submit"
              disabled={
                createTask.isPending || !title.trim() || !domain.trim()
              }
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

export default function OperationsPage() {
  const [statusFilter, setStatusFilter] = useState("all");
  const [domainFilter, setDomainFilter] = useState("all");

  const { data: tasks, isLoading } = trpc.tasks.listOperations.useQuery();

  // Extract unique domains for filter
  const domains = [
    ...new Set(
      (tasks ?? []).map((t) => t.domain).filter((d): d is string => !!d)
    ),
  ].sort();

  const filtered =
    tasks?.filter((t) => {
      const statusMatch = statusFilter === "all" || t.status === statusFilter;
      const domainMatch =
        domainFilter === "all" || t.domain === domainFilter;
      return statusMatch && domainMatch;
    }) ?? [];

  const counts = {
    total: tasks?.length ?? 0,
    open:
      tasks?.filter(
        (t) => t.status === "planned" || t.status === "in_progress"
      ).length ?? 0,
    done: tasks?.filter((t) => t.status === "done").length ?? 0,
    overdue:
      tasks?.filter(
        (t) =>
          t.deadline &&
          isPast(new Date(t.deadline)) &&
          t.status !== "done"
      ).length ?? 0,
  };

  const jiraBaseUrl =
    process.env.NEXT_PUBLIC_JIRA_BASE_URL || "https://jira.ipcoms.vn";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2 text-foreground">
            <LifeBuoy className="h-6 w-6 text-coral-500" />
            Van hanh (Operations)
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Operations & maintenance tasks across all domains.
          </p>
        </div>
        <CreateOperationsTaskDialog />
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total", value: counts.total, color: "text-foreground" },
          {
            label: "Open",
            value: counts.open,
            color: "text-blue-600 dark:text-blue-400",
          },
          {
            label: "Done",
            value: counts.done,
            color: "text-emerald-600 dark:text-emerald-400",
          },
          {
            label: "Overdue",
            value: counts.overdue,
            color: "text-rose-600 dark:text-rose-400",
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="bg-card border border-border rounded-xl px-4 py-3 text-center shadow-sm"
          >
            <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {stat.label}
            </p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <Filter className="h-4 w-4 text-muted-foreground" />

        <Select
          value={domainFilter}
          onValueChange={(val: string | null) => setDomainFilter(val ?? "all")}
        >
          <SelectTrigger className="w-[160px] h-9">
            <SelectValue placeholder="All Domains" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Domains</SelectItem>
            {domains.map((d) => (
              <SelectItem key={d} value={d}>
                {d}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={statusFilter}
          onValueChange={(val: string | null) => setStatusFilter(val ?? "all")}
        >
          <SelectTrigger className="w-[160px] h-9">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="planned">Planned</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="in_review">In Review</SelectItem>
            <SelectItem value="done">Done</SelectItem>
            <SelectItem value="changes_requested">Needs Changes</SelectItem>
          </SelectContent>
        </Select>

        {(statusFilter !== "all" || domainFilter !== "all") && (
          <Button
            variant="ghost"
            size="sm"
            className="h-9 text-muted-foreground"
            onClick={() => {
              setStatusFilter("all");
              setDomainFilter("all");
            }}
          >
            Clear filters
          </Button>
        )}
      </div>

      {/* Task List */}
      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
        {isLoading ? (
          <div className="divide-y divide-border">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-4">
                <div className="flex-1 space-y-2.5">
                  <Skeleton className="h-4 w-1/3" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <div className="flex gap-3">
                  <Skeleton className="h-5 w-16 rounded-full" />
                  <Skeleton className="h-5 w-20 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            title={
              tasks?.length === 0
                ? "No operations tasks"
                : "No results found"
            }
            description={
              tasks?.length === 0
                ? "Create your first operations task to start tracking."
                : "Try adjusting your filters."
            }
            icon={LifeBuoy}
          />
        ) : (
          <div className="divide-y divide-border">
            {/* Header */}
            <div className="grid grid-cols-[1fr_100px_130px_90px_100px_70px_32px] gap-4 px-5 py-2.5 bg-muted/30 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <span>Task</span>
              <span>Domain</span>
              <span>Status</span>
              <span>Priority</span>
              <span>Deadline</span>
              <span>Est.</span>
              <span />
            </div>

            {/* Rows */}
            {filtered.map((task) => {
              const statusCfg =
                STATUS_CONFIG[task.status] ?? STATUS_CONFIG.planned;
              const priorityCfg =
                PRIORITY_CONFIG[task.priority] ?? PRIORITY_CONFIG.medium;
              const isOverdue =
                task.deadline &&
                isPast(new Date(task.deadline)) &&
                task.status !== "done";

              return (
                <Link
                  key={task.id}
                  href={`/tasks/${task.id}`}
                  className="grid grid-cols-[1fr_100px_130px_90px_100px_70px_32px] gap-4 items-center px-5 py-4 hover:bg-muted/30 transition-colors cursor-pointer group"
                >
                  {/* Task info */}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-semibold text-sm text-foreground truncate group-hover:text-primary transition-colors">
                        {task.title}
                      </span>
                      {task.jiraIssueKey && (
                        <a
                          href={`${jiraBaseUrl}/browse/${task.jiraIssueKey}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="shrink-0"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Badge
                            variant="outline"
                            className="text-[10px] px-1.5 py-0 font-mono hover:bg-muted cursor-pointer gap-1"
                          >
                            {task.jiraIssueKey}
                            <ExternalLink className="h-2.5 w-2.5" />
                          </Badge>
                        </a>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground font-mono mt-0.5">
                      {task.id}
                    </div>
                  </div>

                  {/* Domain */}
                  <div>
                    {task.domain && (
                      <Badge
                        variant="secondary"
                        className="text-[10px] px-2 py-0.5 font-medium"
                      >
                        {task.domain}
                      </Badge>
                    )}
                  </div>

                  {/* Status */}
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`w-2 h-2 rounded-full shrink-0 ${statusCfg.dotColor}`}
                    />
                    <span
                      className={`text-xs font-medium ${statusCfg.className}`}
                    >
                      {statusCfg.label}
                    </span>
                  </div>

                  {/* Priority */}
                  <Badge
                    variant="secondary"
                    className={`text-[10px] px-2 py-0.5 font-medium w-fit ${priorityCfg.className}`}
                  >
                    {priorityCfg.label}
                  </Badge>

                  {/* Deadline */}
                  {task.deadline ? (
                    <span
                      className={`text-xs font-medium flex items-center gap-1 ${
                        isOverdue
                          ? "text-rose-600 dark:text-rose-400"
                          : "text-muted-foreground"
                      }`}
                    >
                      <Calendar className="h-3 w-3" />
                      {format(new Date(task.deadline), "MMM d")}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      &mdash;
                    </span>
                  )}

                  {/* Estimate */}
                  <span className="text-xs text-muted-foreground">
                    {task.estimateDays != null
                      ? `${task.estimateDays}d`
                      : "\u2014"}
                  </span>

                  {/* Arrow */}
                  <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
