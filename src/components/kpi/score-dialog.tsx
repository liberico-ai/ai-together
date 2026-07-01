"use client";

import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { useSession } from "@/lib/auth/client";
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
import { Loader2, Sparkles, Star } from "lucide-react";
import { scoreBand } from "./kpi-table";

/**
 * Dialog chấm điểm KPI cho 1 người trong 1 kỳ.
 * - Nhập tay: Quality & AI Adoption (dải [0.5, 1.5], server sẽ clamp lại).
 * - Hiển thị auto: Tempo (computeTempo) & Completion (computeCompletion).
 * - Gọi trpc.kpi.saveScore.useMutation (chairman/admin/bom phía server).
 * Chỉ render trigger cho chairman/admin/bom; nếu không có helper role, cứ render.
 */

const BAND_TEXT: Record<ReturnType<typeof scoreBand>, string> = {
  green: "text-emerald-600 dark:text-emerald-400",
  blue: "text-blue-600 dark:text-blue-400",
  yellow: "text-amber-600 dark:text-amber-400",
  red: "text-rose-600 dark:text-rose-400",
};

export interface ScoreDialogProps {
  periodId: string;
  userId: string;
  userName?: string | null;
  /** giá trị hiện có để prefill (nếu đã chấm) */
  defaultQuality?: number | null;
  defaultAi?: number | null;
  defaultNote?: string | null;
  trigger?: React.ReactNode;
}

export function ScoreDialog({
  periodId,
  userId,
  userName,
  defaultQuality,
  defaultAi,
  defaultNote,
  trigger,
}: ScoreDialogProps) {
  const { data: session } = useSession();
  const role = (session?.user as { role?: string } | undefined)?.role;
  // Chairman/admin/bom (BU lead) được chấm; role chưa xác định -> vẫn render (server chặn).
  const canScore =
    role === undefined ||
    role === "chairman" ||
    role === "admin" ||
    role === "bom";

  const [open, setOpen] = useState(false);
  const [quality, setQuality] = useState<string>(
    defaultQuality != null ? String(defaultQuality) : "1.0"
  );
  const [ai, setAi] = useState<string>(
    defaultAi != null ? String(defaultAi) : "1.0"
  );
  const [note, setNote] = useState<string>(defaultNote ?? "");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sync props into local form state when dialog opens
      setQuality(defaultQuality != null ? String(defaultQuality) : "1.0");
      setAi(defaultAi != null ? String(defaultAi) : "1.0");
      setNote(defaultNote ?? "");
      setError(null);
    }
  }, [open, defaultQuality, defaultAi, defaultNote]);

  // Điểm auto: Tempo & Completion (chỉ đọc, hiển thị cho người chấm tham khảo)
  const { data: tempo, isLoading: tempoLoading } = trpc.kpi.computeTempo.useQuery(
    { periodId, userId },
    { enabled: open && !!periodId && !!userId }
  );
  const { data: completion, isLoading: completionLoading } =
    trpc.kpi.computeCompletion.useQuery(
      { userId },
      { enabled: open && !!userId }
    );

  const utils = trpc.useUtils();
  const saveScore = trpc.kpi.saveScore.useMutation({
    onSuccess: () => {
      utils.kpi.listScores.invalidate({ periodId });
      utils.kpi.myScore.invalidate({ periodId });
      setOpen(false);
    },
    onError: (err) => setError(err.message),
  });

  const q = Number(quality);
  const a = Number(ai);
  const t = Number(tempo ?? 1);
  const c = Number(completion ?? 1);
  const previewComposite = 0.35 * t + 0.25 * c + 0.25 * q + 0.15 * a;

  const handleSave = () => {
    setError(null);
    if (Number.isNaN(q) || Number.isNaN(a)) {
      setError("Quality và AI phải là số.");
      return;
    }
    saveScore.mutate({
      userId,
      periodId,
      qualityScore: q,
      aiScore: a,
      note: note.trim() || undefined,
    });
  };

  if (!canScore) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          (trigger as React.ReactElement) ?? (
            <Button className="bg-pink-500 text-white hover:bg-pink-600" />
          )
        }
      >
        {trigger ? undefined : (
          <>
            <Star className="mr-1.5 h-4 w-4" /> Chấm điểm
          </>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-pink-500" />
            Chấm KPI{userName ? ` — ${userName}` : ""}
          </DialogTitle>
          <DialogDescription>
            Nhập Quality &amp; AI Adoption. Tempo và Completion tính tự động.
            Dải hợp lệ 0.50 – 1.50.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="rounded-md border border-rose-200 bg-rose-50 p-2.5 text-sm text-rose-600 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-400">
            {error}
          </div>
        )}

        {/* Điểm tự động (read-only) */}
        <div className="grid grid-cols-2 gap-3">
          <AutoScore
            label="Tempo (auto)"
            value={tempo}
            loading={tempoLoading}
          />
          <AutoScore
            label="Completion (auto)"
            value={completion}
            loading={completionLoading}
          />
        </div>

        {/* Nhập tay */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="quality">Quality</Label>
            <Input
              id="quality"
              type="number"
              step="0.05"
              min="0.5"
              max="1.5"
              value={quality}
              onChange={(e) => setQuality(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ai">AI Adoption</Label>
            <Input
              id="ai"
              type="number"
              step="0.05"
              min="0.5"
              max="1.5"
              value={ai}
              onChange={(e) => setAi(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="note">Ghi chú (tuỳ chọn)</Label>
          <Textarea
            id="note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Lý do / diễn giải điểm..."
            maxLength={2000}
            rows={3}
          />
        </div>

        {/* Preview composite */}
        <div className="flex items-center justify-between rounded-lg bg-pink-50 px-3 py-2.5 dark:bg-pink-500/10">
          <span className="text-xs font-medium text-muted-foreground">
            Composite dự kiến
            <span className="ml-1 text-[10px]">
              (0.35·T + 0.25·C + 0.25·Q + 0.15·AI)
            </span>
          </span>
          <span
            className={`text-lg font-bold tabular-nums ${
              BAND_TEXT[scoreBand(previewComposite)]
            }`}
          >
            {previewComposite.toFixed(2)}
          </span>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Huỷ
          </Button>
          <Button
            onClick={handleSave}
            disabled={saveScore.isPending}
            className="bg-pink-500 text-white hover:bg-pink-600"
          >
            {saveScore.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Đang lưu...
              </>
            ) : (
              "Lưu điểm"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AutoScore({
  label,
  value,
  loading,
}: {
  label: string;
  value: number | undefined;
  loading: boolean;
}) {
  return (
    <div className="rounded-lg border border-border bg-muted/40 px-3 py-2">
      <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
      {loading ? (
        <Loader2 className="mt-1 h-4 w-4 animate-spin text-muted-foreground" />
      ) : (
        <p
          className={`text-lg font-bold tabular-nums ${
            BAND_TEXT[scoreBand(value)]
          }`}
        >
          {value != null ? Number(value).toFixed(2) : "—"}
        </p>
      )}
    </div>
  );
}
