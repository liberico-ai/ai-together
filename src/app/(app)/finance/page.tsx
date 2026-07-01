"use client";

import { useSession } from "@/lib/auth/client";
import { Wallet, ShieldAlert } from "lucide-react";
import { KpiCards } from "@/components/finance/kpi-cards";
import { RevenueChart } from "@/components/finance/revenue-chart";
import { BuProfitTable } from "@/components/finance/bu-profit-table";
import { SimulatePanel } from "@/components/finance/simulate-panel";
import { CostItemForm } from "@/components/finance/cost-item-form";
import { RevenueForm } from "@/components/finance/revenue-form";

/** Tháng hiện tại dạng "YYYY-MM" cho các query theo tháng. */
function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// Vai trò được xem trang Tài chính (Mục tiêu 3): chairman / bom (+ admin).
const ALLOWED_ROLES = ["chairman", "bom", "admin"];

export default function FinancePage() {
  const { data: session } = useSession();
  const month = currentMonth();

  const role = (session?.user as { role?: string } | undefined)?.role;
  // Nếu có role trên session thì kiểm tra; nếu chưa xác định thì vẫn render
  // (server-side procedures vẫn tự bảo vệ quyền ghi).
  const denied = role !== undefined && !ALLOWED_ROLES.includes(role);

  if (denied) {
    return (
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-col items-center justify-center h-[60vh] text-center gap-3">
          <div className="p-3 rounded-full bg-pink-100 dark:bg-pink-950/40">
            <ShieldAlert className="h-8 w-8 text-[#ec4899]" />
          </div>
          <h1 className="text-lg font-semibold text-foreground">
            Không có quyền truy cập
          </h1>
          <p className="text-sm text-muted-foreground max-w-sm">
            Trang Tài chính chỉ dành cho Chủ tịch (chairman) và Ban điều hành
            (BOM).
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2 text-foreground">
          <Wallet className="h-6 w-6 text-[#ec4899]" />
          Tài chính AI Tech
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Chi phí, doanh thu, cover ratio 24 tháng và mô phỏng charge BU. Mọi số
          tiền hiển thị theo triệu VND.
        </p>
      </div>

      {/* KPI tổng quan */}
      <KpiCards month={month} />

      {/* Doanh thu theo BU vs chi phí */}
      <RevenueChart month={month} />

      {/* Lãi/lỗ theo BU */}
      <BuProfitTable />

      {/* Mô phỏng 3 phương án A/B/C */}
      <SimulatePanel />

      {/* Nhập liệu chi phí & doanh thu (Mục tiêu 3) */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-foreground">Nhập liệu</h2>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <CostItemForm />
          <RevenueForm />
        </div>
      </section>
    </div>
  );
}
