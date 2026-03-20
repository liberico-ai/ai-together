"use client";

import { trpc } from "@/lib/trpc/client";
import { Badge } from "@/components/ui/badge";
import { Loader2, Calendar, Target, ChevronRight } from "lucide-react";
import Link from "next/link";
import { CreateModuleDialog } from "./create-module-dialog";
import { format } from "date-fns";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const STATUS_CONFIG: Record<string, { label: string; dotColor: string; className: string }> = {
  planned: { label: "Planned", dotColor: "bg-stone-400", className: "text-stone-600 dark:text-stone-400" },
  in_progress: { label: "In Progress", dotColor: "bg-blue-500", className: "text-blue-600 dark:text-blue-400" },
  in_review: { label: "In Review", dotColor: "bg-amber-500", className: "text-amber-600 dark:text-amber-400" },
  changes_requested: { label: "Needs Changes", dotColor: "bg-rose-500", className: "text-rose-600 dark:text-rose-400" },
  done: { label: "Done", dotColor: "bg-emerald-500", className: "text-emerald-600 dark:text-emerald-400" },
};

export function ModuleList({ projectId }: { projectId: string }) {
  const { data: modules, isLoading, error } = trpc.modules.listByProject.useQuery({ projectId });

  if (isLoading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-coral-500" />
      </div>
    );
  }

  if (error) {
    return <div className="text-red-500 p-4">Error loading modules.</div>;
  }

  if (!modules || modules.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-stone-200 dark:border-stone-800 rounded-lg bg-white/50 dark:bg-stone-900/50">
        <Target className="h-12 w-12 text-stone-300 dark:text-stone-600 mb-4" />
        <h3 className="text-lg font-medium">No Modules Yet</h3>
        <p className="text-sm text-stone-500 mb-4 text-center max-w-sm">
          Break down your project into manageable modules, phases, or epics.
        </p>
        <CreateModuleDialog projectId={projectId} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center bg-white/40 dark:bg-stone-900/40 p-4 rounded-lg border border-stone-200 dark:border-stone-800">
        <div>
          <h3 className="font-semibold text-stone-800 dark:text-stone-200">Modules ({modules.length})</h3>
          <p className="text-sm text-stone-500">Track structural components of this project.</p>
        </div>
        <CreateModuleDialog projectId={projectId} />
      </div>

      <div className="rounded-xl border border-stone-200 dark:border-stone-800 overflow-hidden">
        {/* Table Header */}
        <div className="grid grid-cols-[1fr_140px_140px_140px_40px] gap-4 px-5 py-3 bg-muted/40 border-b border-stone-200 dark:border-stone-800 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <span>Module</span>
          <span>Status</span>
          <span>Assignee</span>
          <span>Deadline</span>
          <span />
        </div>

        {/* Table Rows */}
        {modules.map((mod) => {
          const sCfg = STATUS_CONFIG[mod.status] ?? STATUS_CONFIG.planned;
          return (
            <Link
              key={mod.id}
              href={`/modules/${mod.id}`}
              className="grid grid-cols-[1fr_140px_140px_140px_40px] gap-4 px-5 py-4 items-center border-b last:border-b-0 border-stone-100 dark:border-stone-800 hover:bg-muted/30 transition-colors group cursor-pointer"
            >
              {/* Module info */}
              <div className="min-w-0">
                <div className="font-semibold text-sm text-stone-900 dark:text-stone-100 group-hover:text-primary transition-colors truncate">
                  {mod.title}
                </div>
                <div className="text-xs text-muted-foreground font-mono">{mod.id}</div>
              </div>

              {/* Status */}
              <div className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full shrink-0 ${sCfg.dotColor}`} />
                <span className={`text-xs font-medium ${sCfg.className}`}>{sCfg.label}</span>
              </div>

              {/* Assignee */}
              <div>
                {mod.assignee ? (
                  <div className="flex items-center gap-2">
                    <Avatar className="h-5 w-5">
                      <AvatarFallback className="text-[9px] bg-stone-100 dark:bg-stone-800">
                        {mod.assignee.name?.charAt(0) || "?"}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-xs text-muted-foreground truncate">{mod.assignee.name}</span>
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
              </div>

              {/* Deadline */}
              <div className="text-xs text-muted-foreground">
                {mod.deadline ? (
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {format(new Date(mod.deadline), "MMM d, yyyy")}
                  </span>
                ) : (
                  "—"
                )}
              </div>

              {/* Arrow */}
              <div className="flex justify-center">
                <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
