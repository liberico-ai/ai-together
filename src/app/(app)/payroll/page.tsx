"use client";

import { useSession } from "@/lib/auth/client";
import { Banknote, ShieldAlert } from "lucide-react";
import { SalaryConfigTable } from "@/components/payroll/salary-config-table";
import { PayrollPreview } from "@/components/payroll/payroll-preview";

// Vai trò được xem trang Bảng lương (dữ liệu nhạy cảm): chairman / bom (+ admin).
const ALLOWED_ROLES = ["chairman", "bom", "admin"];

export default function PayrollPage() {
  const { data: session } = useSession();
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
            Trang Bảng lương chỉ dành cho Chủ tịch (chairman) và Ban điều hành
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
          <Banknote className="h-6 w-6 text-[#ec4899]" />
          Bảng lương
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Trả lương theo mô hình v7.2:{" "}
          <span className="font-medium text-foreground">
            Lương thực = Lương sàn (70%) + Lương hiệu suất (30%) × Composite
            Score
          </span>
          . Composite lấy từ điểm KPI của kỳ tương ứng (mặc định 1.0 nếu chưa
          chấm). Mọi số tiền theo triệu VND/tháng.
        </p>
      </div>

      {/* Cấu hình lương đề xuất theo người */}
      <SalaryConfigTable />

      {/* Xem trước & chốt bảng lương theo kỳ */}
      <PayrollPreview />
    </div>
  );
}
