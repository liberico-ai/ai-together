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
import { Loader2, Plus, TrendingUp } from "lucide-react";

/**
 * Nhập liệu doanh thu theo BU (Mục tiêu 3) — gọi finance.manageBuRevenue.
 * - BU chọn từ businessUnits.list.
 * - month "YYYY-MM"; mechanism: revenue_share / subscription / build_24m.
 * - amountVnd nhập theo VND (đúng input procedure).
 * Bảng dưới hiển thị doanh thu theo BU của tháng đang chọn (triệu VND).
 */

const MECHANISM_OPTIONS = [
  { value: "revenue_share", label: "Chia doanh thu (revenue_share)" },
  { value: "subscription", label: "Thuê bao (subscription)" },
  { value: "build_24m", label: "Phí xây dựng 24 tháng (build_24m)" },
] as const;

type Mechanism = (typeof MECHANISM_OPTIONS)[number]["value"];

const vnd = new Intl.NumberFormat("vi-VN");

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function RevenueForm() {
  const utils = trpc.useUtils();

  const [month, setMonth] = useState<string>(currentMonth());
  const { data: bus } = trpc.businessUnits.list.useQuery();
  const { data: revenue, isLoading } = trpc.finance.monthlyRevenue.useQuery(
    { month },
    { enabled: !!month }
  );

  const [open, setOpen] = useState(false);
  const [buId, setBuId] = useState<string>("");
  const [mechanism, setMechanism] = useState<Mechanism>("subscription");
  const [amountVnd, setAmountVnd] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const manage = trpc.finance.manageBuRevenue.useMutation({
    onSuccess: () => {
      utils.finance.monthlyRevenue.invalidate({ month });
      utils.finance.coverRatio.invalidate();
      utils.finance.buProfit.invalidate();
      resetForm();
      setOpen(false);
    },
    onError: (err) => setError(err.message),
  });

  function resetForm() {
    setBuId("");
    setMechanism("subscription");
    setAmountVnd("");
    setNote("");
    setError(null);
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!buId) {
      setError("Vui lòng chọn BU.");
      return;
    }
    const amount = Number(amountVnd);
    if (!Number.isFinite(amount) || amount < 0 || !Number.isInteger(amount)) {
      setError("Số tiền phải là số nguyên VND ≥ 0.");
      return;
    }
    manage.mutate({
      buId,
      month,
      mechanism,
      amountVnd: amount,
      note: note.trim() || undefined,
    });
  };

  return (
    <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <TrendingUp className="h-4 w-4 text-[#ec4899]" />
            Doanh thu theo BU
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Nhập số tiền theo VND. Bảng tổng hiển thị theo triệu VND.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <Label htmlFor="rev-month" className="text-xs">
              Tháng
            </Label>
            <Input
              id="rev-month"
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="h-8 w-[150px]"
            />
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
              <Plus className="mr-1.5 h-4 w-4" /> Thêm doanh thu
            </DialogTrigger>
            <DialogContent className="sm:max-w-[460px]">
              <form onSubmit={handleSubmit}>
                <DialogHeader>
                  <DialogTitle>Thêm doanh thu</DialogTitle>
                  <DialogDescription>
                    Ghi nhận doanh thu 1 BU cho tháng {month}. Số tiền nhập theo
                    VND.
                  </DialogDescription>
                </DialogHeader>

                {error && (
                  <div className="mt-3 rounded-md border border-rose-200 bg-rose-50 p-2.5 text-sm text-rose-600 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-400">
                    {error}
                  </div>
                )}

                <div className="grid gap-4 py-4">
                  <div className="space-y-1.5">
                    <Label>Business Unit</Label>
                    <Select
                      value={buId}
                      onValueChange={(v: string | null) => setBuId(v ?? "")}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Chọn BU" />
                      </SelectTrigger>
                      <SelectContent>
                        {bus?.map((bu) => (
                          <SelectItem key={bu.id} value={bu.id}>
                            {bu.code} — {bu.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label>Cơ chế doanh thu</Label>
                    <Select
                      value={mechanism}
                      onValueChange={(v: string | null) =>
                        v && setMechanism(v as Mechanism)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Chọn cơ chế" />
                      </SelectTrigger>
                      <SelectContent>
                        {MECHANISM_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="rev-amount">Số tiền (VND)</Label>
                    <Input
                      id="rev-amount"
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
                    <Label htmlFor="rev-note">Ghi chú (tuỳ chọn)</Label>
                    <Textarea
                      id="rev-note"
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
                      "Lưu doanh thu"
                    )}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {isLoading ? (
        <div className="flex h-24 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-[#ec4899]" />
        </div>
      ) : revenue && revenue.byBu.length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>BU</TableHead>
              <TableHead className="text-right">
                Doanh thu (triệu VND)
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {revenue.byBu.map((row) => (
              <TableRow key={row.buId}>
                <TableCell>{row.buCode}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {vnd.format(row.amount)}
                </TableCell>
              </TableRow>
            ))}
            <TableRow className="font-semibold">
              <TableCell>Tổng doanh thu tháng {revenue.month}</TableCell>
              <TableCell className="text-right tabular-nums text-[#ec4899]">
                {vnd.format(revenue.total)}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      ) : (
        <p className="py-6 text-center text-sm text-muted-foreground">
          Chưa có doanh thu cho tháng {month}. Bấm &ldquo;Thêm doanh thu&rdquo;
          để bắt đầu.
        </p>
      )}
    </div>
  );
}
