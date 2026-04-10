"use client";

import { use } from "react";
import { trpc } from "@/lib/trpc/client";
import {
  Loader2,
  ArrowLeft,
  Calendar,
  Clock,
  User2,
  Boxes,
  FolderOpen,
  ExternalLink,
} from "lucide-react";
import { format } from "date-fns";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";

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

const PRIORITY_CONFIG: Record<
  string,
  { label: string; className: string }
> = {
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

export default function TaskDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const {
    data: task,
    isLoading,
    error,
  } = trpc.tasks.getById.useQuery({ id });

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col pt-4 min-h-[calc(100vh-4rem)]">
        <div className="px-8 pb-6 border-b border-stone-200 dark:border-stone-800">
          <Skeleton className="h-4 w-32 mb-6" />
          <Skeleton className="h-8 w-96 mb-3" />
          <Skeleton className="h-5 w-64" />
        </div>
        <div className="px-8 py-6 space-y-6">
          <Skeleton className="h-48 w-full rounded-xl" />
          <Skeleton className="h-32 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  if (error || !task) {
    return (
      <div className="p-8 text-center flex flex-col items-center">
        <h2 className="text-xl font-bold mb-4 text-stone-900 dark:text-stone-100">
          Task not found
        </h2>
        <p className="text-sm text-muted-foreground mb-6">
          The task you are looking for does not exist or you do not have access.
        </p>
        <Link href="/projects">
          <Button variant="outline">Back to Projects</Button>
        </Link>
      </div>
    );
  }

  const status = STATUS_CONFIG[task.status] ?? STATUS_CONFIG.planned;
  const priority = PRIORITY_CONFIG[task.priority] ?? PRIORITY_CONFIG.medium;

  return (
    <div className="flex-1 flex flex-col min-h-[calc(100vh-4rem)]">
      {/* Header */}
      <div className="px-8 pt-5 pb-6 border-b border-stone-200 dark:border-stone-800">
        <div className="mb-4">
          <Link
            href={`/projects/${task.project.id}`}
            className="inline-flex items-center text-sm font-medium text-stone-500 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100 transition-colors"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            {task.project.title}
          </Link>
        </div>

        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl font-extrabold tracking-tight text-stone-900 dark:text-stone-100">
                {task.title}
              </h1>
              <div className="flex items-center gap-2">
                <span
                  className={`h-2.5 w-2.5 rounded-full shrink-0 ${status.dotColor}`}
                />
                <span
                  className={`text-sm font-medium ${status.className}`}
                >
                  {status.label}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs font-mono text-stone-400 bg-stone-100 dark:bg-stone-800 px-2 py-1 rounded-full">
                {task.id}
              </span>
              <Badge
                variant="secondary"
                className={`text-[10px] px-2 py-0.5 font-medium ${priority.className}`}
              >
                {priority.label}
              </Badge>
            </div>
          </div>

          <Link href={`/projects/${task.project.id}`}>
            <Button variant="outline" size="sm" className="gap-2">
              <FolderOpen className="h-4 w-4" />
              View Project
            </Button>
          </Link>
        </div>
      </div>

      {/* Content */}
      <div className="px-8 py-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="col-span-2 space-y-6">
            {/* Description */}
            <div className="rounded-xl border border-stone-200 dark:border-stone-800 p-6">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">
                Description
              </h3>
              {task.description ? (
                <p className="text-sm text-stone-700 dark:text-stone-300 whitespace-pre-wrap leading-relaxed">
                  {task.description}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground italic">
                  No description provided.
                </p>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Details Card */}
            <div className="rounded-xl border border-stone-200 dark:border-stone-800 p-6 space-y-5">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Details
              </h3>

              {/* Assignee */}
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <User2 className="h-3.5 w-3.5" />
                  Assignee
                </span>
                {task.assignee ? (
                  <div className="flex items-center gap-2">
                    <Avatar className="h-6 w-6">
                      <AvatarFallback className="text-[10px] bg-stone-200 dark:bg-stone-700">
                        {task.assignee.name
                          ?.split(" ")
                          .map((p: string) => p[0])
                          .join("")
                          .toUpperCase()
                          .slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium text-stone-700 dark:text-stone-300">
                      {task.assignee.name}
                    </span>
                  </div>
                ) : (
                  <span className="text-sm text-muted-foreground">
                    Unassigned
                  </span>
                )}
              </div>

              {/* Project */}
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <FolderOpen className="h-3.5 w-3.5" />
                  Project
                </span>
                <Link
                  href={`/projects/${task.project.id}`}
                  className="text-sm font-medium text-primary hover:underline"
                >
                  {task.project.title}
                </Link>
              </div>

              {/* Module */}
              {task.module && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <Boxes className="h-3.5 w-3.5" />
                    Module
                  </span>
                  <span className="text-sm font-medium text-stone-700 dark:text-stone-300">
                    {task.module.title}
                  </span>
                </div>
              )}

              {/* Deadline */}
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" />
                  Deadline
                </span>
                <span className="text-sm text-stone-700 dark:text-stone-300">
                  {task.deadline
                    ? format(new Date(task.deadline), "MMM d, yyyy")
                    : "No deadline"}
                </span>
              </div>

              {/* Estimate */}
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  Estimate
                </span>
                <span className="text-sm text-stone-700 dark:text-stone-300">
                  {task.estimateDays != null
                    ? `${task.estimateDays} day${task.estimateDays !== 1 ? "s" : ""}`
                    : "No estimate"}
                </span>
              </div>

              {/* Jira Link */}
              {task.jiraIssueKey && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <ExternalLink className="h-3.5 w-3.5" />
                    Jira
                  </span>
                  <span className="text-sm font-mono text-stone-700 dark:text-stone-300">
                    {task.jiraIssueKey}
                  </span>
                </div>
              )}
            </div>

            {/* Timestamps */}
            <div className="rounded-xl border border-stone-200 dark:border-stone-800 p-6 space-y-3">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Activity
              </h3>
              <div className="text-xs text-muted-foreground space-y-1">
                <p>
                  Created{" "}
                  {format(new Date(task.createdAt), "MMM d, yyyy 'at' h:mm a")}
                </p>
                <p>
                  Updated{" "}
                  {format(new Date(task.updatedAt), "MMM d, yyyy 'at' h:mm a")}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
