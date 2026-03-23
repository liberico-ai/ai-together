import { NextResponse } from 'next/server';
import { db } from '@/server/db';
import { modules } from '@drizzle/schema/modules';
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
  
  // Find modules due within 24 hours that are not done
  const dueModules = await db.query.modules.findMany({
    where: and(
      isNotNull(modules.deadline),
      lt(modules.deadline, tomorrow),
      gt(modules.deadline, yesterday),
      ne(modules.status, "done")
    ),
    columns: { id: true, title: true, assigneeId: true, deadline: true }
  });

  let count = 0;
  for (const mod of dueModules) {
    if (mod.assigneeId) {
      await db.insert(notifications).values({
         userId: mod.assigneeId,
         type: "deadline_warning",
         title: "Module Deadline Approaching 🚨",
         body: `Your assigned module "${mod.title}" is due soon.`,
         link: `/modules/${mod.id}`,
      });
      notificationEmitter.emit("new_notification", mod.assigneeId);
      count++;
    }
  }

  return NextResponse.json({ success: true, notifiedCount: count });
}
