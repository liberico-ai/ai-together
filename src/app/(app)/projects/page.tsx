"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Users, Layout, Activity, Calendar, ChevronDown } from "lucide-react";
import Link from "next/link";
import { CreateProjectDialog } from "@/components/projects/create-project-dialog";
import { formatDistanceToNow, format } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { ViewToggle, useViewMode } from "@/components/ui/view-toggle";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const STATUS_CONFIG: Record<string, { label: string; className: string; dotColor: string }> = {
  planning: { label: "Planning", className: "bg-blue-500/10 text-blue-600 dark:text-blue-400", dotColor: "bg-blue-500" },
  active: { label: "Active", className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400", dotColor: "bg-emerald-500" },
  on_hold: { label: "On Hold", className: "bg-amber-500/10 text-amber-600 dark:text-amber-400", dotColor: "bg-amber-500" },
  done: { label: "Done", className: "bg-green-500/10 text-green-600 dark:text-green-400", dotColor: "bg-green-500" },
  archived: { label: "Archived", className: "bg-stone-500/10 text-stone-500 dark:text-stone-400", dotColor: "bg-stone-400" },
};

const ALL_STATUSES = ["planning", "active", "on_hold", "done", "archived"] as const;

function StatusDropdown({ projectId, currentStatus }: { projectId: string; currentStatus: string }) {
  const utils = trpc.useUtils();
  const updateProject = trpc.projects.update.useMutation({
    onSuccess: () => {
      utils.projects.list.invalidate();
    },
  });

  const cfg = STATUS_CONFIG[currentStatus] ?? { label: currentStatus, className: "bg-secondary", dotColor: "bg-gray-400" };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
          render={
            <button
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors hover:opacity-80 ${cfg.className}`}
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
            />
          }
        >
          <span className={`w-1.5 h-1.5 rounded-full ${cfg.dotColor}`} />
          {cfg.label}
          <ChevronDown className="h-3 w-3 opacity-50" />
        </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-40" onClick={(e) => e.preventDefault()}>
        {ALL_STATUSES.map((status) => {
          const scfg = STATUS_CONFIG[status];
          const isActive = status === currentStatus;
          return (
            <DropdownMenuItem
              key={status}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (!isActive) {
                  updateProject.mutate({ id: projectId, status });
                }
              }}
              className={isActive ? "font-semibold" : ""}
            >
              <span className={`w-2 h-2 rounded-full mr-2 ${scfg.dotColor}`} />
              {scfg.label}
              {isActive && <span className="ml-auto text-xs text-muted-foreground">✓</span>}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default function ProjectsPage() {
  const { data: projects, isLoading, error } = trpc.projects.list.useQuery();
  const [view, setView] = useViewMode("projects-view", "card");

  if (isLoading) {
    return (
      <div className="flex-1 space-y-6 p-8 pt-6 min-h-[calc(100vh-4rem)]">
        <div className="flex items-center justify-between space-y-2 mb-6">
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-72" />
          </div>
          <Skeleton className="h-10 w-32 rounded-md" />
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="overflow-hidden h-[240px] flex flex-col border-border">
               <CardHeader className="pb-4">
                 <div className="flex justify-between items-start mb-2">
                   <Skeleton className="h-5 w-16" />
                   <Skeleton className="h-4 w-20" />
                 </div>
                 <Skeleton className="h-6 w-3/4 mb-3" />
                 <Skeleton className="h-4 w-full" />
                 <Skeleton className="h-4 w-2/3 mt-2" />
               </CardHeader>
               <CardContent className="flex-1">
                 <div className="flex items-center space-x-2 mt-4">
                   <Skeleton className="h-6 w-6 rounded-full" />
                   <Skeleton className="h-4 w-24" />
                 </div>
               </CardContent>
               <CardFooter className="bg-muted/50 py-3 border-t border-border">
                 <Skeleton className="h-4 w-24" />
               </CardFooter>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-center text-red-500">
        Error loading projects: {error.message}
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-6 p-8 pt-6 min-h-[calc(100vh-4rem)]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground">
            Projects
          </h2>
          <p className="text-muted-foreground">
            Manage your initiatives, assignments, and overall agency progress.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <ViewToggle storageKey="projects-view" onChange={setView} />
          <CreateProjectDialog />
        </div>
      </div>

      {projects?.length === 0 ? (
        <EmptyState
          title="No projects yet"
          description="You have not created or joined any projects."
          icon={Layout}
          action={<CreateProjectDialog />}
        />
      ) : view === "card" ? (
        /* ============================
           CARD VIEW
           ============================ */
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {projects?.map((project) => (
            <Link key={project.id} href={`/projects/${project.id}`}>
              <Card className="group hover:shadow-lg transition-all duration-300 border-border overflow-hidden cursor-pointer h-full flex flex-col">
                <div className="h-2 w-full bg-gradient-to-r from-rose-400 to-coral-500 opacity-75 group-hover:opacity-100 transition-opacity" />
                <CardHeader className="pb-4">
                  <div className="flex justify-between items-start">
                    <StatusDropdown projectId={project.id} currentStatus={project.status} />
                    <span className="text-xs text-muted-foreground font-mono">{project.id}</span>
                  </div>
                  <CardTitle className="text-xl group-hover:text-coral-600 dark:group-hover:text-coral-400 transition-colors">
                    {project.title}
                  </CardTitle>
                  <CardDescription className="line-clamp-2 min-h-[2.5rem]">
                    {project.description || "No description provided."}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex-1">
                  <div className="flex items-center text-sm text-muted-foreground mb-3">
                    <Activity className="mr-2 h-4 w-4" />
                    Began {formatDistanceToNow(new Date(project.createdAt), { addSuffix: true })}
                  </div>
                  {project.deadline && (
                    <div className="flex items-center text-sm text-muted-foreground mb-3">
                      <Calendar className="mr-2 h-4 w-4" />
                      <span>Due {format(new Date(project.deadline), "MMM d, yyyy")}</span>
                    </div>
                  )}
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-semibold uppercase text-muted-foreground">Chairman</span>
                    <div className="flex items-center space-x-2">
                      <Avatar className="h-6 w-6">
                        <AvatarFallback className="text-[10px] bg-amber-500/15 text-amber-700 dark:text-amber-300">
                          {project.chairman?.name?.charAt(0) || "U"}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm font-medium text-foreground">{project.chairman?.name}</span>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="bg-muted/50 py-3 border-t border-border flex justify-between">
                  <div className="flex items-center text-muted-foreground text-sm">
                    <Users className="mr-1.5 h-4 w-4" />
                    <span>{project.members.length + 1} members</span>
                  </div>
                </CardFooter>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        /* ============================
           TABLE VIEW
           ============================ */
        <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground px-5 py-3">Project</th>
                <th className="text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground px-4 py-3">Status</th>
                <th className="text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground px-4 py-3">Chairman</th>
                <th className="text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground px-4 py-3">Members</th>
                <th className="text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground px-4 py-3">Deadline</th>
                <th className="text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground px-4 py-3">Created</th>
              </tr>
            </thead>
            <tbody>
              {projects?.map((project) => (
                <tr
                  key={project.id}
                  className="border-b border-border/50 last:border-b-0 hover:bg-muted/30 transition-colors cursor-pointer group"
                >
                  <td className="px-5 py-4">
                    <Link href={`/projects/${project.id}`} className="block">
                      <div className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors">
                        {project.title}
                      </div>
                      <div className="text-xs text-muted-foreground font-mono mt-0.5">{project.id}</div>
                    </Link>
                  </td>
                  <td className="px-4 py-4">
                    <StatusDropdown projectId={project.id} currentStatus={project.status} />
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2">
                      <Avatar className="h-6 w-6">
                        <AvatarFallback className="text-[10px] bg-amber-500/15 text-amber-700 dark:text-amber-300">
                          {project.chairman?.name?.charAt(0) || "U"}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm text-foreground">{project.chairman?.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-center">
                    <span className="text-sm font-medium text-foreground">{project.members.length + 1}</span>
                  </td>
                  <td className="px-4 py-4">
                    {project.deadline ? (
                      <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5" />
                        {format(new Date(project.deadline), "MMM d, yyyy")}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground/50">—</span>
                    )}
                  </td>
                  <td className="px-4 py-4">
                    <span className="text-sm text-muted-foreground">
                      {formatDistanceToNow(new Date(project.createdAt), { addSuffix: true })}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
