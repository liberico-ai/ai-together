"use client";

import { use } from "react";
import type { inferRouterOutputs } from "@trpc/server";
import { trpc } from "@/lib/trpc/client";
import type { AppRouter } from "@/server/trpc/routers";
import { ArrowLeft, Layout, FileText, GitCommit, Calendar, Activity, Boxes, ClipboardList } from "lucide-react";
import { format } from "date-fns";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ModuleList } from "@/components/modules/module-list";
import { CreateModuleDialog } from "@/components/modules/create-module-dialog";
import { TaskList } from "@/components/tasks/task-list";
import { CreateTaskDialog } from "@/components/tasks/create-task-dialog";
import { DocumentManager } from "@/components/documents/document-manager";
import { Skeleton } from "@/components/ui/skeleton";
import { ProjectSettingsDialog } from "@/components/projects/project-settings-dialog";
import { CommitsTab } from "@/components/projects/commits-tab";
import { ManageTeamDialog } from "@/components/projects/manage-team-dialog";

type RouterOutputs = inferRouterOutputs<AppRouter>;
type ProjectTask = RouterOutputs["tasks"]["listByProject"][number];
type ProjectMember = RouterOutputs["projects"]["getById"]["members"][number];

const STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string }> = {
  planned: { label: "Planned", color: "text-stone-500", bgColor: "bg-stone-500" },
  in_progress: { label: "In Progress", color: "text-blue-600 dark:text-blue-400", bgColor: "bg-blue-500" },
  in_review: { label: "In Review", color: "text-amber-600 dark:text-amber-400", bgColor: "bg-amber-500" },
  changes_requested: { label: "Needs Changes", color: "text-rose-600 dark:text-rose-400", bgColor: "bg-rose-500" },
  done: { label: "Done", color: "text-emerald-600 dark:text-emerald-400", bgColor: "bg-emerald-500" },
};

function ProjectProgress({ projectId }: { projectId: string }) {
  const { data: tasks, isLoading } = trpc.tasks.listByProject.useQuery({ projectId });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    );
  }

  const total = tasks?.length ?? 0;
  const counts = {
    planned: tasks?.filter((t: ProjectTask) => t.status === "planned").length ?? 0,
    in_progress: tasks?.filter((t: ProjectTask) => t.status === "in_progress").length ?? 0,
    in_review: tasks?.filter((t: ProjectTask) => t.status === "in_review").length ?? 0,
    changes_requested: tasks?.filter((t: ProjectTask) => t.status === "changes_requested").length ?? 0,
    done: tasks?.filter((t: ProjectTask) => t.status === "done").length ?? 0,
  };

  const progressPercent = total === 0 ? 0 : Math.round((counts.done / total) * 100);
  const activeTasks = tasks?.filter((t: ProjectTask) => t.status === "in_progress" || t.status === "in_review" || t.status === "changes_requested") ?? [];

  return (
    <div className="space-y-6">
      {/* Progress Overview */}
      <div className="rounded-xl border border-stone-200 dark:border-stone-800 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            Project Progress
          </h3>
          <span className="text-2xl font-extrabold text-primary">{progressPercent}%</span>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-3 bg-stone-100 dark:bg-stone-800 rounded-full overflow-hidden mb-4">
          {total > 0 ? (
            <div className="h-full flex">
              <div
                className="bg-emerald-500 transition-all duration-500"
                style={{ width: `${(counts.done / total) * 100}%` }}
              />
              <div
                className="bg-amber-500 transition-all duration-500"
                style={{ width: `${(counts.in_review / total) * 100}%` }}
              />
              <div
                className="bg-blue-500 transition-all duration-500"
                style={{ width: `${(counts.in_progress / total) * 100}%` }}
              />
              <div
                className="bg-rose-500 transition-all duration-500"
                style={{ width: `${(counts.changes_requested / total) * 100}%` }}
              />
            </div>
          ) : (
            <div className="h-full w-0" />
          )}
        </div>

        {/* Status Breakdown */}
        <div className="grid grid-cols-5 gap-2">
          {(["done", "in_review", "in_progress", "changes_requested", "planned"] as const).map((status) => {
            const cfg = STATUS_CONFIG[status];
            return (
              <div key={status} className="text-center">
                <div className={`text-xl font-bold ${cfg.color}`}>{counts[status]}</div>
                <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider mt-0.5">{cfg.label}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Active Tasks */}
      <div className="rounded-xl border border-stone-200 dark:border-stone-800 overflow-hidden">
        <div className="px-6 py-4 border-b border-stone-200 dark:border-stone-800">
          <h3 className="text-lg font-bold text-stone-900 dark:text-stone-100">
            Active Tasks
            {activeTasks.length > 0 && (
              <Badge variant="secondary" className="ml-2">{activeTasks.length}</Badge>
            )}
          </h3>
        </div>
        {activeTasks.length === 0 ? (
          <div className="px-6 py-8 text-center text-muted-foreground text-sm">
            No tasks currently in progress.
          </div>
        ) : (
          <div className="divide-y divide-stone-100 dark:divide-stone-800">
            {activeTasks.map((task: ProjectTask) => {
              const sCfg = STATUS_CONFIG[task.status];
              return (
                <Link href={`/tasks/${task.id}`} key={task.id} className="px-6 py-4 flex items-center gap-4 hover:bg-muted/30 transition-colors cursor-pointer group">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${sCfg.bgColor}`} />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm text-stone-900 dark:text-stone-100 truncate group-hover:text-amber-500 dark:group-hover:text-amber-400 transition-colors">{task.title}</div>
                    <div className="text-xs text-muted-foreground font-mono">{task.id}</div>
                  </div>
                  <Badge variant="outline" className={`text-[10px] border-0 px-2 py-0.5 shrink-0 ${sCfg.color} ${sCfg.bgColor}/10`}>
                    {sCfg.label}
                  </Badge>
                  {task.assignee && (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Avatar className="h-5 w-5">
                        <AvatarFallback className="text-[9px] bg-stone-100 dark:bg-stone-800">
                          {task.assignee.name?.charAt(0) || "?"}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-xs text-muted-foreground">{task.assignee.name}</span>
                    </div>
                  )}
                  {task.deadline && (
                    <span className="text-xs text-muted-foreground flex items-center gap-1 shrink-0">
                      <Calendar className="h-3 w-3" />
                      {format(new Date(task.deadline), "MMM d")}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data: project, isLoading, error } = trpc.projects.getById.useQuery({
    id,
  });

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col pt-4 min-h-[calc(100vh-4rem)]">
        <div className="px-8 pb-6 border-b border-stone-200 dark:border-stone-800">
          <Skeleton className="h-4 w-32 mb-6" />
          <div className="flex items-start justify-between">
            <div className="space-y-3">
              <Skeleton className="h-8 w-64" />
              <Skeleton className="h-5 w-96 max-w-full" />
            </div>
            <div className="flex space-x-2">
              <Skeleton className="h-9 w-24 rounded-md" />
              <Skeleton className="h-9 w-32 rounded-md" />
            </div>
          </div>
        </div>
        <div className="flex-1 px-8 py-6">
          <Skeleton className="h-10 w-[400px] max-w-full mb-8" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Skeleton className="col-span-2 h-64 rounded-xl" />
            <Skeleton className="h-64 rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="p-8 text-center text-red-500 flex flex-col items-center">
        <h2 className="text-xl font-bold mb-4">Project not found</h2>
        <Link href="/projects">
          <Button variant="outline">Back to Projects</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-[calc(100vh-4rem)]">
      {/* Header Area */}
      <div className="px-8 pt-5 pb-6 border-b border-stone-200 dark:border-stone-800">
        <div className="mb-4">
          <Link
            href="/projects"
            className="inline-flex items-center text-sm font-medium text-stone-500 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100 transition-colors"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Projects
          </Link>
        </div>
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center space-x-3 mb-2">
              <h1 className="text-3xl font-extrabold tracking-tight text-stone-900 dark:text-stone-100">
                {project.title}
              </h1>
              <Badge variant="secondary" className="uppercase tracking-wider text-xs">
                {project.status.replace("_", " ")}
              </Badge>
              <span className="text-xs font-mono text-stone-400 bg-stone-100 dark:bg-stone-800 px-2 py-1 rounded-full">
                {project.id}
              </span>
            </div>
            <p className="text-base text-stone-500 dark:text-stone-400 max-w-2xl">
              {project.description || "No description provided."}
            </p>
          </div>
          <div className="flex space-x-2">
            <ProjectSettingsDialog project={project} />
            <CreateTaskDialog projectId={project.id} />
            <CreateModuleDialog projectId={project.id} />
          </div>
        </div>
      </div>

      {/* Tabs Area */}
      <div className="flex-1 px-8 py-6">
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="flex w-auto justify-center gap-3 bg-transparent rounded-none !h-auto p-0 mx-auto">
            <TabsTrigger 
              value="overview" 
              className="glassmorphic-tab flex-initial flex items-center gap-2 px-5 py-2.5 !rounded-full font-medium text-sm border border-transparent text-muted-foreground hover:text-foreground transition-all duration-200 !bg-transparent !shadow-none m-0"
            >
              <Layout className="h-4 w-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger
              value="modules"
              className="glassmorphic-tab flex-initial flex items-center gap-2 px-5 py-2.5 !rounded-full font-medium text-sm border border-transparent text-muted-foreground hover:text-foreground transition-all duration-200 !bg-transparent !shadow-none m-0"
            >
              <Boxes className="h-4 w-4" />
              Modules
            </TabsTrigger>
            <TabsTrigger
              value="tasks"
              className="glassmorphic-tab flex-initial flex items-center gap-2 px-5 py-2.5 !rounded-full font-medium text-sm border border-transparent text-muted-foreground hover:text-foreground transition-all duration-200 !bg-transparent !shadow-none m-0"
            >
              <ClipboardList className="h-4 w-4" />
              Tasks
            </TabsTrigger>
            <TabsTrigger
              value="documents" 
              className="glassmorphic-tab flex-initial flex items-center gap-2 px-5 py-2.5 !rounded-full font-medium text-sm border border-transparent text-muted-foreground hover:text-foreground transition-all duration-200 !bg-transparent !shadow-none m-0"
            >
              <FileText className="h-4 w-4" />
              Documents
            </TabsTrigger>
            <TabsTrigger 
              value="commits" 
              className="glassmorphic-tab flex-initial flex items-center gap-2 px-5 py-2.5 !rounded-full font-medium text-sm border border-transparent text-muted-foreground hover:text-foreground transition-all duration-200 !bg-transparent !shadow-none m-0"
            >
              <GitCommit className="h-4 w-4" />
              Commits
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Project Info */}
              <div className="col-span-2 space-y-6">
                {/* Project Progress */}
                <ProjectProgress projectId={project.id} />
              </div>
              {/* Sidebar */}
              <div className="space-y-6">
                <div className="rounded-xl border border-stone-200 dark:border-stone-800 p-6">
                  <h3 className="text-lg font-bold mb-4 flex items-center text-stone-900 dark:text-stone-100">
                    Team Members
                    <Badge variant="secondary" className="ml-auto">{project.members.length + 1}</Badge>
                  </h3>
                  <div className="space-y-4">
                    {/* Project Manager */}
                    <div className="flex items-center space-x-3">
                      <Avatar className="h-9 w-9 ring-2 ring-amber-500/30">
                        <AvatarFallback className="bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300 font-semibold">
                          {project.chairman?.name?.charAt(0) || "U"}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-semibold">{project.chairman?.name}</p>
                        <p className="text-xs text-stone-500">Project Manager</p>
                      </div>
                    </div>
                    {/* Members (exclude PM to avoid duplicate) */}
                    {project.members
                      .filter((m: ProjectMember) => m.user.id !== project.chairman?.id)
                      .map((m: ProjectMember) => (
                      <div key={m.user.id} className="flex items-center space-x-3">
                        <Avatar className="h-9 w-9">
                          <AvatarFallback className="bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-300 font-semibold">
                            {m.user.name?.charAt(0) || "U"}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-semibold">{m.user.name}</p>
                          <p className="text-xs text-stone-500">{m.user.role === "admin" ? "Admin" : "Member"}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <ManageTeamDialog project={project} />
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="modules">
            <ModuleList projectId={project.id} />
          </TabsContent>

          <TabsContent value="tasks">
            <TaskList projectId={project.id} />
          </TabsContent>

          <TabsContent value="documents">
            <DocumentManager targetType="project" targetId={project.id} />
          </TabsContent>

          <TabsContent value="commits">
            <CommitsTab 
              projectId={project.id} 
              githubOwner={project.githubOwner} 
              githubRepo={project.githubRepo} 
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
