"use client";

import { trpc } from "@/lib/trpc/client";
import { Loader2, Target, Users, Calendar, ArrowRight } from "lucide-react";
import Link from "next/link";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { format } from "date-fns";

export function ActiveProjectsList() {
  const { data: projects, isLoading } = trpc.dashboard.getActiveProjects.useQuery();

  if (isLoading) {
    return (
      <div className="rounded-xl bg-card border border-border shadow-sm overflow-hidden flex-1 flex items-center justify-center p-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!projects || projects.length === 0) {
    return (
      <div className="rounded-xl bg-card border border-border shadow-sm overflow-hidden flex-1">
        <div className="px-5 py-4 border-b border-border flex items-center gap-2">
          <Target className="w-5 h-5 text-emerald-500" />
          <h2 className="text-lg font-semibold">Active Projects</h2>
        </div>
        <div className="p-12 text-center text-sm text-muted-foreground flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center border border-border">
            <Target className="w-6 h-6 text-muted-foreground/50" />
          </div>
          <p>No active projects currently.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-card border border-border shadow-sm overflow-hidden flex-1 flex flex-col">
      <div className="px-5 py-4 border-b border-border flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Target className="w-5 h-5 text-emerald-500" />
          Active Projects
        </h2>
        <Link href="/projects" className="text-sm text-primary hover:text-primary/80 font-medium transition-colors">
          View all →
        </Link>
      </div>

      <div className="divide-y divide-border">
        {projects.map((project) => {
          // Status color logic matching project pages
          const isWarning = project.progressPct < 30; // Just some visual flair
          const progressGradient = isWarning
            ? "bg-gradient-to-r from-amber-400 to-amber-500"
            : "bg-gradient-to-r from-emerald-400 to-emerald-500";

          return (
            <Link
              href={`/projects/${project.id}`}
              key={project.id}
              className="block p-5 hover:bg-secondary/30 transition-all duration-200 group relative overflow-hidden"
            >
              {/* Subtle hover background glow */}
              <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

              <div className="relative flex flex-col gap-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 border-b-0">
                      <h3 className="font-semibold text-stone-900 dark:text-stone-100 group-hover:text-primary transition-colors">
                        {project.title}
                      </h3>
                      <span className="text-[10px] uppercase tracking-wider font-semibold text-emerald-600 bg-emerald-100 dark:text-emerald-400 dark:bg-emerald-500/10 px-2 py-0.5 rounded-full">
                        {project.status.replace("_", " ")}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="font-mono">{project.id}</span>
                      {project.deadline && (
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {format(new Date(project.deadline), "MMM d, yyyy")}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Team Members */}
                  <div className="flex -space-x-2 shrink-0">
                    {project.members.slice(0, 3).map((member, i) => (
                      <Avatar key={member.id} className="w-7 h-7 border-2 border-card shadow-sm">
                        <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-medium">
                          {member.name.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                    ))}
                    {project.members.length > 3 && (
                      <div className="w-7 h-7 rounded-full bg-secondary border-2 border-card flex items-center justify-center text-[10px] font-medium text-muted-foreground z-10">
                        +{project.members.length - 3}
                      </div>
                    )}
                  </div>
                </div>

                {/* Progress Bar Area */}
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden relative">
                    <div
                      className={`absolute top-0 left-0 h-full rounded-full transition-all duration-1000 ease-out ${progressGradient}`}
                      style={{ width: `${project.progressPct}%` }}
                    />
                  </div>
                  <span className={`text-xs font-bold w-10 text-right ${isWarning ? 'text-amber-500' : 'text-emerald-500'}`}>
                    {project.progressPct}%
                  </span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
