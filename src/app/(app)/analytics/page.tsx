"use client";

import { trpc } from "@/lib/trpc/client";
import { useSession } from "@/lib/auth/client";
import { Loader2, BarChart3, TrendingUp, CheckCircle2, Clock } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Skeleton } from "@/components/ui/skeleton";
import { useTheme } from "next-themes";

function StatCard({ title, value, subtitle, icon: Icon, color }: {
  title: string;
  value: number | string;
  subtitle?: string;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        <div className={`p-2 rounded-lg ${color}`}>
          <Icon className="h-4 w-4 text-white" />
        </div>
      </div>
      <p className="text-3xl font-bold text-foreground">{value}</p>
      {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
    </div>
  );
}

function ProgressBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <span className="text-sm font-medium text-foreground">{label}</span>
        <span className="text-sm font-bold text-foreground">{value} <span className="text-muted-foreground font-normal">/ {max}</span></span>
      </div>
      <div className="h-2.5 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ease-out ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-xs text-muted-foreground">{pct}% complete</p>
    </div>
  );
}

export default function AnalyticsPage() {
  const { data: session } = useSession();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const { data: stats, isLoading: statsLoading } = trpc.dashboard.getStats.useQuery();
  const { data: leaderboard, isLoading: lbLoading } = trpc.dashboard.getLeaderboard.useQuery();
  const { data: myTasks, isLoading: tasksLoading } = trpc.tasks.myTasks.useQuery();
  const { data: projectProgress, isLoading: progressLoading } = trpc.dashboard.getProjectProgress.useQuery();

  const isLoading = statsLoading || lbLoading || tasksLoading || progressLoading;

  const myRank = leaderboard?.findIndex(u => u.userId === session?.user?.id);
  const myScore = leaderboard?.find(u => u.userId === session?.user?.id)?.totalPoints ?? 0;

  const tasksByStatus = {
    planned: myTasks?.filter(m => m.status === "planned").length ?? 0,
    in_progress: myTasks?.filter(m => m.status === "in_progress").length ?? 0,
    in_review: myTasks?.filter(m => m.status === "in_review").length ?? 0,
    done: myTasks?.filter(m => m.status === "done").length ?? 0,
    changes_requested: myTasks?.filter(m => m.status === "changes_requested").length ?? 0,
  };
  const totalTasks = Object.values(tasksByStatus).reduce((a, b) => a + b, 0);
  const completionRate = totalTasks > 0 ? Math.round((tasksByStatus.done / totalTasks) * 100) : 0;

  // Theme-aware chart colors
  const chartGridColor = isDark ? "#44403c" : "#e7e5e4";
  const chartTickColor = isDark ? "#a8a29e" : "#78716c";
  const chartPendingColor = isDark ? "#44403c" : "#e7e5e4";
  const tooltipBg = isDark ? "#292524" : "#ffffff";
  const tooltipBorder = isDark ? "#44403c" : "#e7e5e4";

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2 text-foreground">
          <BarChart3 className="h-6 w-6 text-coral-500" />
          Analytics
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Your performance metrics and platform activity overview.</p>
      </div>

      {isLoading ? (
        <div className="space-y-8">
          <section>
            <Skeleton className="h-5 w-48 mb-4" />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-[104px] w-full rounded-xl" />
              ))}
            </div>
          </section>
          <section>
            <Skeleton className="h-5 w-48 mb-6" />
            <Skeleton className="h-[300px] w-full rounded-xl" />
          </section>
          <section>
            <Skeleton className="h-5 w-48 mb-6" />
            <Skeleton className="h-[300px] w-full rounded-xl" />
          </section>
        </div>
      ) : (
        <>
          {/* Personal KPIs */}
          <section>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">Personal Overview</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard title="Tasks Assigned" value={stats?.tasks?.assigned ?? 0} icon={Clock} color="bg-blue-500" subtitle="Total across all projects" />
              <StatCard title="Completion Rate" value={`${completionRate}%`} icon={CheckCircle2} color="bg-emerald-500" subtitle={`${tasksByStatus.done} tasks done`} />
              <StatCard title="Your Rank" value={myRank !== undefined && myRank >= 0 ? `#${myRank + 1}` : "N/A"} icon={TrendingUp} color="bg-amber-500" subtitle="Platform leaderboard position" />
              <StatCard title="Total Points" value={myScore} icon={BarChart3} color="bg-coral-500" subtitle="Points earned from approvals" />
            </div>
          </section>

          {/* Task Distribution */}
          <section className="bg-card border border-border rounded-xl p-6 shadow-sm">
            <h2 className="text-base font-semibold text-foreground mb-6">Task Status Distribution</h2>
            <div className="space-y-5">
              <ProgressBar label="Done ✅" value={tasksByStatus.done} max={totalTasks} color="bg-emerald-500" />
              <ProgressBar label="In Review 🔍" value={tasksByStatus.in_review} max={totalTasks} color="bg-amber-400" />
              <ProgressBar label="In Progress 🚀" value={tasksByStatus.in_progress} max={totalTasks} color="bg-blue-500" />
              <ProgressBar label="Planned 📋" value={tasksByStatus.planned} max={totalTasks} color="bg-stone-400" />
              <ProgressBar label="Changes Requested 🔄" value={tasksByStatus.changes_requested} max={totalTasks} color="bg-rose-400" />
            </div>
          </section>

          {/* Project Progress Chart */}
          <section className="bg-card border border-border rounded-xl p-6 shadow-sm">
            <h2 className="text-base font-semibold text-foreground mb-6">Active Projects Progress</h2>
            <div className="h-[300px] w-full">
              {projectProgress && projectProgress.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={projectProgress} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartGridColor} />
                    <XAxis dataKey="name" tick={{ fontSize: 12, fill: chartTickColor }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 12, fill: chartTickColor }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip
                      cursor={{ fill: 'transparent' }}
                      contentStyle={{
                        borderRadius: '8px',
                        border: `1px solid ${tooltipBorder}`,
                        backgroundColor: tooltipBg,
                        color: isDark ? '#fef2f2' : '#1c1917',
                        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                      }}
                    />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: 13, paddingTop: '10px' }} />
                    <Bar dataKey="done" name="Completed Tasks" stackId="a" fill="#10b981" radius={[0, 0, 4, 4]} />
                    <Bar dataKey="pending" name="Pending Tasks" stackId="a" fill={chartPendingColor} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full border-2 border-dashed border-border rounded-lg text-muted-foreground text-sm">
                  No active projects found.
                </div>
              )}
            </div>
          </section>

          {/* Platform Leaderboard Snapshot */}
          <section className="bg-card border border-border rounded-xl p-6 shadow-sm">
            <h2 className="text-base font-semibold text-foreground mb-4">Platform Leaderboard</h2>
            <div className="space-y-3">
              {leaderboard?.slice(0, 5).map((user, idx) => {
                const isMe = user.userId === session?.user?.id;
                const widthPct = leaderboard[0]?.totalPoints > 0 ? (user.totalPoints / leaderboard[0].totalPoints) * 100 : 0;
                return (
                  <div key={user.userId} className={`flex items-center gap-4 p-3 rounded-lg ${isMe ? "bg-primary/5" : ""}`}>
                    <span className="w-6 text-center text-sm font-bold text-muted-foreground">#{idx + 1}</span>
                    <div className="w-7 h-7 rounded-full gradient-coral flex items-center justify-center text-white text-xs font-bold">
                      {user.name?.charAt(0) ?? "?"}
                    </div>
                    <span className={`text-sm font-medium flex-1 ${isMe ? "text-primary" : "text-foreground"}`}>
                      {user.name} {isMe && "(You)"}
                    </span>
                    <div className="flex items-center gap-2 w-1/3">
                      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-coral-400 rounded-full transition-all duration-700" style={{ width: `${widthPct}%` }} />
                      </div>
                      <span className="text-xs font-bold text-foreground w-16 text-right">{user.totalPoints} pts</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
