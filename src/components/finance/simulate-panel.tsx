"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { healthDot, type Health } from "./kpi-cards";
import { Loader2, PlayCircle } from "lucide-react";

/** Tham số mô phỏng — khớp input của trpc.finance.simulate (VND). */
type SimInput = {
  ivpPrice: number;
  chargeMultiplier: number;
  xecaFixed: number;
  lbrcPercent: number;
  expectedIvp: number;
  lbrcNewProductRevenue: number;
};

const DEFAULTS: SimInput = {
  ivpPrice: 2_000_000,
  chargeMultiplier: 1,
  xecaFixed: 140_000_000,
  lbrcPercent: 0.05,
  expectedIvp: 600,
  lbrcNewProductRevenue: 2_820_000_000,
};

function fmt(v: number): string {
  return new Intl.NumberFormat("vi-VN").format(v);
}

function NumField({
  label,
  hint,
  value,
  step,
  onChange,
}: {
  label: string;
  hint?: string;
  value: number;
  step?: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">
        {label}
      </Label>
      <Input
        type="number"
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="focus-visible:ring-[#ec4899]/40"
      />
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function SimulatePanel() {
  // Giá trị form đang chỉnh
  const [form, setForm] = useState<SimInput>(DEFAULTS);
  // Giá trị đã "chạy" (dùng làm input cho query)
  const [applied, setApplied] = useState<SimInput>(DEFAULTS);

  const { data, isFetching, refetch } = trpc.finance.simulate.useQuery(applied, {
    // Chỉ chạy lại khi bấm nút / thay đổi applied
    refetchOnWindowFocus: false,
  });

  const set = (patch: Partial<SimInput>) =>
    setForm((f) => ({ ...f, ...patch }));

  const run = () => {
    setApplied(form);
    // Nếu applied không đổi vẫn refetch để chạy lại
    void refetch();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold">
          Mô phỏng cover ratio — 3 phương án A / B / C
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Nhập tham số charge BU rồi chạy để so sánh. Đơn vị tiền: VND đầu vào,
          kết quả triệu VND.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Form tham số */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <NumField
            label="Giá / IVP (VND)"
            hint="Đơn giá 1 IVP"
            value={form.ivpPrice}
            step={100_000}
            onChange={(v) => set({ ivpPrice: v })}
          />
          <NumField
            label="Hệ số charge (×)"
            hint="Nhân doanh thu phương án B"
            value={form.chargeMultiplier}
            step={0.05}
            onChange={(v) => set({ chargeMultiplier: v })}
          />
          <NumField
            label="XECA cố định (VND/tháng)"
            hint="Subscription cố định"
            value={form.xecaFixed}
            step={1_000_000}
            onChange={(v) => set({ xecaFixed: v })}
          />
          <NumField
            label="LBRC % doanh thu"
            hint="Tỉ lệ revenue-share (0–1)"
            value={form.lbrcPercent}
            step={0.01}
            onChange={(v) => set({ lbrcPercent: v })}
          />
          <NumField
            label="IVP dự kiến (IBSHI)"
            hint="Số IVP/tháng"
            value={form.expectedIvp}
            step={10}
            onChange={(v) => set({ expectedIvp: v })}
          />
          <NumField
            label="DT sản phẩm mới (VND/tháng)"
            hint="Cơ sở tính LBRC %"
            value={form.lbrcNewProductRevenue}
            step={10_000_000}
            onChange={(v) => set({ lbrcNewProductRevenue: v })}
          />
        </div>

        <div className="flex items-center gap-3">
          <Button
            onClick={run}
            disabled={isFetching}
            className="bg-[#ec4899] hover:bg-[#db2777] text-white"
          >
            {isFetching ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <PlayCircle className="h-4 w-4" />
            )}
            Chạy mô phỏng
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setForm(DEFAULTS);
              setApplied(DEFAULTS);
            }}
            disabled={isFetching}
          >
            Reset
          </Button>
          {data && (
            <span className="text-xs text-muted-foreground ml-auto">
              Chi phí/tháng: {fmt(data.costMonth)} tr · Target {data.target}
            </span>
          )}
        </div>

        {/* Bảng kết quả 3 phương án */}
        {isFetching && !data ? (
          <Skeleton className="h-40 w-full rounded-lg" />
        ) : data ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>PA</TableHead>
                <TableHead>Mô tả</TableHead>
                <TableHead className="text-right">DT/tháng</TableHead>
                <TableHead className="text-right">DT 24m</TableHead>
                <TableHead className="text-right">Chi phí 24m</TableHead>
                <TableHead className="text-right">Chênh lệch</TableHead>
                <TableHead className="text-right">Cover</TableHead>
                <TableHead className="text-center">Health</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.scenarios.map((s) => (
                <TableRow key={s.key}>
                  <TableCell className="font-bold text-[#ec4899]">
                    {s.key}
                  </TableCell>
                  <TableCell className="max-w-[220px] whitespace-normal text-xs text-muted-foreground">
                    {s.label}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {fmt(s.revMonth)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {fmt(s.rev24)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {fmt(s.cost24)}
                  </TableCell>
                  <TableCell
                    className={`text-right tabular-nums font-medium ${
                      s.diff >= 0 ? "text-emerald-600" : "text-rose-500"
                    }`}
                  >
                    {s.diff >= 0 ? "+" : ""}
                    {fmt(s.diff)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-semibold">
                    {s.ratio.toFixed(3)}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-center">
                      {healthDot(s.health as Health)}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : null}
      </CardContent>
    </Card>
  );
}
