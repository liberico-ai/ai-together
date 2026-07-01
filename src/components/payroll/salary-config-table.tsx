"use client";

import { useEffect, useMemo, useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, Pencil, Plus, UserCog } from "lucide-react";

function fmt(v: number): string {
  return new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 }).format(v);
}

interface EditTarget {
  userId: string;
  userName: string;
  baseSalary: number;
  floorPct: number;
  perfPct: number;
}

/**
 * Bảng cấu hình lương đề xuất theo người + dialog chỉnh/thêm.
 * Ghi qua trpc.payroll.upsertSalaryConfig (chairman-only phía server).
 * Đơn vị: triệu VND/tháng.
 */
export function SalaryConfigTable() {
  const { data, isLoading } = trpc.payroll.listSalaryConfigs.useQuery();
  const [edit, setEdit] = useState<EditTarget | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <UserCog className="h-4 w-4 text-[#ec4899]" />
            Cấu hình lương đề xuất
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Tổng lương/tháng (triệu VND) chia sàn {"70%"} + hiệu suất {"30%"}.
          </p>
        </div>
        <Button
          onClick={() => setAddOpen(true)}
          className="bg-[#ec4899] hover:bg-[#db2777] text-white"
          size="sm"
        >
          <Plus className="h-4 w-4" /> Thêm
        </Button>
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
            Chưa có cấu hình lương nào. Bấm &quot;Thêm&quot; để bắt đầu.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nhân sự</TableHead>
                <TableHead className="text-right">Tổng lương</TableHead>
                <TableHead className="text-right">Sàn %</TableHead>
                <TableHead className="text-right">HS %</TableHead>
                <TableHead className="text-right">Sàn (tr)</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {data!.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">{row.userName}</TableCell>
                  <TableCell className="text-right tabular-nums font-semibold">
                    {fmt(row.baseSalary)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {Math.round(row.floorPct * 100)}%
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {Math.round(row.perfPct * 100)}%
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {fmt(row.baseSalary * row.floorPct)}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() =>
                        setEdit({
                          userId: row.userId,
                          userName: row.userName,
                          baseSalary: row.baseSalary,
                          floorPct: row.floorPct,
                          perfPct: row.perfPct,
                        })
                      }
                    >
                      <Pencil className="h-4 w-4 text-[#ec4899]" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      {/* Dialog chỉnh cấu hình có sẵn */}
      {edit && (
        <SalaryConfigDialog
          open={!!edit}
          onOpenChange={(o) => !o && setEdit(null)}
          initial={edit}
          lockUser
        />
      )}

      {/* Dialog thêm mới (chọn user qua tìm kiếm) */}
      <SalaryConfigDialog open={addOpen} onOpenChange={setAddOpen} />
    </Card>
  );
}

/** Dialog upsert 1 cấu hình lương. Khi thêm mới: chọn user qua searchUsers. */
function SalaryConfigDialog({
  open,
  onOpenChange,
  initial,
  lockUser,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initial?: EditTarget;
  lockUser?: boolean;
}) {
  const [userId, setUserId] = useState<string>(initial?.userId ?? "");
  const [userName, setUserName] = useState<string>(initial?.userName ?? "");
  const [base, setBase] = useState<string>(
    initial ? String(initial.baseSalary) : ""
  );
  const [floorPct, setFloorPct] = useState<string>(
    initial ? String(Math.round(initial.floorPct * 100)) : "70"
  );
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing initial/prop data into local form state on dialog open
      setUserId(initial?.userId ?? "");
      setUserName(initial?.userName ?? "");
      setBase(initial ? String(initial.baseSalary) : "");
      setFloorPct(initial ? String(Math.round(initial.floorPct * 100)) : "70");
      setSearch("");
      setError(null);
    }
  }, [open, initial]);

  const { data: results } = trpc.users.searchUsers.useQuery(
    { query: search },
    { enabled: open && !lockUser && search.length >= 0 }
  );

  const utils = trpc.useUtils();
  const upsert = trpc.payroll.upsertSalaryConfig.useMutation({
    onSuccess: () => {
      utils.payroll.listSalaryConfigs.invalidate();
      // Preview "Bảng lương theo kỳ" cập nhật ngay, không cần reload.
      utils.payroll.computePayroll.invalidate();
      onOpenChange(false);
    },
    onError: (err) => setError(err.message),
  });

  const floorNum = Number(floorPct) / 100;
  const perfNum = useMemo(() => 1 - floorNum, [floorNum]);

  const handleSave = () => {
    setError(null);
    const baseVal = Number(base);
    if (!userId) {
      setError("Hãy chọn nhân sự.");
      return;
    }
    if (Number.isNaN(baseVal) || baseVal < 0) {
      setError("Tổng lương phải là số ≥ 0.");
      return;
    }
    if (Number.isNaN(floorNum) || floorNum < 0 || floorNum > 1) {
      setError("Tỉ lệ sàn phải trong 0–100%.");
      return;
    }
    upsert.mutate({
      userId,
      baseSalary: baseVal,
      floorPct: floorNum,
      perfPct: perfNum,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>
            {initial ? `Chỉnh lương — ${initial.userName}` : "Thêm cấu hình lương"}
          </DialogTitle>
          <DialogDescription>
            Tổng lương/tháng (triệu VND). Sàn + Hiệu suất luôn cộng bằng 100%.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="rounded-md border border-rose-200 bg-rose-50 p-2.5 text-sm text-rose-600 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-400">
            {error}
          </div>
        )}

        {/* Chọn user khi thêm mới */}
        {!lockUser && !initial && (
          <div className="space-y-1.5">
            <Label>Nhân sự</Label>
            {userId ? (
              <div className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
                <span className="font-medium">{userName}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setUserId("");
                    setUserName("");
                  }}
                >
                  Đổi
                </Button>
              </div>
            ) : (
              <>
                <Input
                  placeholder="Tìm theo tên / username..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <div className="max-h-40 overflow-y-auto rounded-md border border-border divide-y divide-border">
                  {(results ?? []).map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      className="w-full px-3 py-2 text-left text-sm hover:bg-muted/60"
                      onClick={() => {
                        setUserId(u.id);
                        setUserName(u.name);
                      }}
                    >
                      {u.name}
                      {u.username ? (
                        <span className="text-muted-foreground">
                          {" "}
                          @{u.username}
                        </span>
                      ) : null}
                    </button>
                  ))}
                  {(results?.length ?? 0) === 0 && (
                    <div className="px-3 py-2 text-xs text-muted-foreground">
                      Không có kết quả.
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="base">Tổng lương (tr/tháng)</Label>
            <Input
              id="base"
              type="number"
              step="0.5"
              min="0"
              value={base}
              onChange={(e) => setBase(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="floor">Lương sàn (%)</Label>
            <Input
              id="floor"
              type="number"
              step="5"
              min="0"
              max="100"
              value={floorPct}
              onChange={(e) => setFloorPct(e.target.value)}
            />
          </div>
        </div>

        <div className="rounded-lg bg-pink-50 px-3 py-2.5 text-xs dark:bg-pink-500/10">
          Sàn {floorPct || 0}% · Hiệu suất {Math.round(perfNum * 100)}% ·
          Lương sàn ={" "}
          <span className="font-semibold">
            {fmt((Number(base) || 0) * (floorNum || 0))} tr
          </span>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Huỷ
          </Button>
          <Button
            onClick={handleSave}
            disabled={upsert.isPending}
            className="bg-[#ec4899] hover:bg-[#db2777] text-white"
          >
            {upsert.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Đang lưu...
              </>
            ) : (
              "Lưu"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
