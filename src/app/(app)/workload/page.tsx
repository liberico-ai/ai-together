"use client";

import { trpc } from "@/lib/trpc/client";
import {
  Users, ClipboardList, AlertTriangle, CheckCircle2,
  Loader2, Calendar, Clock, TrendingUp,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
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

export default function WorkloadPage() {
  const { data, isLoading } = trpc.dashboard.getWorkloadOverview.useQuery();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2 text-foreground">
          <Users className="h-6 w-6 text-coral-500" />
          Workload Overview
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Task distribution and workload across all team members.
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-[88px] rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-[400px] rounded-xl" />
        </div>
      ) : !data ? (
        <div className="text-center py-20 text-muted-foreground">
          No data available.
        </div>
      ) : (
        <>
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
        </>
      )}
    </div>
  );
}
