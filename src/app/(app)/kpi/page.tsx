"use client";

import { useEffect, useMemo, useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { useSession } from "@/lib/auth/client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Gauge, Loader2 } from "lucide-react";
import { KpiTable, type KpiRow } from "@/components/kpi/kpi-table";
import { CompositeRadar } from "@/components/kpi/composite-radar";
import { TargetEditor } from "@/components/kpi/target-editor";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

/**
 * Trang KPI Composite Score (Mục tiêu 2).
 * Composite = 0.35·Tempo + 0.25·Completion + 0.25·Quality + 0.15·AI Adoption.
 * - Chọn kỳ (listPeriods).
 * - Bảng điểm toàn kỳ (KpiTable) + radar 4 trục cho người đang chọn.
 * - Nút mở ScoreDialog để chairman/admin/bom (BU lead) chấm điểm.
 */

export default function KpiPage() {
  const { data: periods, isLoading: periodsLoading } =
    trpc.kpi.listPeriods.useQuery();

  const [periodId, setPeriodId] = useState<string>("");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const { data: session } = useSession();
  const role = (session?.user as { role?: string } | undefined)?.role;
  // Chairman/admin/bom (BU lead) được chấm → xem roster đầy đủ (kể cả chưa có điểm).
  const canScore = role === "chairman" || role === "admin" || role === "bom";

  // Mặc định chọn kỳ mới nhất (listPeriods đã sort quarter desc)
  useEffect(() => {
    if (!periodId && periods && periods.length > 0) {
      setPeriodId(periods[0].id);
    }
  }, [periods, periodId]);

  const { data: scores } = trpc.kpi.listScores.useQuery(
    { periodId },
    { enabled: !!periodId }
  );
  // Người chấm lấy roster đủ mọi thành viên (bomProcedure); người thường không gọi.
  const { data: targets } = trpc.kpi.listTargets.useQuery(
    { periodId },
    { enabled: !!periodId && canScore, retry: false }
  );

  // Merge roster: người chấm → mọi thành viên (từ targets) + điểm hiện có;
  // người thường → chỉ những người đã có điểm (listScores).
  const roster = useMemo<KpiRow[]>(() => {
    const scoreMap = new Map((scores ?? []).map((s) => [s.userId, s]));
    if (canScore && targets) {
      return targets.map((t) => {
        const s = scoreMap.get(t.userId);
        return {
          userId: t.userId,
          userName: t.userName,
          userImage: t.userImage,
          tempoScore: s?.tempoScore ?? null,
          completionScore: s?.completionScore ?? null,
          qualityScore: s?.qualityScore ?? null,
          aiScore: s?.aiScore ?? null,
          compositeScore: s?.compositeScore ?? null,
          note: s?.note ?? null,
          scored: !!s,
        };
      });
    }
    return (scores ?? []).map((s) => ({
      userId: s.userId,
      userName: s.userName,
      userImage: s.userImage,
      tempoScore: s.tempoScore,
      completionScore: s.completionScore,
      qualityScore: s.qualityScore,
      aiScore: s.aiScore,
      compositeScore: s.compositeScore,
      note: s.note,
      scored: true,
    }));
  }, [canScore, targets, scores]);

  // Người được chọn: mặc định người đầu roster
  useEffect(() => {
    if (roster.length > 0) {
      if (!selectedUserId || !roster.some((r) => r.userId === selectedUserId)) {
        setSelectedUserId(roster[0].userId);
      }
    } else {
      setSelectedUserId(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roster]);

  const selected = useMemo(
    () => roster.find((r) => r.userId === selectedUserId) ?? null,
    [roster, selectedUserId]
  );

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-foreground">
            <Gauge className="h-6 w-6 text-pink-500" />
            Năng suất — Composite Score
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Composite ={" "}
            <span className="font-medium text-foreground">
              0.35·T + 0.25·C + 0.25·Q + 0.15·AI
            </span>{" "}
            — Tempo &amp; Completion tính tự động, Quality &amp; AI do chairman /
            BU lead chấm.
          </p>
        </div>

        {/* Chọn kỳ */}
        <div className="flex items-center gap-2">
          {periodsLoading ? (
            <Loader2 className="h-5 w-5 animate-spin text-pink-500" />
          ) : periods && periods.length > 0 ? (
            <Select
              value={periodId}
              onValueChange={(v: string | null) => setPeriodId(v ?? "")}
            >
              <SelectTrigger className="min-w-[140px]">
                <SelectValue placeholder="Chọn kỳ">
                  {periods.find((p) => p.id === periodId)?.quarter ?? "Chọn kỳ"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {periods.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.quarter}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <span className="text-sm text-muted-foreground">
              Chưa có kỳ KPI nào.
            </span>
          )}
        </div>
      </div>

      {periodId ? (
        <Tabs defaultValue="scores" className="space-y-6">
          <TabsList className="flex w-auto justify-start gap-3 bg-transparent rounded-none !h-auto p-0">
            <TabsTrigger value="scores">Điểm</TabsTrigger>
            <TabsTrigger value="targets">Chỉ tiêu</TabsTrigger>
          </TabsList>

          <TabsContent value="scores">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
              {/* Bảng điểm */}
              <div className="min-w-0">
                <KpiTable
                  periodId={periodId}
                  rows={roster}
                  canScore={canScore}
                  selectedUserId={selectedUserId}
                  onSelectUser={setSelectedUserId}
                />
              </div>

              {/* Radar cho người được chọn */}
              <aside className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
                <h2 className="mb-1 text-sm font-semibold text-foreground">
                  {selected
                    ? `Radar — ${selected.userName ?? "Ẩn danh"}`
                    : "Radar 4 trục"}
                </h2>
                <p className="mb-2 text-xs text-muted-foreground">
                  So sánh với mức cam kết 1.0 trên mỗi trục.
                </p>
                {selected ? (
                  <>
                    <CompositeRadar
                      tempo={Number(selected.tempoScore ?? 0)}
                      completion={Number(selected.completionScore ?? 0)}
                      quality={Number(selected.qualityScore ?? 0)}
                      ai={Number(selected.aiScore ?? 0)}
                      commitment={1.0}
                    />
                    <div className="mt-2 flex items-center justify-between rounded-lg bg-pink-50 px-3 py-2 dark:bg-pink-500/10">
                      <span className="text-xs font-medium text-muted-foreground">
                        Composite
                      </span>
                      <span className="text-lg font-bold tabular-nums text-pink-600 dark:text-pink-400">
                        {Number(selected.compositeScore ?? 0).toFixed(2)}
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">
                    Chọn một thành viên để xem radar.
                  </div>
                )}
              </aside>
            </div>
          </TabsContent>

          <TabsContent value="targets">
            <TargetEditor periodId={periodId} />
          </TabsContent>
        </Tabs>
      ) : (
        !periodsLoading && (
          <div className="rounded-xl border border-dashed border-border py-16 text-center text-sm text-muted-foreground">
            Chưa có kỳ KPI. Tạo kỳ mới để bắt đầu chấm điểm.
          </div>
        )
      )}
    </div>
  );
}
