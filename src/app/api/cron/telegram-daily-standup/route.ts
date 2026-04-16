import { NextResponse } from 'next/server';
import { db } from '@/server/db';
import { tasks } from '@drizzle/schema/tasks';
import { eq } from 'drizzle-orm';
import { formatStandupMessage, type StandupTask } from '@/lib/telegram-standup';
import { sendTelegramMessage } from '@/lib/telegram';

const MAX_TASKS = 200;

export async function GET(req: Request) {
  // Auth (pattern y hệt /api/cron/deadline-warning)
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error('[Cron] CRON_SECRET not configured');
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
  }

  const authHeader = req.headers.get('authorization') ?? '';
  const expected = `Bearer ${cronSecret}`;

  // Constant-time comparison to prevent timing attacks
  const { timingSafeEqual } = await import('crypto');
  const a = Buffer.from(authHeader);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Query tasks in_progress với assignee info
  type TaskRow = {
    id: string;
    title: string;
    deadline: Date | null;
    assigneeId: string | null;
    assignee: { id: string; name: string | null } | null;
  };
  let rows: TaskRow[];
  try {
    rows = await db.query.tasks.findMany({
      where: eq(tasks.status, 'in_progress'),
      limit: MAX_TASKS,
      columns: { id: true, title: true, deadline: true, assigneeId: true },
      with: {
        assignee: { columns: { id: true, name: true } },
      },
    }) as TaskRow[];
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[Cron/telegram-daily-standup] DB query failed:', msg);
    return NextResponse.json({ success: false, error: 'Database error' }, { status: 500 });
  }

  const standupTasks: StandupTask[] = rows.map((r) => ({
    id: r.id,
    title: r.title,
    deadline: r.deadline,
    assignee: r.assignee ? { id: r.assignee.id, name: r.assignee.name ?? '(Unknown)' } : null,
  }));

  let chunks: string[];
  try {
    chunks = formatStandupMessage(standupTasks, new Date());
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[Cron/telegram-daily-standup] Format failed:', msg);
    return NextResponse.json({ success: false, error: 'Format error' }, { status: 500 });
  }

  // Best-effort send. Failure 1 chunk không block chunks khác.
  let sent = 0;
  let failed = 0;
  const errors: string[] = [];

  for (let i = 0; i < chunks.length; i++) {
    try {
      if (i > 0 && chunks.length > 5) {
        // Rate-limit guard khi >5 chunks
        await new Promise((r) => setTimeout(r, 1100));
      }
      await sendTelegramMessage(chunks[i]);
      sent++;
    } catch (err) {
      failed++;
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`chunk ${i}: ${msg}`);
      console.error(`[Cron/telegram-daily-standup] Chunk ${i} failed:`, msg);
    }
  }

  return NextResponse.json({
    success: failed === 0,
    totalTasks: standupTasks.length,
    truncated: rows.length === MAX_TASKS,
    chunksTotal: chunks.length,
    chunksSent: sent,
    chunksFailed: failed,
    errors: errors.length > 0 ? errors : undefined,
  });
}
