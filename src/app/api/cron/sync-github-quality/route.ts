import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { githubCommits } from "@drizzle/schema/github";
import { qualityEvents } from "@drizzle/schema/kpi";
import { reviews } from "@drizzle/schema/reviews";
import { tasks } from "@drizzle/schema/tasks";
import { modules } from "@drizzle/schema/modules";
import { eq, and, isNotNull, gt } from "drizzle-orm";
import { subDays } from "date-fns";

/**
 * Cron: đồng bộ tín hiệu chất lượng từ GitHub / reviews → bảng `quality_events`
 * (Mục tiêu 2, thành phần Quality).
 *
 * Auth: Bearer CRON_SECRET (pattern y hệt các cron khác).
 *
 * Nguồn dữ liệu:
 *   1. `github_commits.ciStatus='failure'` → quality_events type='ci_fail'
 *      cho authorUserId (đã có sẵn).
 *   2. `reviews.status='changes_requested'` → quality_events type='review_reject'
 *      cho NGƯỜI BỊ trả lại việc (owner của targetId), KHÔNG phải reviewer.
 *
 * Map owner của review (người bị trả lại):
 *   - targetType='task'   → tasks.assigneeId, fallback tasks.createdBy
 *   - targetType='module' → modules.createdBy
 *   Nếu không suy được userId nào → bỏ qua (skip).
 *
 * Chống trùng:
 *   - ci_fail:       (userId + type + refId=sha)
 *   - review_reject: (userId + type + refId=reviewId)
 *   qualityEvents không có unique constraint theo refId → kiểm tra tồn tại
 *   trước khi insert.
 *
 * MỞ RỘNG SAU:
 *   - type 'bug_prod' : quét GitHub Issues gắn label "bug"/"production"
 *     qua Issues API (GET /repos/{o}/{r}/issues?labels=bug). Xem stub
 *     `syncBugProd()` bên dưới — cần GITHUB_TOKEN + gọi REST API.
 */
export async function GET(req: Request) {
  // ── Auth ──────────────────────────────────────────────
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error("[Cron] CRON_SECRET not configured");
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  const authHeader = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${cronSecret}`;

  const { timingSafeEqual } = await import("crypto");
  const a = Buffer.from(authHeader);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const since = subDays(new Date(), 30);

  // ── 1) CI failures ────────────────────────────────────
  let ciFail: { created: number; skipped: number };
  try {
    ciFail = await syncCiFail(since);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[Cron/sync-github-quality] ci_fail sync failed:", msg);
    return NextResponse.json({ success: false, error: "Database error" }, { status: 500 });
  }

  // ── 2) Review rejections (changes_requested) ──────────
  let reviewReject: { created: number; skipped: number };
  try {
    reviewReject = await syncReviewReject(since);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[Cron/sync-github-quality] review_reject sync failed:", msg);
    return NextResponse.json({ success: false, error: "Database error" }, { status: 500 });
  }

  return NextResponse.json({ success: true, ciFail, reviewReject });
}

/**
 * Quét commit CI failed gần đây → ghi quality_events type='ci_fail'.
 * Chống trùng theo (userId + type='ci_fail' + refId=sha).
 */
async function syncCiFail(
  since: Date
): Promise<{ created: number; skipped: number }> {
  const failedCommits = await db.query.githubCommits.findMany({
    where: and(
      eq(githubCommits.ciStatus, "failure"),
      isNotNull(githubCommits.authorUserId),
      gt(githubCommits.committedAt, since)
    ),
    columns: { sha: true, authorUserId: true, message: true },
    limit: 500,
  });

  let created = 0;
  let skipped = 0;

  for (const c of failedCommits) {
    const userId = c.authorUserId;
    if (!userId) {
      skipped++;
      continue;
    }

    try {
      const existing = await db.query.qualityEvents.findFirst({
        where: and(
          eq(qualityEvents.userId, userId),
          eq(qualityEvents.type, "ci_fail"),
          eq(qualityEvents.refId, c.sha)
        ),
        columns: { id: true },
      });

      if (existing) {
        skipped++;
        continue;
      }

      await db.insert(qualityEvents).values({
        userId,
        type: "ci_fail",
        refId: c.sha,
        // periodId để null — KPI computation gắn kỳ theo createdAt sau.
        note: `CI failure: ${c.message.slice(0, 200)}`,
      });
      created++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(
        `[Cron/sync-github-quality] ci_fail insert failed for sha ${c.sha}:`,
        msg
      );
    }
  }

  return { created, skipped };
}

/**
 * Quét review status='changes_requested' gần đây → ghi quality_events
 * type='review_reject' cho NGƯỜI BỊ trả lại (owner của targetId).
 *
 * owner:
 *   - task  : assigneeId ?? createdBy
 *   - module: createdBy
 * Chống trùng theo (userId + type='review_reject' + refId=reviewId).
 */
async function syncReviewReject(
  since: Date
): Promise<{ created: number; skipped: number }> {
  const rejected = await db.query.reviews.findMany({
    where: and(
      eq(reviews.status, "changes_requested"),
      gt(reviews.createdAt, since)
    ),
    columns: {
      id: true,
      targetType: true,
      targetId: true,
      note: true,
    },
    limit: 500,
  });

  let created = 0;
  let skipped = 0;

  for (const r of rejected) {
    const ownerUserId = await resolveReviewOwner(r.targetType, r.targetId);
    if (!ownerUserId) {
      skipped++;
      continue;
    }

    try {
      const existing = await db.query.qualityEvents.findFirst({
        where: and(
          eq(qualityEvents.userId, ownerUserId),
          eq(qualityEvents.type, "review_reject"),
          eq(qualityEvents.refId, r.id)
        ),
        columns: { id: true },
      });

      if (existing) {
        skipped++;
        continue;
      }

      const noteSuffix = r.note ? `: ${r.note.slice(0, 180)}` : "";
      await db.insert(qualityEvents).values({
        userId: ownerUserId,
        type: "review_reject",
        refId: r.id,
        note: `Review changes_requested on ${r.targetType} ${r.targetId}${noteSuffix}`,
      });
      created++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(
        `[Cron/sync-github-quality] review_reject insert failed for review ${r.id}:`,
        msg
      );
    }
  }

  return { created, skipped };
}

/**
 * Suy ra userId của người BỊ trả lại việc từ (targetType, targetId).
 * - task  : ưu tiên assigneeId (người phụ trách chính), fallback createdBy.
 * - module: createdBy.
 * Trả null nếu không tìm được (target đã xoá / không có owner).
 */
async function resolveReviewOwner(
  targetType: string,
  targetId: string
): Promise<string | null> {
  if (targetType === "task") {
    const task = await db.query.tasks.findFirst({
      where: eq(tasks.id, targetId),
      columns: { assigneeId: true, createdBy: true },
    });
    return task?.assigneeId ?? task?.createdBy ?? null;
  }

  if (targetType === "module") {
    const mod = await db.query.modules.findFirst({
      where: eq(modules.id, targetId),
      columns: { createdBy: true },
    });
    return mod?.createdBy ?? null;
  }

  return null;
}

/**
 * STUB — mở rộng sau: đồng bộ bug production từ GitHub Issues.
 *
 * Ý tưởng: GET /repos/{owner}/{repo}/issues?labels=bug&state=all&since=...
 * → với mỗi issue có label 'bug'/'production', map assignee (github login)
 *   sang users.id (qua githubCommits.authorGithub / bảng mapping) rồi ghi
 *   quality_events type='bug_prod' (chống trùng theo refId=issue node_id/number).
 *
 * Cần GITHUB_TOKEN + gọi REST API thật; chưa bật trong pipeline hiện tại.
 */
async function syncBugProd(): Promise<{ created: number; skipped: number }> {
  // TODO: gọi GitHub Issues API (label 'bug'), map github login → userId,
  //       ghi quality_events type='bug_prod'. Xem docstring ở trên.
  return { created: 0, skipped: 0 };
}

// Giữ tham chiếu để tránh cảnh báo "unused" khi bật noUnusedLocals;
// hàm sẽ được gọi khi bật đồng bộ bug_prod.
void syncBugProd;
