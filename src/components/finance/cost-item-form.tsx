"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, Plus, Receipt } from "lucide-react";

/**
 * Nhập liệu chi phí (Mục tiêu 3) — gọi finance.manageCostItem.
 * - Category: salary / infra / license / office.
 * - amountVnd nhập theo VND (đúng input procedure).
 * - Bảng dưới hiển thị tổng theo category từ finance.monthlyCost (triệu VND).
 */

const CATEGORY_OPTIONS = [
  { value: "salary", label: "Lương (salary)" },
  { value: "infra", label: "Hạ tầng (infra)" },
  { value: "license", label: "Bản quyền (license)" },
  { value: "office", label: "Văn phòng (office)" },
] as const;

type Category = (typeof CATEGORY_OPTIONS)[number]["value"];

const CATEGORY_LABEL: Record<Category, string> = {
  salary: "Lương",
  infra: "Hạ tầng",
  license: "Bản quyền",
  office: "Văn phòng",
};

const vnd = new Intl.NumberFormat("vi-VN");

export function CostItemForm() {
  const utils = trpc.useUtils();
  const { data: cost, isLoading } = trpc.finance.monthlyCost.useQuery();

  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<Category>("salary");
  const [vendor, setVendor] = useState("");
  const [amountVnd, setAmountVnd] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const manage = trpc.finance.manageCostItem.useMutation({
    onSuccess: () => {
      utils.finance.monthlyCost.invalidate();
      utils.finance.coverRatio.invalidate();
      utils.finance.buProfit.invalidate();
      resetForm();
      setOpen(false);
    },
    onError: (err) => setError(err.message),
  });

  function resetForm() {
    setCategory("salary");
    setVendor("");
    setAmountVnd("");
    setNote("");
    setError(null);
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const amount = Number(amountVnd);
    if (!Number.isFinite(amount) || amount < 0 || !Number.isInteger(amount)) {
      setError("Số tiền phải là số nguyên VND ≥ 0.");
      return;
    }
    manage.mutate({
      category,
      vendor: vendor.trim() || undefined,
      amountVnd: amount,
      note: note.trim() || undefined,
    });
  };

  return (
    <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Receipt className="h-4 w-4 text-[#ec4899]" />
            Chi phí hằng tháng
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Nhập số tiền theo VND. Bảng tổng hiển thị theo triệu VND.
          </p>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger
            render={
              <Button
                size="sm"
                className="bg-[#ec4899] text-white hover:bg-pink-600"
              />
            }
          >
            <Plus className="mr-1.5 h-4 w-4" /> Thêm chi phí
          </DialogTrigger>
          <DialogContent className="sm:max-w-[460px]">
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle>Thêm chi phí</DialogTitle>
                <DialogDescription>
                  Ghi nhận 1 mục chi phí/tháng. Số tiền nhập theo VND.
                </DialogDescription>
              </DialogHeader>

              {error && (
                <div className="mt-3 rounded-md border border-rose-200 bg-rose-50 p-2.5 text-sm text-rose-600 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-400">
                  {error}
                </div>
              )}

              <div className="grid gap-4 py-4">
                <div className="space-y-1.5">
                  <Label>Loại chi phí</Label>
                  <Select
                    value={category}
                    onValueChange={(v: string | null) =>
                      v && setCategory(v as Category)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Chọn loại" />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORY_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="cost-vendor">Nhà cung cấp (tuỳ chọn)</Label>
                  <Input
                    id="cost-vendor"
                    value={vendor}
                    onChange={(e) => setVendor(e.target.value)}
                    placeholder="VD: AWS, Google Workspace..."
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="cost-amount">Số tiền (VND)</Label>
                  <Input
                    id="cost-amount"
                    type="number"
                    min={0}
                    step={1}
                    value={amountVnd}
                    onChange={(e) => setAmountVnd(e.target.value)}
                    placeholder="VD: 140000000"
                    required
                  />
                  {amountVnd && Number.isFinite(Number(amountVnd)) && (
                    <p className="text-[11px] text-muted-foreground">
                      = {vnd.format(Number(amountVnd))} VND
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="cost-note">Ghi chú (tuỳ chọn)</Label>
                  <Textarea
                    id="cost-note"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={2}
                    placeholder="Diễn giải..."
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setOpen(false)}
                >
                  Huỷ
                </Button>
                <Button
                  type="submit"
                  disabled={manage.isPending}
                  className="bg-[#ec4899] text-white hover:bg-pink-600"
                >
                  {manage.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Đang
                      lưu...
                    </>
                  ) : (
                    "Lưu chi phí"
                  )}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex h-24 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-[#ec4899]" />
        </div>
      ) : cost && cost.byCategory.length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Loại</TableHead>
              <TableHead className="text-right">Tổng (triệu VND)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {cost.byCategory.map((row) => (
              <TableRow key={row.category}>
                <TableCell>
                  {CATEGORY_LABEL[row.category as Category] ?? row.category}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {vnd.format(row.amount)}
                </TableCell>
              </TableRow>
            ))}
            <TableRow className="font-semibold">
              <TableCell>Tổng chi phí/tháng</TableCell>
              <TableCell className="text-right tabular-nums text-[#ec4899]">
                {vnd.format(cost.total)}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      ) : (
        <p className="py-6 text-center text-sm text-muted-foreground">
          Chưa có chi phí nào. Bấm &ldquo;Thêm chi phí&rdquo; để bắt đầu.
        </p>
      )}
    </div>
  );
}
