"use client";

import {
  LayoutDashboard,
  FolderKanban,
  Boxes,
  Trophy,
  Flame,
  Loader2,
  Zap,
  ChevronRight,
  Folder,
  PlayCircle,
  CheckCircle2,
} from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { useSession } from "@/lib/auth/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Link from "next/link";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ActiveProjectsList } from "@/components/dashboard/active-projects-list";

const defaultStats = [
  { label: "Modules Assigned", value: "0", icon: Boxes, color: "text-primary" },
  { label: "In Progress", value: "0", icon: LayoutDashboard, color: "text-[var(--color-accent-500)]" },
  { label: "Completed", value: "0", icon: FolderKanban, color: "text-[var(--color-success)]" },
  { label: "Overdue", value: "0", icon: Flame, color: "text-destructive" },
];

export default function DashboardPage() {
  const { data: session } = useSession();
  const { data: statsData, isLoading: statsLoading } = trpc.dashboard.getStats.useQuery();
  const { data: leaderboard, isLoading: leaderboardLoading } = trpc.dashboard.getLeaderboard.useQuery();
  const { data: myModules, isLoading: modulesLoading } = trpc.modules.myModules.useQuery();

  const moduleStats = [
    { label: "Modules Assigned", value: statsData?.modules?.assigned || 0, icon: Boxes, color: "text-primary" },
    { label: "In Progress", value: statsData?.modules?.inProgress || 0, icon: LayoutDashboard, color: "text-[var(--color-accent-500)]" },
    { label: "Completed", value: statsData?.modules?.completed || 0, icon: FolderKanban, color: "text-[var(--color-success)]" },
    { label: "Overdue", value: statsData?.modules?.overdue || 0, icon: Flame, color: "text-destructive" },
  ];

  const projectStats = [
    { label: "Total Projects", value: statsData?.projects?.total || 0, icon: Folder, color: "text-primary" },
    { label: "Active", value: statsData?.projects?.active || 0, icon: PlayCircle, color: "text-[var(--color-accent-500)]" },
    { label: "Completed", value: statsData?.projects?.completed || 0, icon: CheckCircle2, color: "text-[var(--color-success)]" },
    { label: "Overdue", value: statsData?.projects?.overdue || 0, icon: Flame, color: "text-destructive" },
  ];

  const renderStatCard = (stat: any) => {
    const Icon = stat.icon;
    return (
      <div
        key={stat.label}
        className="relative overflow-hidden rounded-xl p-5
          bg-card border border-border
          shadow-sm hover:shadow-md
          transition-all duration-300 hover:-translate-y-0.5
          group cursor-pointer"
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground font-medium">{stat.label}</p>
            <p className={`text-3xl font-bold mt-1 ${stat.color}`}>{stat.value}</p>
          </div>
          <div className="p-2.5 rounded-lg bg-secondary/50 group-hover:bg-secondary transition-colors">
            <Icon className={`w-5 h-5 ${stat.color}`} />
          </div>
        </div>
        {/* Decorative gradient bar */}
        <div className="absolute bottom-0 left-0 right-0 h-0.5 gradient-coral opacity-0
          group-hover:opacity-100 transition-opacity duration-300" />
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <Tabs defaultValue="modules">
        {/* Page Title & Tab Switcher */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Welcome back, {session?.user?.name}! Here&apos;s your activity overview.
            </p>
          </div>
          
          <TabsList className="bg-transparent h-auto p-0 gap-2 mb-1">
            <TabsTrigger
              value="modules"
              className="glassmorphic-tab gap-2 rounded-full px-5 py-2 data-[state=active]:bg-white/60 dark:data-[state=active]:bg-white/10"
            >
              <Boxes className="w-4 h-4" />
              My Work
            </TabsTrigger>
            <TabsTrigger
              value="projects"
              className="glassmorphic-tab gap-2 rounded-full px-5 py-2 data-[state=active]:bg-white/60 dark:data-[state=active]:bg-white/10"
            >
              <FolderKanban className="w-4 h-4" />
              Projects
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Stats Cards Content */}
        <TabsContent value="modules" className="mt-0 outline-none">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {moduleStats.map(renderStatCard)}
          </div>
        </TabsContent>
        
        <TabsContent value="projects" className="mt-0 outline-none">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {projectStats.map(renderStatCard)}
          </div>
        </TabsContent>
      </Tabs>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Active Projects */}
        <ActiveProjectsList />

        {/* My Modules */}
        <div className="rounded-xl bg-card border border-border shadow-sm overflow-hidden flex flex-col">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h2 className="text-lg font-semibold">My Modules</h2>
          <Link href="/my-tasks" className="text-sm text-primary hover:text-primary/80 font-medium transition-colors">
            View all →
          </Link>
        </div>
        <div className="divide-y divide-border">
          {modulesLoading ? (
            <div className="p-8 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-stone-300" /></div>
          ) : !myModules || myModules.length === 0 ? (
            <div className="p-8 text-center text-sm text-stone-500">No modules assigned.</div>
          ) : (
            myModules.slice(0, 5).map((mod) => (
              <Link
                key={mod.id}
                href={`/modules/${mod.id}`}
                className="px-5 py-3.5 flex items-center gap-4 hover:bg-secondary/30 transition-colors cursor-pointer group"
              >
                <span className="text-xs font-mono text-muted-foreground w-20">{mod.id}</span>
                <span className="flex-1 text-sm font-medium group-hover:text-primary transition-colors">{mod.title}</span>
                <span
                  className={`text-xs font-medium px-2.5 py-1 rounded-full
                    ${mod.status === "done" ? "bg-[var(--color-success-light)] text-[var(--color-success)] dark:bg-[var(--color-success)]/20" : ""}
                    ${mod.status === "in_progress" ? "bg-[var(--color-info-light)] text-[var(--color-info)] dark:bg-[var(--color-info)]/20" : ""}
                    ${mod.status === "in_review" ? "bg-[var(--color-warning-light)] text-[var(--color-warning)] dark:bg-[var(--color-warning)]/20" : ""}
                    ${mod.status === "planned" ? "bg-secondary text-muted-foreground" : ""}
                  `}
                >
                  {mod.status.replace("_", " ")}
                </span>
                <span
                  className={`text-xs font-medium
                    ${mod.priority === "critical" ? "text-destructive" : ""}
                    ${mod.priority === "high" ? "text-[var(--color-accent-600)]" : ""}
                    ${mod.priority === "medium" ? "text-muted-foreground" : ""}
                    ${mod.priority === "low" ? "text-muted-foreground/60" : ""}
                  `}
                >
                  {mod.priority}
                </span>
                <span className="text-xs text-muted-foreground w-16">
                  {mod.deadline ? new Date(mod.deadline).toLocaleDateString() : 'N/A'}
                </span>
                <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </Link>
            ))
          )}
        </div>
      </div>
      </div>

      {/* Leaderboard Preview — Unified Ranked List */}
      <div className="rounded-xl bg-card border border-border shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Trophy className="w-5 h-5 text-[var(--color-accent-500)]" />
            Leaderboard
          </h2>
          <Link href="/leaderboard" className="text-sm text-primary hover:text-primary/80 font-medium transition-colors">
            Full board →
          </Link>
        </div>
        <div>
          {leaderboardLoading ? (
            <div className="py-12 flex justify-center">
              <Loader2 className="w-7 h-7 animate-spin text-muted-foreground" />
            </div>
          ) : !leaderboard || leaderboard.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">No points awarded yet.</div>
          ) : (
            leaderboard.slice(0, 10).map((user, index) => {
              const rank = index + 1;
              const isMe = user.userId === session?.user?.id;
              const maxPoints = leaderboard[0]?.totalPoints || 1;
              const progressPct = Math.min(100, (user.totalPoints / maxPoints) * 100);

              // Medal config for top 3
              const medalConfig: Record<number, { emoji: string; gradient: string; ring: string; tintClass: string }> = {
                1: { emoji: "🥇", gradient: "from-yellow-400 to-amber-500", ring: "ring-amber-300", tintClass: "bg-amber-50/50 dark:bg-amber-900/10" },
                2: { emoji: "🥈", gradient: "from-slate-300 to-slate-400", ring: "ring-slate-300", tintClass: "bg-slate-50/50 dark:bg-slate-700/10" },
                3: { emoji: "🥉", gradient: "from-orange-400 to-orange-600", ring: "ring-orange-300", tintClass: "bg-orange-50/50 dark:bg-orange-900/10" },
              };
              const medal = medalConfig[rank];

              return (
                <div
                  key={user.userId}
                  className={`flex items-center gap-3.5 px-5 py-3 border-b border-border/50 last:border-b-0
                    transition-colors duration-150 hover:bg-secondary/40
                    ${medal ? medal.tintClass : ""}
                    ${isMe ? "!bg-primary/5 border-l-2 !border-l-primary" : ""}
                  `}
                >
                  {/* Rank indicator */}
                  <div className="w-8 text-center shrink-0">
                    {medal ? (
                      <span className="text-xl">{medal.emoji}</span>
                    ) : (
                      <span className="text-sm font-bold text-muted-foreground">#{rank}</span>
                    )}
                  </div>

                  {/* Avatar */}
                  <Avatar className={`h-9 w-9 shrink-0 ${medal ? `ring-2 ${medal.ring}` : ""}`}>
                    <AvatarFallback
                      className={`text-sm font-bold ${
                        medal
                          ? `bg-gradient-to-br ${medal.gradient} text-white`
                          : "bg-gradient-to-br from-rose-400 to-amber-400 text-white"
                      }`}
                    >
                      {user.name?.charAt(0) || "?"}
                    </AvatarFallback>
                  </Avatar>

                  {/* Name + streak */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-medium truncate ${isMe ? "text-primary font-semibold" : ""}`}>
                        {user.name}
                        {isMe && <span className="text-xs text-primary/70 ml-1">(You)</span>}
                      </span>
                      {user.streak >= 3 && (
                        <span className="text-[10px] font-medium text-orange-500 dark:text-orange-400 flex items-center gap-0.5 shrink-0">
                          <Flame className="h-3 w-3" />{user.streak}d
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Points + progress bar */}
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="w-16 h-1.5 rounded-full bg-secondary overflow-hidden hidden sm:block">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${progressPct}%`, background: "linear-gradient(to right, var(--color-primary-400), var(--color-accent-400))" }}
                      />
                    </div>
                    <div className="flex items-center gap-1 min-w-[48px] justify-end">
                      <span className="text-sm font-bold">{user.totalPoints}</span>
                      <Zap className="h-3.5 w-3.5 text-[var(--color-accent-500)]" />
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
