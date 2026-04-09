import { NextResponse } from 'next/server';
import { db } from '@/server/db';
import { tasks } from '@drizzle/schema/tasks';
import { notifications } from '@drizzle/schema/notifications';
import { lt, and, ne, isNotNull, gt } from 'drizzle-orm';
import { addDays, subDays } from 'date-fns';
import { notificationEmitter } from '@/lib/events';

export async function GET(req: Request) {
  // Secure cron protection
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error("[Cron] CRON_SECRET not configured");
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  const authHeader = req.headers.get('authorization') ?? '';
  const expected = `Bearer ${cronSecret}`;

  // Constant-time comparison to prevent timing attacks
  const { timingSafeEqual } = await import('crypto');
  const a = Buffer.from(authHeader);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tomorrow = addDays(new Date(), 1);
  const yesterday = subDays(new Date(), 1);

  // Find tasks due within 24 hours that are not done
  const dueTasks = await db.query.tasks.findMany({
    where: and(
      isNotNull(tasks.deadline),
      lt(tasks.deadline, tomorrow),
      gt(tasks.deadline, yesterday),
      ne(tasks.status, "done")
    ),
    columns: { id: true, title: true, assigneeId: true, deadline: true, projectId: true }
  });

  let count = 0;
  for (const task of dueTasks) {
    if (task.assigneeId) {
      await db.insert(notifications).values({
         userId: task.assigneeId,
         type: "deadline_warning",
         title: "Task Deadline Approaching",
         body: `Your assigned task "${task.title}" is due soon.`,
         link: `/projects/${task.projectId}`,
      });
      notificationEmitter.emit("new_notification", task.assigneeId);
      count++;
    }
  }

  return NextResponse.json({ success: true, notifiedCount: count });
}
