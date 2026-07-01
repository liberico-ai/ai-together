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
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { AlertTriangle, Loader2 } from "lucide-react";

export function BlockerDialog({
  taskId,
  onBlocked,
}: {
  taskId: string;
  onBlocked?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [blockedBy, setBlockedBy] = useState("");

  const utils = trpc.useUtils();

  const setBlocker = trpc.tasks.setBlocker.useMutation({
    onSuccess: () => {
      setOpen(false);
      setReason("");
      setBlockedBy("");
      utils.businessUnits.blockers.invalidate();
      utils.businessUnits.status.invalidate();
      utils.tasks.getById.invalidate({ id: taskId });
      onBlocked?.();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) return;
    setBlocker.mutate({
      id: taskId,
      reason: reason.trim(),
      blockedBy: blockedBy.trim() || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            size="sm"
            variant="outline"
            className="border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-800 dark:text-amber-400 dark:hover:bg-amber-900/20"
          />
        }
      >
        <AlertTriangle className="mr-2 h-4 w-4" /> Báo vướng mắc
      </DialogTrigger>
      <DialogContent className="sm:max-w-[460px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Báo vướng mắc</DialogTitle>
            <DialogDescription>
              Ghi lý do việc bị tắc và đang chờ ai/BU/đối tác.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Reason */}
            <div className="grid gap-1.5">
              <Label htmlFor="blocker-reason">Reason *</Label>
              <Textarea
                id="blocker-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Chờ API key từ đối tác, thiếu quyền truy cập..."
                rows={3}
                required
              />
            </div>

            {/* Blocked by / waiting on */}
            <div className="grid gap-1.5">
              <Label htmlFor="blocker-by">Waiting on (chờ ai)</Label>
              <Input
                id="blocker-by"
                value={blockedBy}
                onChange={(e) => setBlockedBy(e.target.value)}
                placeholder="e.g. BU Finance, đối tác VNPT, @nguyen..."
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="submit"
              disabled={setBlocker.isPending || !reason.trim()}
              className="bg-pink-600 text-white hover:bg-pink-700"
            >
              {setBlocker.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Đang lưu...
                </>
              ) : (
                "Đánh dấu vướng mắc"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
