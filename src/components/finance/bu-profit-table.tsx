"use client";

import { trpc } from "@/lib/trpc/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function fmt(v: number): string {
  return new Intl.NumberFormat("vi-VN").format(v);
}

/** Bảng lãi/lỗ theo BU từ trpc.finance.buProfit (đơn vị triệu VND). */
export function BuProfitTable() {
  const { data, isLoading } = trpc.finance.buProfit.useQuery();

  const totals = (data ?? []).reduce(
    (acc, row) => ({
      revenue: acc.revenue + row.revenue,
      cost: acc.cost + row.cost,
      profit: acc.profit + row.profit,
    }),
    { revenue: 0, cost: 0, profit: 0 }
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold">
          Lãi / lỗ theo Business Unit
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Đơn vị: triệu VND · Chi phí chung phân bổ theo tỉ trọng doanh thu
        </p>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full rounded-md" />
            ))}
          </div>
        ) : (data?.length ?? 0) === 0 ? (
          <div className="flex items-center justify-center h-24 border-2 border-dashed border-border rounded-lg text-muted-foreground text-sm">
            Chưa có Business Unit nào.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>BU</TableHead>
                <TableHead className="text-right">Doanh thu</TableHead>
                <TableHead className="text-right">Chi phí</TableHead>
                <TableHead className="text-right">Lãi / lỗ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data!.map((row) => {
                const positive = row.profit >= 0;
                return (
                  <TableRow key={row.buCode}>
                    <TableCell className="font-medium">{row.buCode}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {fmt(row.revenue)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {fmt(row.cost)}
                    </TableCell>
                    <TableCell
                      className={`text-right tabular-nums font-semibold ${
                        positive ? "text-emerald-600" : "text-rose-500"
                      }`}
                    >
                      {positive ? "+" : ""}
                      {fmt(row.profit)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell className="font-semibold">Tổng</TableCell>
                <TableCell className="text-right tabular-nums font-semibold">
                  {fmt(totals.revenue)}
                </TableCell>
                <TableCell className="text-right tabular-nums font-semibold">
                  {fmt(totals.cost)}
                </TableCell>
                <TableCell
                  className={`text-right tabular-nums font-bold ${
                    totals.profit >= 0 ? "text-emerald-600" : "text-rose-500"
                  }`}
                >
                  {totals.profit >= 0 ? "+" : ""}
                  {fmt(totals.profit)}
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
