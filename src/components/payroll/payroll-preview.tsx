"use client";

import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CheckCircle2, Loader2, Lock } from "lucide-react";

function fmt(v: number): string {
  return new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 }).format(v);
}

/** Màu composite: <0.85 đỏ, <1 vàng, ≥1 xanh. */
function compositeClass(c: number): string {
  if (c >= 1) return "text-emerald-600";
  if (c >= 0.85) return "text-amber-600";
  return "text-rose-500";
}

/**
 * Xem trước & chốt bảng lương theo kỳ KPI.
 * - Chọn kỳ → computePayroll (chỉ tính, không ghi DB).
 * - "Chốt bảng lương" → runPayroll (chairman-only phía server).
 * Đơn vị: triệu VND/tháng.
 */
export function PayrollPreview() {
  const { data: periods, isLoading: periodsLoading } =
    trpc.kpi.listPeriods.useQuery();
  const [periodId, setPeriodId] = useState<string>("");
  const [done, setDone] = useState<string | null>(null);

  // Chọn kỳ mới nhất mặc định khi tải xong.
  useEffect(() => {
    if (!periodId && periods && periods.length > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- chọn kỳ mặc định khi query xong (đồng bộ từ dữ liệu server)
      setPeriodId(periods[0].id);
    }
  }, [periods, periodId]);

  const { data: preview, isLoading: previewLoading } =
    trpc.payroll.computePayroll.useQuery(
      { periodId },
      { enabled: !!periodId }
    );

  const utils = trpc.useUtils();
  const runPayroll = trpc.payroll.runPayroll.useMutation({
    onSuccess: () => {
      utils.payroll.listRuns.invalidate();
      setDone("Đã chốt bảng lương cho kỳ này.");
    },
  });

  const totals = (preview ?? []).reduce(
    (acc, r) => ({
      floor: acc.floor + r.floorSalary,
      perf: acc.perf + r.perfSalary,
      total: acc.total + r.total,
    }),
    { floor: 0, perf: 0, total: 0 }
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold">
          Bảng lương theo kỳ
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Lương thực = Sàn (70%) + Hiệu suất (30%) × Composite. Đơn vị: triệu
          VND/tháng.
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5 min-w-[180px]">
            <Label className="text-xs text-muted-foreground">Kỳ KPI</Label>
            {periodsLoading ? (
              <Skeleton className="h-9 w-44 rounded-md" />
            ) : (
              <Select
                value={periodId}
                onValueChange={(v: string | null) => {
                  setPeriodId(v ?? "");
                  setDone(null);
                }}
              >
                <SelectTrigger className="w-44">
                  <SelectValue placeholder="Chọn kỳ">
                    {(periods ?? []).find((p) => p.id === periodId)?.quarter ??
                      "Chọn kỳ"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {(periods ?? []).map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.quarter}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <Button
            onClick={() => {
              setDone(null);
              runPayroll.mutate({ periodId });
            }}
            disabled={!periodId || runPayroll.isPending || previewLoading}
            className="bg-[#ec4899] hover:bg-[#db2777] text-white"
          >
            {runPayroll.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Lock className="h-4 w-4" />
            )}
            Chốt bảng lương
          </Button>

          {done && (
            <span className="flex items-center gap-1.5 text-xs text-emerald-600">
              <CheckCircle2 className="h-4 w-4" />
              {done}
            </span>
          )}
          {runPayroll.error && (
            <span className="text-xs text-rose-500">
              {runPayroll.error.message}
            </span>
          )}
        </div>

        {previewLoading ? (
          <Skeleton className="h-40 w-full rounded-lg" />
        ) : (preview?.length ?? 0) === 0 ? (
          <div className="flex items-center justify-center h-24 border-2 border-dashed border-border rounded-lg text-muted-foreground text-sm">
            Chưa có nhân sự nào được cấu hình lương.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nhân sự</TableHead>
                <TableHead className="text-right">Tổng lương</TableHead>
                <TableHead className="text-right">Composite</TableHead>
                <TableHead className="text-right">Sàn (70%)</TableHead>
                <TableHead className="text-right">HS (30%)</TableHead>
                <TableHead className="text-right">Thực nhận</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {preview!.map((r) => (
                <TableRow key={r.userId}>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {fmt(r.base)}
                  </TableCell>
                  <TableCell
                    className={`text-right tabular-nums font-semibold ${compositeClass(
                      r.composite
                    )}`}
                  >
                    {r.composite.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {fmt(r.floorSalary)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {fmt(r.perfSalary)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-bold text-[#ec4899]">
                    {fmt(r.total)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell className="font-semibold" colSpan={3}>
                  Tổng quỹ lương
                </TableCell>
                <TableCell className="text-right tabular-nums font-semibold">
                  {fmt(totals.floor)}
                </TableCell>
                <TableCell className="text-right tabular-nums font-semibold">
                  {fmt(totals.perf)}
                </TableCell>
                <TableCell className="text-right tabular-nums font-bold text-[#ec4899]">
                  {fmt(totals.total)}
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
