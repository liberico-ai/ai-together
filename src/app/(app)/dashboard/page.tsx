import {
  LayoutDashboard,
  FolderKanban,
  ListTodo,
  Trophy,
  Flame,
} from "lucide-react";

const stats = [
  { label: "Tasks Assigned", value: "12", icon: ListTodo, color: "text-primary" },
  { label: "In Progress", value: "5", icon: LayoutDashboard, color: "text-[var(--color-accent-500)]" },
  { label: "Completed", value: "34", icon: FolderKanban, color: "text-[var(--color-success)]" },
  { label: "Overdue", value: "2", icon: Flame, color: "text-destructive" },
];

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Welcome back! Here&apos;s your activity overview.
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => {
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
        })}
      </div>

      {/* Recent Tasks */}
      <div className="rounded-xl bg-card border border-border shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h2 className="text-lg font-semibold">Recent Tasks</h2>
          <button className="text-sm text-primary hover:text-primary/80 font-medium transition-colors">
            View all →
          </button>
        </div>
        <div className="divide-y divide-border">
          {[
            { id: "TASK-042", title: "Authentication API Endpoint", status: "In Review", priority: "High", deadline: "Mar 20" },
            { id: "TASK-041", title: "Database Schema Migration", status: "Done", priority: "Critical", deadline: "Mar 18" },
            { id: "TASK-040", title: "Dashboard UI Components", status: "In Progress", priority: "Medium", deadline: "Mar 22" },
            { id: "TASK-039", title: "MinIO File Upload Setup", status: "Planned", priority: "Low", deadline: "Mar 25" },
          ].map((task) => (
            <div
              key={task.id}
              className="px-5 py-3.5 flex items-center gap-4 hover:bg-secondary/30 transition-colors cursor-pointer"
            >
              <span className="text-xs font-mono text-muted-foreground w-20">{task.id}</span>
              <span className="flex-1 text-sm font-medium">{task.title}</span>
              <span
                className={`text-xs font-medium px-2.5 py-1 rounded-full
                  ${task.status === "Done" ? "bg-[var(--color-success-light)] text-[var(--color-success)] dark:bg-[var(--color-success)]/20" : ""}
                  ${task.status === "In Progress" ? "bg-[var(--color-info-light)] text-[var(--color-info)] dark:bg-[var(--color-info)]/20" : ""}
                  ${task.status === "In Review" ? "bg-[var(--color-warning-light)] text-[var(--color-warning)] dark:bg-[var(--color-warning)]/20" : ""}
                  ${task.status === "Planned" ? "bg-secondary text-muted-foreground" : ""}
                `}
              >
                {task.status}
              </span>
              <span
                className={`text-xs font-medium
                  ${task.priority === "Critical" ? "text-destructive" : ""}
                  ${task.priority === "High" ? "text-[var(--color-accent-600)]" : ""}
                  ${task.priority === "Medium" ? "text-muted-foreground" : ""}
                  ${task.priority === "Low" ? "text-muted-foreground/60" : ""}
                `}
              >
                {task.priority}
              </span>
              <span className="text-xs text-muted-foreground w-16">{task.deadline}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Leaderboard Preview */}
      <div className="rounded-xl bg-card border border-border shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Trophy className="w-5 h-5 text-[var(--color-accent-500)]" />
            Leaderboard
          </h2>
          <button className="text-sm text-primary hover:text-primary/80 font-medium transition-colors">
            Full board →
          </button>
        </div>
        <div className="p-5">
          <div className="flex items-end justify-center gap-4 mb-6">
            {/* Podium */}
            {[
              { rank: 2, name: "Minh T.", pts: 1245, height: "h-20", gradient: "gradient-silver" },
              { rank: 1, name: "Linh N.", pts: 1410, height: "h-28", gradient: "gradient-gold" },
              { rank: 3, name: "An K.", pts: 1190, height: "h-16", gradient: "gradient-bronze" },
            ].map((user) => (
              <div key={user.rank} className="flex flex-col items-center gap-2">
                <div className="w-10 h-10 rounded-full gradient-coral flex items-center justify-center text-white text-sm font-bold">
                  {user.name.charAt(0)}
                </div>
                <span className="text-xs font-medium">{user.name}</span>
                <span className="text-xs text-muted-foreground">{user.pts} pts</span>
                <div className={`w-20 ${user.height} ${user.gradient} rounded-t-lg flex items-start justify-center pt-2`}>
                  <span className="text-white font-bold text-lg">#{user.rank}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
