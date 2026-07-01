"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Star } from "lucide-react";
import { ScoreDialog } from "@/components/kpi/score-dialog";

/**
 * Bảng điểm KPI toàn kỳ × 4 trục + composite.
 * Tô màu ô theo thang quy đổi:
 *   ≥ 1.1        → xanh lá  (vượt kỳ vọng)
 *   0.9 – 1.1    → xanh dương (đạt)
 *   0.7 – 0.9    → vàng     (cần cải thiện)
 *   < 0.7        → đỏ       (báo động)
 * Dữ liệu (roster) do trang /kpi truyền vào: đủ mọi thành viên khi người xem
 * được chấm (chairman/admin/bom), kể cả người CHƯA có điểm → vẫn chấm được.
 */

export type ScoreBand = "green" | "blue" | "yellow" | "red";

export function scoreBand(v: number | null | undefined): ScoreBand {
  const n = Number(v ?? 0);
  if (n >= 1.1) return "green";
  if (n >= 0.9) return "blue";
  if (n >= 0.7) return "yellow";
  return "red";
}

const BAND_CLASS: Record<ScoreBand, string> = {
  green:
    "text-emerald-700 bg-emerald-100 dark:text-emerald-300 dark:bg-emerald-500/15",
  blue: "text-blue-700 bg-blue-100 dark:text-blue-300 dark:bg-blue-500/15",
  yellow:
    "text-amber-700 bg-amber-100 dark:text-amber-300 dark:bg-amber-500/15",
  red: "text-rose-700 bg-rose-100 dark:text-rose-300 dark:bg-rose-500/15",
};

/** 1 dòng roster: có thể CHƯA có điểm (các trục = null). */
export interface KpiRow {
  userId: string;
  userName: string | null;
  userImage: string | null;
  tempoScore?: number | null;
  completionScore?: number | null;
  qualityScore?: number | null;
  aiScore?: number | null;
  compositeScore?: number | null;
  note?: string | null;
  /** true nếu người này đã được chấm trong kỳ */
  scored?: boolean;
}

function ScoreCell({ value }: { value: number | null | undefined }) {
  const band = scoreBand(value);
  return (
    <TableCell className="text-center">
      <span
        className={`inline-flex min-w-[3rem] justify-center rounded-md px-2 py-0.5 text-xs font-semibold tabular-nums ${
          value != null ? BAND_CLASS[band] : "text-muted-foreground"
        }`}
      >
        {value != null ? Number(value).toFixed(2) : "—"}
      </span>
    </TableCell>
  );
}

export interface KpiTableProps {
  periodId: string;
  rows: KpiRow[];
  /** người xem có quyền chấm (chairman/admin/bom) → hiện nút "Chấm điểm" mỗi dòng */
  canScore: boolean;
  /** id người đang được chọn để highlight */
  selectedUserId?: string | null;
  onSelectUser?: (userId: string) => void;
}

export function KpiTable({
  periodId,
  rows,
  canScore,
  selectedUserId,
  onSelectUser,
}: KpiTableProps) {
  if (!rows || rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border py-16 text-center text-sm text-muted-foreground">
        Chưa có thành viên nào cho kỳ này.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40">
            <TableHead className="w-10 text-center">#</TableHead>
            <TableHead>Thành viên</TableHead>
            <TableHead className="text-center">Tempo</TableHead>
            <TableHead className="text-center">Completion</TableHead>
            <TableHead className="text-center">Quality</TableHead>
            <TableHead className="text-center">AI</TableHead>
            <TableHead className="text-center">Composite</TableHead>
            {canScore && <TableHead className="text-right">Chấm</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r, idx) => {
            const isSelected = r.userId === selectedUserId;
            return (
              <TableRow
                key={r.userId}
                onClick={() => onSelectUser?.(r.userId)}
                className={`cursor-pointer ${
                  isSelected ? "bg-pink-50 dark:bg-pink-500/10" : ""
                }`}
                style={
                  isSelected
                    ? { borderLeft: "3px solid #ec4899" }
                    : { borderLeft: "3px solid transparent" }
                }
              >
                <TableCell className="text-center text-xs font-bold text-muted-foreground">
                  {idx + 1}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2.5">
                    <Avatar className="h-8 w-8 shrink-0">
                      {r.userImage ? (
                        <AvatarImage src={r.userImage} alt={r.userName ?? ""} />
                      ) : null}
                      <AvatarFallback className="bg-pink-100 text-xs font-bold text-pink-700 dark:bg-pink-500/20 dark:text-pink-300">
                        {r.userName?.charAt(0)?.toUpperCase() ?? "?"}
                      </AvatarFallback>
                    </Avatar>
                    <span className="truncate text-sm font-medium text-foreground">
                      {r.userName ?? "Ẩn danh"}
                    </span>
                  </div>
                </TableCell>
                <ScoreCell value={r.tempoScore} />
                <ScoreCell value={r.completionScore} />
                <ScoreCell value={r.qualityScore} />
                <ScoreCell value={r.aiScore} />
                <TableCell className="text-center">
                  <span
                    className={`inline-flex min-w-[3.25rem] justify-center rounded-md px-2 py-0.5 text-sm font-bold tabular-nums ${
                      r.compositeScore != null
                        ? BAND_CLASS[scoreBand(r.compositeScore)]
                        : "text-muted-foreground"
                    }`}
                  >
                    {r.compositeScore != null
                      ? Number(r.compositeScore).toFixed(2)
                      : "—"}
                  </span>
                </TableCell>
                {canScore && (
                  <TableCell
                    className="text-right"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ScoreDialog
                      periodId={periodId}
                      userId={r.userId}
                      userName={r.userName}
                      defaultQuality={r.qualityScore}
                      defaultAi={r.aiScore}
                      defaultNote={r.note}
                      trigger={
                        <Button
                          size="sm"
                          variant={r.scored ? "outline" : "default"}
                          className={
                            r.scored
                              ? ""
                              : "bg-pink-500 text-white hover:bg-pink-600"
                          }
                        >
                          <Star className="mr-1.5 h-3.5 w-3.5" />
                          {r.scored ? "Chấm lại" : "Chấm điểm"}
                        </Button>
                      }
                    />
                  </TableCell>
                )}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
