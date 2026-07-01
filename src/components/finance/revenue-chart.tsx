"use client";

import { trpc } from "@/lib/trpc/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { useTheme } from "next-themes";

/**
 * Bar chart: Doanh thu theo BU (từ monthlyRevenue.byBu) so với chi phí/tháng
 * được phân bổ đều theo BU (đường ngưỡng chi phí trung bình / BU).
 * Mọi số ở đơn vị triệu VND theo router.
 */
export function RevenueChart({ month }: { month: string }) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const revenue = trpc.finance.monthlyRevenue.useQuery({ month });
  const cost = trpc.finance.monthlyCost.useQuery();

  const isLoading = revenue.isLoading || cost.isLoading;

  const grid = isDark ? "#44403c" : "#f1e5ec";
  const tick = isDark ? "#a8a29e" : "#78716c";
  const tooltipBg = isDark ? "#292524" : "#ffffff";
  const tooltipBorder = isDark ? "#44403c" : "#f9a8d4";

  const byBu = revenue.data?.byBu ?? [];
  const buCount = Math.max(byBu.length, 1);
  const costPerBu = Math.round((cost.data?.total ?? 0) / buCount);

  const data = byBu.map((r) => ({
    buCode: r.buCode,
    revenue: r.amount,
    cost: costPerBu,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold">
          Doanh thu theo BU vs chi phí phân bổ
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Đơn vị: triệu VND · Chi phí phân bổ đều {costPerBu} tr/BU · Tháng{" "}
          {revenue.data?.month ?? month}
        </p>
      </CardHeader>
      <CardContent>
        <div className="h-[320px] w-full">
          {isLoading ? (
            <Skeleton className="h-full w-full rounded-lg" />
          ) : data.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data}
                margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
                barGap={6}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke={grid}
                />
                <XAxis
                  dataKey="buCode"
                  tick={{ fontSize: 12, fill: tick }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 12, fill: tick }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  cursor={{ fill: "rgba(236,72,153,0.06)" }}
                  contentStyle={{
                    borderRadius: "8px",
                    border: `1px solid ${tooltipBorder}`,
                    backgroundColor: tooltipBg,
                    color: isDark ? "#fce7f3" : "#1c1917",
                    boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                  }}
                  formatter={(v) => [`${Number(v)} tr VND`]}
                />
                <Legend
                  iconType="circle"
                  wrapperStyle={{ fontSize: 13, paddingTop: "10px" }}
                />
                <Bar
                  dataKey="revenue"
                  name="Doanh thu"
                  fill="#ec4899"
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey="cost"
                  name="Chi phí phân bổ"
                  fill="#f9a8d4"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-full border-2 border-dashed border-border rounded-lg text-muted-foreground text-sm">
              Chưa có dữ liệu doanh thu cho tháng {month}.
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
