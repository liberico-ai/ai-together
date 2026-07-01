"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { ClipboardList, Filter, Calendar, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format, isPast } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import Link from "next/link";

const STATUS_CONFIG: Record<string, { label: string; className: string; dotColor: string }> = {
  planned: { label: "Planned", className: "bg-secondary text-muted-foreground", dotColor: "bg-stone-400" },
  in_progress: { label: "In Progress", className: "bg-blue-500/10 text-blue-600 dark:text-blue-400", dotColor: "bg-blue-500" },
  in_review: { label: "In Review", className: "bg-amber-500/10 text-amber-600 dark:text-amber-400", dotColor: "bg-amber-500" },
  done: { label: "Done", className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400", dotColor: "bg-emerald-500" },
  changes_requested: { label: "Needs Changes", className: "bg-rose-500/10 text-rose-600 dark:text-rose-400", dotColor: "bg-rose-500" },
};

const PRIORITY_CONFIG: Record<string, { label: string; className: string }> = {
  critical: { label: "Critical", className: "text-destructive" },
  high: { label: "High", className: "text-[var(--color-accent-600)]" },
  medium: { label: "Medium", className: "text-muted-foreground" },
  low: { label: "Low", className: "text-muted-foreground/60" },
};

export default function MyTasksPage() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");

  const { data: tasks, isLoading } = trpc.tasks.myTasks.useQuery();

  const filtered = tasks?.filter(t => {
    const statusMatch = statusFilter === "all" || t.status === statusFilter;
    const priorityMatch = priorityFilter === "all" || t.priority === priorityFilter;
    return statusMatch && priorityMatch;
  }) ?? [];

  const counts = {
    total: tasks?.length ?? 0,
    inProgress: tasks?.filter(t => t.status === "in_progress").length ?? 0,
    inReview: tasks?.filter(t => t.status === "in_review").length ?? 0,
    done: tasks?.filter(t => t.status === "done").length ?? 0,
    overdue: tasks?.filter(t => t.deadline && isPast(new Date(t.deadline)) && t.status !== "done").length ?? 0,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2 text-foreground">
            <ClipboardList className="h-6 w-6 text-coral-500" />
            My Tasks
          </h1>
          <p className="text-muted-foreground text-sm mt-1">All tasks assigned to you across all projects.</p>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: "Total", value: counts.total, color: "text-foreground" },
          { label: "In Progress", value: counts.inProgress, color: "text-blue-600 dark:text-blue-400" },
          { label: "In Review", value: counts.inReview, color: "text-amber-600 dark:text-amber-400" },
          { label: "Done", value: counts.done, color: "text-emerald-600 dark:text-emerald-400" },
          { label: "Overdue", value: counts.overdue, color: "text-rose-600 dark:text-rose-400" },
        ].map(stat => (
          <div key={stat.label} className="bg-card border border-border rounded-xl px-4 py-3 text-center shadow-sm">
            <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <Select value={statusFilter} onValueChange={(val: string | null) => setStatusFilter(val ?? "all")}>
          <SelectTrigger className="w-[160px] h-9">
            <SelectValue>
              {{ all: "All Statuses", planned: "Planned", in_progress: "In Progress", in_review: "In Review", done: "Done", changes_requested: "Needs Changes" }[statusFilter] ?? "All Statuses"}
            </SelectValue>
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

        <Select value={priorityFilter} onValueChange={(val: string | null) => setPriorityFilter(val ?? "all")}>
          <SelectTrigger className="w-[150px] h-9">
            <SelectValue>
              {{ all: "All Priorities", critical: "Critical", high: "High", medium: "Medium", low: "Low" }[priorityFilter] ?? "All Priorities"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priorities</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>

        {(statusFilter !== "all" || priorityFilter !== "all") && (
          <Button variant="ghost" size="sm" className="h-9 text-muted-foreground" onClick={() => { setStatusFilter("all"); setPriorityFilter("all"); }}>
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
                  <Skeleton className="h-5 w-14 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="border-t border-transparent">
            <EmptyState
              title={tasks?.length === 0 ? "No tasks assigned" : "No results found"}
              description={tasks?.length === 0 ? "You don't have any tasks assigned to you yet." : "Try adjusting your filters to find what you're looking for."}
              icon={ClipboardList}
            />
          </div>
        ) : (
          <div className="divide-y divide-border">
            {/* Table Header */}
            <div className="grid grid-cols-[1fr_120px_100px_120px_80px_32px] gap-4 px-5 py-2.5 bg-muted/30 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <span>Task</span>
              <span>Status</span>
              <span>Priority</span>
              <span>Deadline</span>
              <span>Estimate</span>
              <span />
            </div>
            {filtered.map(task => {
              const statusCfg = STATUS_CONFIG[task.status] ?? STATUS_CONFIG.planned;
              const priorityCfg = PRIORITY_CONFIG[task.priority] ?? PRIORITY_CONFIG.medium;
              const isOverdue = task.deadline && isPast(new Date(task.deadline)) && task.status !== "done";

              return (
                <Link
                  key={task.id}
                  href={`/tasks/${task.id}`}
                  className="grid grid-cols-[1fr_120px_100px_120px_80px_32px] gap-4 items-center px-5 py-4 hover:bg-muted/30 transition-colors cursor-pointer group"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <p className="font-medium text-sm text-foreground truncate group-hover:text-primary transition-colors">{task.title}</p>
                      {task.category === "operations" ? (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0 bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                          Ops
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0 bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400">
                          Project
                        </Badge>
                      )}
                      {task.jiraIssueKey && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0 font-mono">
                          {task.jiraIssueKey}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                      {task.id} {task.project?.title ? `· ${task.project.title}` : ""} {task.domain ? `· ${task.domain}` : ""} {task.module?.title ? `· ${task.module.title}` : ""}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${statusCfg.dotColor}`} />
                    <Badge variant="outline" className={`text-[10px] border-0 px-2 py-0.5 ${statusCfg.className}`}>
                      {statusCfg.label}
                    </Badge>
                  </div>

                  <span className={`text-xs font-medium ${priorityCfg.className}`}>
                    {priorityCfg.label}
                  </span>

                  {task.deadline ? (
                    <span className={`text-xs font-medium flex items-center gap-1 ${isOverdue ? "text-rose-600 dark:text-rose-400" : "text-muted-foreground"}`}>
                      <Calendar className="h-3 w-3" />
                      {format(new Date(task.deadline), "MMM d")}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">&mdash;</span>
                  )}

                  <span className="text-xs text-muted-foreground">
                    {task.estimateDays != null ? `${task.estimateDays}d` : "\u2014"}
                  </span>

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
