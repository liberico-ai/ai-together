"use client";

import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { useSession } from "@/lib/auth/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Check, Loader2, Target } from "lucide-react";

/**
 * Bảng chỉnh target 4 trục theo người trong 1 kỳ (Mục tiêu 2).
 * - Nguồn: kpi.listTargets (left-join mọi user; người chưa đặt → null).
 * - Lưu 1 dòng: kpi.upsertTarget (chairman-only phía server).
 * Trục: tempoTarget (IVP/kỳ), completionTarget, qualityTarget, aiTarget.
 */

type Draft = {
  tempoTarget: string;
  completionTarget: string;
  qualityTarget: string;
  aiTarget: string;
};

const num = (v: number | null | undefined, fallback: number): string =>
  v != null ? String(v) : String(fallback);

export function TargetEditor({ periodId }: { periodId: string }) {
  const { data: session } = useSession();
  const role = (session?.user as { role?: string } | undefined)?.role;
  // Chairman/admin/bom (BU lead) quản target; role chưa xác định -> vẫn render (server chặn).
  const canEdit =
    role === undefined ||
    role === "chairman" ||
    role === "admin" ||
    role === "bom";

  const utils = trpc.useUtils();
  const { data: targets, isLoading } = trpc.kpi.listTargets.useQuery(
    { periodId },
    { enabled: !!periodId && canEdit }
  );

  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [savingUserId, setSavingUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Đồng bộ draft khi dữ liệu tải xong / đổi kỳ.
  useEffect(() => {
    if (!targets) return;
    const next: Record<string, Draft> = {};
    for (const row of targets) {
      next[row.userId] = {
        tempoTarget: num(row.tempoTarget, 10),
        completionTarget: num(row.completionTarget, 0.9),
        qualityTarget: num(row.qualityTarget, 1),
        aiTarget: num(row.aiTarget, 1),
      };
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing loaded query data into local draft state on data/period change
    setDrafts(next);
  }, [targets]);

  const upsert = trpc.kpi.upsertTarget.useMutation({
    onSuccess: () => {
      utils.kpi.listTargets.invalidate({ periodId });
      utils.kpi.listScores.invalidate({ periodId });
      setSavingUserId(null);
    },
    onError: (err) => {
      setError(err.message);
      setSavingUserId(null);
    },
  });

  const setField = (userId: string, field: keyof Draft, value: string) => {
    setDrafts((prev) => ({
      ...prev,
      [userId]: { ...prev[userId], [field]: value },
    }));
  };

  const handleSave = (userId: string) => {
    setError(null);
    const d = drafts[userId];
    if (!d) return;
    const tempoTarget = Number(d.tempoTarget);
    const completionTarget = Number(d.completionTarget);
    const qualityTarget = Number(d.qualityTarget);
    const aiTarget = Number(d.aiTarget);
    if (
      [tempoTarget, completionTarget, qualityTarget, aiTarget].some(
        (n) => !Number.isFinite(n) || n <= 0
      )
    ) {
      setError("Mọi target phải là số dương.");
      return;
    }
    setSavingUserId(userId);
    upsert.mutate({
      userId,
      periodId,
      tempoTarget,
      completionTarget,
      qualityTarget,
      aiTarget,
    });
  };

  if (!canEdit) {
    return (
      <div className="rounded-xl border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
        Chỉ Chủ tịch (chairman) / admin / BU lead (bom) mới được quản lý chỉ tiêu KPI.
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
      <div className="mb-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Target className="h-4 w-4 text-pink-500" />
          Chỉ tiêu KPI theo người
        </h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Tempo target = IVP/kỳ (dùng để tính Tempo score). Completion / Quality
          / AI là ngưỡng cam kết mỗi trục.
        </p>
      </div>

      {error && (
        <div className="mb-3 rounded-md border border-rose-200 bg-rose-50 p-2.5 text-sm text-rose-600 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-400">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="flex h-24 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-pink-500" />
        </div>
      ) : targets && targets.length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Thành viên</TableHead>
              <TableHead className="w-[110px]">Tempo (IVP)</TableHead>
              <TableHead className="w-[110px]">Completion</TableHead>
              <TableHead className="w-[110px]">Quality</TableHead>
              <TableHead className="w-[110px]">AI</TableHead>
              <TableHead className="w-[90px] text-right">Lưu</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {targets.map((row) => {
              const d = drafts[row.userId];
              const isSaving = savingUserId === row.userId;
              return (
                <TableRow key={row.userId}>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium text-foreground">
                        {row.userName ?? "Ẩn danh"}
                      </span>
                      {row.targetId == null && (
                        <span className="text-[10px] text-amber-600 dark:text-amber-400">
                          Chưa đặt target
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min={0}
                      step="0.5"
                      value={d?.tempoTarget ?? ""}
                      onChange={(e) =>
                        setField(row.userId, "tempoTarget", e.target.value)
                      }
                      className="h-8"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min={0}
                      step="0.05"
                      value={d?.completionTarget ?? ""}
                      onChange={(e) =>
                        setField(
                          row.userId,
                          "completionTarget",
                          e.target.value
                        )
                      }
                      className="h-8"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min={0}
                      step="0.05"
                      value={d?.qualityTarget ?? ""}
                      onChange={(e) =>
                        setField(row.userId, "qualityTarget", e.target.value)
                      }
                      className="h-8"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min={0}
                      step="0.05"
                      value={d?.aiTarget ?? ""}
                      onChange={(e) =>
                        setField(row.userId, "aiTarget", e.target.value)
                      }
                      className="h-8"
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      onClick={() => handleSave(row.userId)}
                      disabled={isSaving}
                      className="bg-pink-500 text-white hover:bg-pink-600"
                    >
                      {isSaving ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Check className="h-4 w-4" />
                      )}
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      ) : (
        <p className="py-6 text-center text-sm text-muted-foreground">
          Chưa có người dùng nào để đặt chỉ tiêu.
        </p>
      )}
    </div>
  );
}
