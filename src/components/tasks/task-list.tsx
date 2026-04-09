"use client";

import { trpc } from "@/lib/trpc/client";
import { Loader2, Target, ChevronRight, Calendar } from "lucide-react";
import Link from "next/link";
import { CreateTaskDialog } from "./create-task-dialog";
import { format } from "date-fns";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

const STATUS_CONFIG: Record<string, { label: string; dotColor: string; className: string }> = {
  planned: { label: "Planned", dotColor: "bg-stone-400", className: "text-stone-600 dark:text-stone-400" },
  in_progress: { label: "In Progress", dotColor: "bg-blue-500", className: "text-blue-600 dark:text-blue-400" },
  in_review: { label: "In Review", dotColor: "bg-amber-500", className: "text-amber-600 dark:text-amber-400" },
  changes_requested: { label: "Needs Changes", dotColor: "bg-rose-500", className: "text-rose-600 dark:text-rose-400" },
  done: { label: "Done", dotColor: "bg-emerald-500", className: "text-emerald-600 dark:text-emerald-400" },
};

const PRIORITY_CONFIG: Record<string, { label: string; className: string }> = {
  critical: { label: "Critical", className: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400" },
  high: { label: "High", className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
  medium: { label: "Medium", className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  low: { label: "Low", className: "bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-400" },
};

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function TaskList({ projectId }: { projectId: string }) {
  const { data: tasks, isLoading, error } = trpc.tasks.listByProject.useQuery({ projectId });

  if (isLoading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-coral-500" />
      </div>
    );
  }

  if (error) {
    return <div className="text-red-500 p-4">Error loading tasks.</div>;
  }

  if (!tasks || tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-stone-200 dark:border-stone-800 rounded-lg bg-white/50 dark:bg-stone-900/50">
        <Target className="h-12 w-12 text-stone-300 dark:text-stone-600 mb-4" />
        <h3 className="text-lg font-medium">No Tasks Yet</h3>
        <p className="text-sm text-stone-500 mb-4 text-center max-w-sm">
          Create tasks to track work items, bugs, and features for this project.
        </p>
        <CreateTaskDialog projectId={projectId} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center bg-white/40 dark:bg-stone-900/40 p-4 rounded-lg border border-stone-200 dark:border-stone-800">
        <div>
          <h3 className="font-semibold text-stone-800 dark:text-stone-200">Tasks ({tasks.length})</h3>
          <p className="text-sm text-stone-500">Work items for this project.</p>
        </div>
        <CreateTaskDialog projectId={projectId} />
      </div>

      <div className="rounded-xl border border-stone-200 dark:border-stone-800 overflow-hidden">
        {/* Table Header */}
        <div className="grid grid-cols-[1fr_130px_130px_90px_100px_70px_40px] gap-4 px-5 py-3 bg-muted/40 border-b border-stone-200 dark:border-stone-800 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <span>Task</span>
          <span>Status</span>
          <span>Assignee</span>
          <span>Priority</span>
          <span>Deadline</span>
          <span>Est.</span>
          <span />
        </div>

        {/* Table Rows */}
        {tasks.map((task) => {
          const status = STATUS_CONFIG[task.status] ?? STATUS_CONFIG.planned;
          const priority = PRIORITY_CONFIG[task.priority] ?? PRIORITY_CONFIG.medium;

          return (
            <Link
              key={task.id}
              href={`/tasks/${task.id}`}
              className="grid grid-cols-[1fr_130px_130px_90px_100px_70px_40px] gap-4 px-5 py-4 items-center border-b last:border-b-0 border-stone-100 dark:border-stone-800 hover:bg-muted/30 transition-colors group cursor-pointer"
            >
              {/* Task info */}
              <div className="min-w-0">
                <div className="font-semibold text-sm text-stone-900 dark:text-stone-100 group-hover:text-primary transition-colors truncate">
                  {task.title}
                </div>
                <div className="text-xs text-muted-foreground font-mono truncate">
                  {task.id}
                  {task.module && (
                    <span className="ml-2 text-xs text-stone-400 dark:text-stone-500 font-sans">
                      · {task.module.title}
                    </span>
                  )}
                </div>
              </div>

              {/* Status */}
              <div className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full shrink-0 ${status.dotColor}`} />
                <span className={`text-xs font-medium ${status.className}`}>{status.label}</span>
              </div>

              {/* Assignee */}
              <div className="flex items-center gap-2 min-w-0">
                {task.assignee ? (
                  <>
                    <Avatar className="h-6 w-6">
                      <AvatarFallback className="text-[10px] bg-stone-200 dark:bg-stone-700">
                        {getInitials(task.assignee.name)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-xs text-stone-600 dark:text-stone-400 truncate">
                      {task.assignee.name}
                    </span>
                  </>
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
              </div>

              {/* Priority */}
              <div>
                <Badge variant="secondary" className={`text-[10px] px-2 py-0.5 font-medium ${priority.className}`}>
                  {priority.label}
                </Badge>
              </div>

              {/* Deadline */}
              <div className="text-xs text-muted-foreground">
                {task.deadline ? (
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {format(new Date(task.deadline), "MMM d")}
                  </span>
                ) : (
                  "—"
                )}
              </div>

              {/* Estimate */}
              <div className="text-xs text-muted-foreground">
                {task.estimateDays != null ? `${task.estimateDays}d` : "—"}
              </div>

              {/* Arrow */}
              <div className="flex justify-center">
                <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
