import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { tasks } from "@drizzle/schema/tasks";
import { userJiraMap } from "@drizzle/schema/users";
import { eq } from "drizzle-orm";
import { nextId } from "@/lib/id-gen";

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const secret = process.env.JIRA_WEBHOOK_SECRET;

  // Jira webhooks typically do not support custom HMAC headers like GitHub by default.
  // Instead, append the secret to the webhook URL in Jira: /api/jira-webhook?token=YOUR_SECRET
  if (secret) {
    const token = req.nextUrl.searchParams.get("token");
    if (token !== secret) {
      return NextResponse.json({ error: "Invalid or missing token" }, { status: 401 });
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let body: Record<string, any>;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const webhookEvent = body.webhookEvent; // e.g., "jira:issue_created"

  if (webhookEvent === "jira:issue_created" || webhookEvent === "jira:issue_updated") {
    const issue = body.issue;
    if (!issue) return NextResponse.json({ error: "No issue in payload" }, { status: 400 });

    const issueKey = issue.key; // e.g., "LBR-123"
    const summary = issue.fields?.summary || `Jira Task ${issueKey}`;
    const description = issue.fields?.description || "";
    const assigneeAccountId = issue.fields?.assignee?.accountId;
    const jiraProject = issue.fields?.project?.key || ""; // e.g. "LBR", "BTNET"

    // Resolve Jira User mapping
    let mappedUserId: string | null = null;
    if (assigneeAccountId) {
      const mapping = await db.query.userJiraMap.findFirst({
        where: eq(userJiraMap.jiraAccountId, assigneeAccountId)
      });
      if (mapping) mappedUserId = mapping.userId;
    }

    // Attempt to find existing task by jiraIssueKey
    if (webhookEvent === "jira:issue_updated") {
      const existingTask = await db.query.tasks.findFirst({
        where: eq(tasks.jiraIssueKey, issueKey),
        columns: { id: true }
      });

      if (existingTask) {
        await db.update(tasks).set({
          title: summary,
          description: description.slice(0, 5000),
          assigneeId: mappedUserId,
          updatedAt: new Date()
        }).where(eq(tasks.id, existingTask.id));
        return NextResponse.json({ message: "Task Updated", taskId: existingTask.id });
      }
    }

    // Create new operations task
    const newTaskId = await nextId("TASK", db);
    const [insertedTask] = await db.insert(tasks).values({
      id: newTaskId,
      category: "operations",
      domain: jiraProject || null,
      projectId: null,
      title: summary,
      description: description.slice(0, 5000),
      jiraIssueKey: issueKey,
      assigneeId: mappedUserId,
      status: "planned",
      priority: "medium",
    }).returning();

    return NextResponse.json({ message: "Operations Task Created", taskId: insertedTask?.id });
  }

  return NextResponse.json({ message: "Ignored event: " + webhookEvent }, { status: 200 });
}
