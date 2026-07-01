/**
 * Công thức thuần cho KPI Composite Score (Mục tiêu 2).
 *
 * Tách khỏi tRPC router để có thể unit-test độc lập (không cần DB/ctx).
 *
 * KHUYẾN NGHỊ: `src/server/trpc/routers/kpi.ts` nên import `clampScore` &
 * `composite` từ file này thay vì định nghĩa lại `clamp`/trọng số inline,
 * để đảm bảo một nguồn sự thật duy nhất cho công thức.
 */

/** Trọng số composite — Addendum 2: 0.35·Tempo + 0.25·Completion + 0.25·Quality + 0.15·AIAdoption. */
export const KPI_WEIGHTS = {
  tempo: 0.35,
  completion: 0.25,
  quality: 0.25,
  ai: 0.15,
} as const;

/** Biên clamp mỗi trục theo công thức quy đổi (Addendum 3.2). */
export const CLAMP_MIN = 0.5;
export const CLAMP_MAX = 1.5;

/**
 * Clamp một trục điểm về [CLAMP_MIN, CLAMP_MAX].
 * NaN/undefined → CLAMP_MIN (an toàn, coi như đạt sàn).
 */
export function clampScore(x: number): number {
  if (!Number.isFinite(x)) return CLAMP_MIN;
  return Math.min(CLAMP_MAX, Math.max(CLAMP_MIN, x));
}

export type CompositeAxes = {
  tempo: number;
  completion: number;
  quality: number;
  ai: number;
};

/**
 * Composite = 0.35·Tempo + 0.25·Completion + 0.25·Quality + 0.15·AIAdoption.
 *
 * Mỗi trục được clamp về [0.5, 1.5] trước khi nhân trọng số, nên kết quả
 * cũng nằm trong [0.5, 1.5].
 */
export function composite(axes: CompositeAxes): number {
  const t = clampScore(axes.tempo);
  const c = clampScore(axes.completion);
  const q = clampScore(axes.quality);
  const a = clampScore(axes.ai);

  return (
    KPI_WEIGHTS.tempo * t +
    KPI_WEIGHTS.completion * c +
    KPI_WEIGHTS.quality * q +
    KPI_WEIGHTS.ai * a
  );
}
