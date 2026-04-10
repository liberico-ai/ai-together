"use client";

import { trpc } from "@/lib/trpc/client";
import {
  Users, ClipboardList, AlertTriangle, CheckCircle2,
  Calendar, Clock, TrendingUp, User2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format, isPast } from "date-fns";
import Link from "next/link";

const STATUS_CONFIG: Record<string, { label: string; dotColor: string; className: string }> = {
  planned: { label: "Planned", dotColor: "bg-stone-400", className: "text-stone-600 dark:text-stone-400" },
  in_progress: { label: "In Progress", dotColor: "bg-blue-500", className: "text-blue-600 dark:text-blue-400" },
  in_review: { label: "In Review", dotColor: "bg-amber-500", className: "text-amber-600 dark:text-amber-400" },
  changes_requested: { label: "Needs Changes", dotColor: "bg-rose-500", className: "text-rose-600 dark:text-rose-400" },
  done: { label: "Done", dotColor: "bg-emerald-500", className: "text-emerald-600 dark:text-emerald-400" },
};

function SummaryCard({ label, value, icon: Icon, color }: {
  label: string; value: number; icon: React.ElementType; color: string;
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-5 shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-0.5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground font-medium">{label}</p>
          <p className={`text-3xl font-bold mt-1 ${color}`}>{value}</p>
        </div>
        <div className="p-2.5 rounded-lg bg-secondary/50">
          <Icon className={`w-5 h-5 ${color}`} />
        </div>
      </div>
    </div>
  );
}

function MyWorkloadTab() {
  const { data: tasks, isLoading } = trpc.tasks.myTasks.useQuery();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[88px] rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-[300px] rounded-xl" />
      </div>
    );
  }

  const allTasks = tasks ?? [];
  const now = new Date();

  const totalTasks = allTasks.length;
  const inProgress = allTasks.filter(t => t.status === "in_progress" || t.status === "in_review").length;
  const done = allTasks.filter(t => t.status === "done").length;
  const overdue = allTasks.filter(t => t.status !== "done" && t.deadline && isPast(new Date(t.deadline))).length;

  const projectTasks = allTasks.filter(t => t.category === "project");
  const opsTasks = allTasks.filter(t => t.category === "operations");

  const totalEstimate = allTasks.reduce((sum, t) => sum + (t.estimateDays ?? 0), 0);
  const completionRate = totalTasks > 0 ? Math.round((done / totalTasks) * 100) : 0;

  // Active tasks (not done)
  const activeTasks = allTasks
    .filter(t => t.status !== "done")
    .sort((a, b) => {
      if (a.deadline && b.deadline) return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
      if (a.deadline) return -1;
      if (b.deadline) return 1;
      return 0;
    });

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard label="My Tasks" value={totalTasks} icon={ClipboardList} color="text-primary" />
        <SummaryCard label="In Progress" value={inProgress} icon={TrendingUp} color="text-blue-600 dark:text-blue-400" />
        <SummaryCard label="Completed" value={done} icon={CheckCircle2} color="text-emerald-600 dark:text-emerald-400" />
        <SummaryCard label="Overdue" value={overdue} icon={AlertTriangle} color="text-rose-600 dark:text-rose-400" />
      </div>

      {/* Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
          <p className="text-sm text-muted-foreground font-medium">Completion Rate</p>
          <p className="text-3xl font-bold mt-1 text-foreground">{completionRate}%</p>
          <div className="w-full h-2 bg-muted rounded-full mt-3 overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all duration-500"
              style={{ width: `${completionRate}%` }}
            />
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
          <p className="text-sm text-muted-foreground font-medium">Est. Workload</p>
          <p className="text-3xl font-bold mt-1 text-foreground">{totalEstimate > 0 ? `${totalEstimate}d` : "—"}</p>
          <p className="text-xs text-muted-foreground mt-2">Total estimated days</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
          <p className="text-sm text-muted-foreground font-medium">By Category</p>
          <div className="flex items-center gap-4 mt-2">
            <div>
              <Badge variant="secondary" className="text-[10px] bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400">Project</Badge>
              <p className="text-lg font-bold mt-1">{projectTasks.length}</p>
            </div>
            <div>
              <Badge variant="secondary" className="text-[10px] bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">Van hanh</Badge>
              <p className="text-lg font-bold mt-1">{opsTasks.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Active Tasks */}
      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-blue-500" />
          <h2 className="text-lg font-semibold">Active Tasks</h2>
          <Badge variant="secondary" className="ml-auto">{activeTasks.length}</Badge>
        </div>

        {activeTasks.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            No active tasks. You're all caught up!
          </div>
        ) : (
          <div className="divide-y divide-border">
            {activeTasks.map((task) => {
              const sCfg = STATUS_CONFIG[task.status] ?? STATUS_CONFIG.planned;
              const isOverdue = task.deadline && isPast(new Date(task.deadline));

              return (
                <Link
                  key={task.id}
                  href={`/tasks/${task.id}`}
                  className="flex items-center gap-4 px-5 py-3.5 hover:bg-muted/30 transition-colors group"
                >
                  <div className={`w-2 h-2 rounded-full shrink-0 ${sCfg.dotColor}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                        {task.title}
                      </p>
                      {task.category === "operations" ? (
                        <Badge variant="secondary" className="text-[9px] px-1.5 py-0 shrink-0 bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                          Van hanh
                        </Badge>
                      ) : null}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {task.project?.title ?? task.domain ?? "Operations"} · {task.id}
                    </p>
                  </div>
                  <Badge variant="outline" className={`text-[10px] border-0 px-2 py-0.5 shrink-0 ${sCfg.className}`}>
                    {sCfg.label}
                  </Badge>
                  {task.deadline ? (
                    <span className={`text-xs font-medium flex items-center gap-1 shrink-0 ${isOverdue ? "text-rose-600 dark:text-rose-400" : "text-muted-foreground"}`}>
                      <Clock className="h-3 w-3" />
                      {format(new Date(task.deadline), "MMM d")}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground shrink-0">—</span>
                  )}
                  {task.estimateDays != null && (
                    <span className="text-xs text-muted-foreground shrink-0">
                      {task.estimateDays}d
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

function TeamWorkloadTab() {
  const { data, isLoading } = trpc.dashboard.getWorkloadOverview.useQuery();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[88px] rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-[400px] rounded-xl" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-20 text-muted-foreground">
        No data available.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard label="Total Tasks" value={data.summary.totalTasks} icon={ClipboardList} color="text-primary" />
        <SummaryCard label="In Progress" value={data.summary.totalInProgress} icon={TrendingUp} color="text-blue-600 dark:text-blue-400" />
        <SummaryCard label="Completed" value={data.summary.totalDone} icon={CheckCircle2} color="text-emerald-600 dark:text-emerald-400" />
        <SummaryCard label="Overdue" value={data.summary.totalOverdue} icon={AlertTriangle} color="text-rose-600 dark:text-rose-400" />
      </div>

      {/* Member Workload Table */}
      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="text-lg font-semibold">Member Workload</h2>
        </div>

        {data.members.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            No tasks assigned to any member yet.
          </div>
        ) : (
          <>
            <div className="grid grid-cols-[1fr_80px_80px_80px_80px_100px_80px] gap-4 px-5 py-2.5 bg-muted/30 text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b border-border">
              <span>Member</span>
              <span className="text-center">Total</span>
              <span className="text-center">Active</span>
              <span className="text-center">Done</span>
              <span className="text-center">Overdue</span>
              <span className="text-center">Est. Days</span>
              <span className="text-center">Rate</span>
            </div>

            <div className="divide-y divide-border">
              {data.members.map((member) => (
                <div
                  key={member.user.id}
                  className="grid grid-cols-[1fr_80px_80px_80px_80px_100px_80px] gap-4 px-5 py-3.5 items-center hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="text-xs bg-stone-100 dark:bg-stone-800 font-semibold">
                        {member.user.name?.charAt(0) || "?"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{member.user.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{member.user.email}</p>
                    </div>
                  </div>
                  <p className="text-sm font-bold text-center">{member.total}</p>
                  <p className="text-sm text-center text-blue-600 dark:text-blue-400 font-medium">{member.inProgress}</p>
                  <p className="text-sm text-center text-emerald-600 dark:text-emerald-400 font-medium">{member.done}</p>
                  <p className={`text-sm text-center font-medium ${member.overdue > 0 ? "text-rose-600 dark:text-rose-400" : "text-muted-foreground"}`}>
                    {member.overdue}
                  </p>
                  <p className="text-sm text-center text-muted-foreground">
                    {member.totalEstimateDays > 0 ? `${member.totalEstimateDays}d` : "—"}
                  </p>
                  <div className="flex justify-center">
                    <Badge
                      variant="outline"
                      className={`text-xs ${
                        member.completionRate >= 80
                          ? "border-emerald-500 text-emerald-600 dark:text-emerald-400"
                          : member.completionRate >= 50
                          ? "border-amber-500 text-amber-600 dark:text-amber-400"
                          : "border-stone-300 text-muted-foreground"
                      }`}
                    >
                      {member.completionRate}%
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Upcoming Deadlines */}
      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center gap-2">
          <Calendar className="h-5 w-5 text-amber-500" />
          <h2 className="text-lg font-semibold">Upcoming Deadlines</h2>
          <Badge variant="secondary" className="ml-auto">{data.upcoming.length}</Badge>
        </div>

        {data.upcoming.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            No upcoming deadlines in the next 7 days.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {data.upcoming.map((task: any) => {
              const sCfg = STATUS_CONFIG[task.status] ?? STATUS_CONFIG.planned;
              const isOverdue = task.deadline && isPast(new Date(task.deadline));

              return (
                <Link
                  key={task.id}
                  href={`/tasks/${task.id}`}
                  className="flex items-center gap-4 px-5 py-3.5 hover:bg-muted/30 transition-colors group"
                >
                  <div className={`w-2 h-2 rounded-full shrink-0 ${sCfg.dotColor}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                      {task.title}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {task.project?.title ?? task.domain ?? "Operations"} · {task.id}
                    </p>
                  </div>
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
                  <span className={`text-xs font-medium flex items-center gap-1 shrink-0 ${isOverdue ? "text-rose-600 dark:text-rose-400" : "text-muted-foreground"}`}>
                    <Clock className="h-3 w-3" />
                    {task.deadline ? format(new Date(task.deadline), "MMM d") : "—"}
                  </span>
                  {task.estimateDays && (
                    <span className="text-xs text-muted-foreground shrink-0">
                      {task.estimateDays}d
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

export default function WorkloadPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2 text-foreground">
          <Users className="h-6 w-6 text-coral-500" />
          Workload
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Track your workload and team task distribution.
        </p>
      </div>

      <Tabs defaultValue="my" className="space-y-6">
        <TabsList className="flex w-auto justify-start gap-3 bg-transparent rounded-none !h-auto p-0">
          <TabsTrigger
            value="my"
            className="glassmorphic-tab flex-initial flex items-center gap-2 px-5 py-2.5 !rounded-full font-medium text-sm border border-transparent text-muted-foreground hover:text-foreground transition-all duration-200 !bg-transparent !shadow-none m-0"
          >
            <User2 className="h-4 w-4" />
            My Workload
          </TabsTrigger>
          <TabsTrigger
            value="team"
            className="glassmorphic-tab flex-initial flex items-center gap-2 px-5 py-2.5 !rounded-full font-medium text-sm border border-transparent text-muted-foreground hover:text-foreground transition-all duration-200 !bg-transparent !shadow-none m-0"
          >
            <Users className="h-4 w-4" />
            Team
          </TabsTrigger>
        </TabsList>

        <TabsContent value="my">
          <MyWorkloadTab />
        </TabsContent>

        <TabsContent value="team">
          <TeamWorkloadTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
