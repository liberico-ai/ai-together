"use client";

import { trpc } from "@/lib/trpc/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Wallet,
  TrendingUp,
  Gauge,
  Scale,
} from "lucide-react";

/** Đèn health theo blueprint: green ≥1.05, yellow ≥1.0, red <1.0 */
export type Health = "green" | "yellow" | "red";

export function healthDot(health: Health) {
  const map: Record<Health, string> = {
    green: "bg-emerald-500",
    yellow: "bg-amber-400",
    red: "bg-rose-500",
  };
  return (
    <span
      className={`inline-block h-3 w-3 rounded-full ${map[health]} ring-2 ring-white/60 shadow-sm`}
      aria-hidden
    />
  );
}

/** Định dạng số triệu VND (router đã trả về đơn vị triệu). */
function fmtMil(v: number | undefined): string {
  if (v === undefined || v === null || Number.isNaN(v)) return "—";
  return new Intl.NumberFormat("vi-VN").format(v);
}

function KpiCard({
  title,
  value,
  unit,
  subtitle,
  icon: Icon,
  accent = false,
  trailing,
}: {
  title: string;
  value: string;
  unit?: string;
  subtitle?: string;
  icon: React.ElementType;
  accent?: boolean;
  trailing?: React.ReactNode;
}) {
  return (
    <Card size="sm" className="hover:ring-pink-400/40 transition-all">
      <CardHeader className="pb-0">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {title}
          </CardTitle>
          <div
            className={`p-2 rounded-lg ${
              accent ? "bg-[#ec4899]" : "bg-pink-100 dark:bg-pink-950/40"
            }`}
          >
            <Icon
              className={`h-4 w-4 ${
                accent ? "text-white" : "text-[#ec4899]"
              }`}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex items-end gap-2">
          <p className="text-2xl font-bold text-foreground leading-none">
            {value}
          </p>
          {unit && (
            <span className="text-xs text-muted-foreground mb-0.5">{unit}</span>
          )}
          {trailing}
        </div>
        {subtitle && (
          <p className="text-xs text-muted-foreground mt-2">{subtitle}</p>
        )}
      </CardContent>
    </Card>
  );
}

export function KpiCards({ month }: { month: string }) {
  const cover = trpc.finance.coverRatio.useQuery();
  const cost = trpc.finance.monthlyCost.useQuery();
  const revenue = trpc.finance.monthlyRevenue.useQuery({ month });

  const isLoading =
    cover.isLoading || cost.isLoading || revenue.isLoading;

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[110px] w-full rounded-xl" />
        ))}
      </div>
    );
  }

  const ratio = cover.data?.ratio ?? 0;
  const health = (cover.data?.health ?? "red") as Health;
  const diff = cover.data?.diff ?? 0;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <KpiCard
        title="Chi phí / tháng"
        value={fmtMil(cost.data?.total)}
        unit="tr VND"
        subtitle={`${cost.data?.byCategory.length ?? 0} nhóm chi phí`}
        icon={Wallet}
      />
      <KpiCard
        title="Doanh thu / tháng"
        value={fmtMil(revenue.data?.total)}
        unit="tr VND"
        subtitle={`Tháng ${revenue.data?.month ?? month} · ${
          revenue.data?.byBu.length ?? 0
        } BU`}
        icon={TrendingUp}
      />
      <KpiCard
        title="Cover ratio (24m)"
        value={ratio.toFixed(3)}
        subtitle={`Target ${cover.data?.target ?? 1.05} · ${
          cover.data?.monthsWithData ?? 0
        } tháng dữ liệu`}
        icon={Gauge}
        accent
        trailing={healthDot(health)}
      />
      <KpiCard
        title="Chênh lệch 24 tháng"
        value={`${diff >= 0 ? "+" : ""}${fmtMil(diff)}`}
        unit="tr VND"
        subtitle={diff >= 0 ? "Lãi dự phóng" : "Lỗ dự phóng"}
        icon={Scale}
      />
    </div>
  );
}
