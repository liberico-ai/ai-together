"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Clock, ListTodo } from "lucide-react";

export interface BuStatusCardProps {
  code: string;
  name: string;
  progressPct: number;
  openTasks: number;
  overdue: number;
  blockers: number;
  staleBlockers: number;
  health: "green" | "yellow" | "red";
  lead?: { id: string; name: string | null; image?: string | null } | null;
}

const HEALTH_CONFIG: Record<
  BuStatusCardProps["health"],
  { dot: string; ring: string; label: string; bar: string }
> = {
  green: {
    dot: "bg-emerald-500",
    ring: "ring-emerald-500/20",
    label: "Healthy",
    bar: "bg-emerald-500",
  },
  yellow: {
    dot: "bg-amber-500",
    ring: "ring-amber-500/20",
    label: "At Risk",
    bar: "bg-amber-500",
  },
  red: {
    dot: "bg-rose-500",
    ring: "ring-rose-500/20",
    label: "Critical",
    bar: "bg-rose-500",
  },
};

export function BuStatusCard({
  code,
  name,
  progressPct,
  openTasks,
  overdue,
  blockers,
  staleBlockers,
  health,
  lead,
}: BuStatusCardProps) {
  const cfg = HEALTH_CONFIG[health];

  return (
    <Card className={`ring-1 ${cfg.ring} transition-all hover:shadow-md`}>
      <CardHeader className="border-b pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Badge className="bg-pink-500 text-white font-mono text-[11px]">
                {code}
              </Badge>
              <span
                className={`h-2.5 w-2.5 rounded-full shrink-0 ${cfg.dot}`}
                title={cfg.label}
              />
            </div>
            <h3 className="mt-1.5 truncate text-sm font-semibold text-foreground">
              {name}
            </h3>
            {lead?.name && (
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                Lead: {lead.name}
              </p>
            )}
          </div>
          <span className="text-2xl font-bold tabular-nums text-pink-600 dark:text-pink-400">
            {progressPct}%
          </span>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Progress bar (theo IVP) */}
        <div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full rounded-full transition-all ${cfg.bar}`}
              style={{ width: `${Math.min(progressPct, 100)}%` }}
            />
          </div>
        </div>

        {/* Badges: open / overdue / blockers */}
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="gap-1 text-[11px]">
            <ListTodo className="h-3 w-3" />
            {openTasks} open
          </Badge>

          {overdue > 0 && (
            <Badge className="gap-1 bg-rose-100 text-rose-700 text-[11px] dark:bg-rose-900/30 dark:text-rose-400">
              <Clock className="h-3 w-3" />
              {overdue} overdue
            </Badge>
          )}

          {blockers > 0 && (
            <Badge
              className={`gap-1 text-[11px] ${
                staleBlockers > 0
                  ? "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400"
                  : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
              }`}
            >
              <AlertTriangle className="h-3 w-3" />
              {blockers} blocker{blockers > 1 ? "s" : ""}
              {staleBlockers > 0 && ` (${staleBlockers} stale)`}
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
