"use client";

import { trpc } from "@/lib/trpc/client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, ShieldAlert } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";

export function BlockerList() {
  const { data: blockers, isLoading } = trpc.businessUnits.blockers.useQuery();

  if (isLoading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-pink-500" />
      </div>
    );
  }

  if (!blockers || blockers.length === 0) {
    return (
      <EmptyState
        title="No blockers"
        description="Nothing is blocked right now. Great job keeping things moving."
        icon={ShieldAlert}
      />
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40">
            <TableHead>Task</TableHead>
            <TableHead>BU</TableHead>
            <TableHead>Assignee</TableHead>
            <TableHead>Reason</TableHead>
            <TableHead>Waiting on</TableHead>
            <TableHead className="text-right">Days</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {blockers.map((b) => {
            const isStale = b.daysBlocked > 3;
            return (
              <TableRow key={b.id}>
                <TableCell className="max-w-[220px]">
                  <span className="block truncate font-medium text-foreground">
                    {b.title}
                  </span>
                  <span className="block truncate font-mono text-[11px] text-muted-foreground">
                    {b.id}
                  </span>
                </TableCell>
                <TableCell>
                  {b.bu?.code ? (
                    <Badge
                      variant="secondary"
                      className="font-mono text-[11px]"
                    >
                      {b.bu.code}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground">&mdash;</span>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {b.assignee?.name ?? "—"}
                </TableCell>
                <TableCell className="max-w-[240px]">
                  <span className="block truncate" title={b.blockedReason ?? ""}>
                    {b.blockedReason ?? "—"}
                  </span>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {b.blockedBy ?? "—"}
                </TableCell>
                <TableCell className="text-right">
                  <span
                    className={`font-semibold tabular-nums ${
                      isStale
                        ? "text-rose-600 dark:text-rose-400"
                        : "text-foreground"
                    }`}
                  >
                    {b.daysBlocked}d
                  </span>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
