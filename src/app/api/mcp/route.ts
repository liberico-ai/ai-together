import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { users } from "@drizzle/schema/users";
import { projects, projectMembers } from "@drizzle/schema/projects";
import { modules } from "@drizzle/schema/modules";
import { tasks } from "@drizzle/schema/tasks";
import { comments } from "@drizzle/schema/comments";
import { documents } from "@drizzle/schema/documents";
import { scoreEvents, reviewScores, userActivityLog } from "@drizzle/schema/scoring";
import { activityLogs, notifications } from "@drizzle/schema/notifications";
import { githubCommits } from "@drizzle/schema/github";
import { reviews } from "@drizzle/schema/reviews";
import { eq, and, or, sql, desc, asc, inArray, gte } from "drizzle-orm";
import { nextId } from "@/lib/id-gen";
import { s3Client, MINIO_BUCKET, MINIO_PUBLIC_URL } from "@/lib/minio";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { calculateTempoBonus, getCurrentStreak } from "@/lib/scoring";

// ==========================================
// Auth: Extract user from API Key
// ==========================================
async function authenticate(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }
  const apiKey = authHeader.slice(7);
  const user = await db.query.users.findFirst({
    where: eq(users.apiKey, apiKey),
  });
  return user || null;
}

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized: Invalid or missing API key" }, { status: 401 });
}

function forbidden(msg = "Forbidden: Insufficient permissions") {
  return NextResponse.json({ error: msg }, { status: 403 });
}

function badRequest(msg: string) {
  return NextResponse.json({ error: msg }, { status: 400 });
}

function ok(data: any) {
  return NextResponse.json({ success: true, data });
}

function isPrivileged(role: string) {
  return role === "chairman" || role === "admin";
}

// ==========================================
// POST /api/mcp — Single MCP API Endpoint
// ==========================================
export async function POST(req: NextRequest) {
  const user = await authenticate(req);
  if (!user) return unauthorized();

  let body: any;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON body");
  }

  const { action, ...params } = body;
  if (!action) return badRequest("Missing 'action' field");

  try {
    switch (action) {
      // =================
      // PROJECTS
      // =================
      case "get_projects": {
        const data = await db.query.projects.findMany({
          orderBy: (p, { desc }) => [desc(p.createdAt)],
          with: {
            chairman: { columns: { id: true, name: true, email: true, role: true } },
            members: { with: { user: { columns: { id: true, name: true, email: true, role: true } } } },
          },
        });
        return ok(data);
      }

      case "get_project": {
        if (!params.projectId) return badRequest("Missing projectId");
        const project = await db.query.projects.findFirst({
          where: eq(projects.id, params.projectId),
          with: {
            chairman: { columns: { id: true, name: true, email: true, role: true } },
            members: { with: { user: { columns: { id: true, name: true, email: true, role: true } } } },
          },
        });
        if (!project) return badRequest("Project not found");
        return ok(project);
      }

      case "create_project": {
        if (!params.title) return badRequest("Missing title");
        const newId = await nextId("PROJ", db);
        let pmId = params.managerId;
        if (!pmId) {
          const chairman = await db.query.users.findFirst({
            where: eq(users.role, "chairman"),
            columns: { id: true },
          });
          pmId = chairman?.id || user.id;
        }
        const [project] = await db.insert(projects).values({
          id: newId,
          title: params.title,
          description: params.description,
          chairmanId: pmId,
          deadline: params.deadline ? new Date(params.deadline) : undefined,
        }).returning();

        // Auto-add creator + privileged users
        const privileged = await db.query.users.findMany({
          where: or(eq(users.role, "chairman"), eq(users.role, "admin")),
          columns: { id: true },
        });
        const memberIds = new Set([user.id, pmId, ...privileged.map(u => u.id)]);
        const memberValues = Array.from(memberIds).map(uid => ({ projectId: newId, userId: uid }));
        if (memberValues.length > 0) {
          await db.insert(projectMembers).values(memberValues).onConflictDoNothing();
        }
        return ok(project);
      }

      case "update_project": {
        if (!isPrivileged(user.role)) return forbidden();
        if (!params.projectId) return badRequest("Missing projectId");
        const updates: any = { updatedAt: new Date() };
        if (params.title) updates.title = params.title;
        if (params.description !== undefined) updates.description = params.description;
        if (params.status) updates.status = params.status;
        if (params.githubOwner !== undefined) updates.githubOwner = params.githubOwner;
        if (params.githubRepo !== undefined) updates.githubRepo = params.githubRepo;
        if (params.deadline !== undefined) updates.deadline = params.deadline ? new Date(params.deadline) : null;
        const [updated] = await db.update(projects).set(updates).where(eq(projects.id, params.projectId)).returning();
        return ok(updated);
      }

      case "delete_project": {
        if (!isPrivileged(user.role)) return forbidden();
        if (!params.projectId) return badRequest("Missing projectId");
        await db.transaction(async (tx) => {
          const mods = await tx.query.modules.findMany({
            where: eq(modules.projectId, params.projectId),
            columns: { id: true },
          });
          for (const mod of mods) {
            await tx.delete(tasks).where(eq(tasks.moduleId, mod.id));
            await tx.delete(comments).where(eq(comments.targetId, mod.id));
            await tx.delete(documents).where(eq(documents.targetId, mod.id));
            await tx.delete(scoreEvents).where(eq(scoreEvents.refId, mod.id));
          }
          await tx.delete(modules).where(eq(modules.projectId, params.projectId));
          await tx.delete(githubCommits).where(eq(githubCommits.projectId, params.projectId));
          await tx.delete(projectMembers).where(eq(projectMembers.projectId, params.projectId));
          await tx.delete(projects).where(eq(projects.id, params.projectId));
        });
        return ok({ deleted: true });
      }

      case "add_project_member": {
        if (!isPrivileged(user.role)) return forbidden();
        if (!params.projectId || !params.userId) return badRequest("Missing projectId or userId");
        const [member] = await db.insert(projectMembers)
          .values({ projectId: params.projectId, userId: params.userId })
          .onConflictDoNothing()
          .returning();
        return ok(member || { already_member: true });
      }

      case "remove_project_member": {
        if (!isPrivileged(user.role)) return forbidden();
        if (!params.projectId || !params.userId) return badRequest("Missing projectId or userId");
        await db.delete(projectMembers).where(
          and(eq(projectMembers.projectId, params.projectId), eq(projectMembers.userId, params.userId))
        );
        return ok({ removed: true });
      }

      case "sync_github_commits": {
        if (!params.projectId) return badRequest("Missing projectId");
        const project = await db.query.projects.findFirst({ where: eq(projects.id, params.projectId) });
        if (!project) return badRequest("Project not found");
        if (!project.githubOwner || !project.githubRepo) return badRequest("No GitHub repo linked");

        const headers: Record<string, string> = {
          Accept: "application/vnd.github.v3+json",
          "User-Agent": "Libe-Aios",
        };
        const token = process.env.GITHUB_TOKEN;
        if (token) headers.Authorization = `Bearer ${token}`;

        const response = await fetch(
          `https://api.github.com/repos/${project.githubOwner}/${project.githubRepo}/commits?per_page=100`,
          { headers }
        );
        if (!response.ok) return badRequest(`GitHub API error: ${response.status}`);

        const apiCommits = await response.json();
        const { userGithubMap } = await import("@drizzle/schema/users");
        const allMappings = await db.query.userGithubMap.findMany();
        const usernameToUserId = new Map(allMappings.map(m => [m.githubUsername.toLowerCase(), m.userId]));

        const commitValues = apiCommits.map((c: any) => ({
          projectId: params.projectId,
          sha: c.sha,
          message: c.commit?.message || "",
          authorGithub: c.author?.login || c.commit?.author?.name || "Unknown",
          authorUserId: usernameToUserId.get((c.author?.login || "").toLowerCase()) || null,
          branch: null as string | null,
          committedAt: new Date(c.commit?.author?.date || new Date()),
        }));

        let inserted = 0;
        if (commitValues.length > 0) {
          const result = await db.insert(githubCommits).values(commitValues).onConflictDoNothing().returning({ id: githubCommits.id });
          inserted = result.length;
        }
        return ok({ synced: inserted, total: apiCommits.length });
      }

      // =================
      // MODULES
      // =================
      case "get_modules": {
        if (!params.projectId) return badRequest("Missing projectId");
        const data = await db.query.modules.findMany({
          where: eq(modules.projectId, params.projectId),
          orderBy: (m, { desc }) => [desc(m.createdAt)],
          with: {
            assignee: { columns: { id: true, name: true, email: true } },
            project: { columns: { id: true, title: true } },
          },
        });
        return ok(data);
      }

      case "get_my_modules": {
        const data = await db.query.modules.findMany({
          where: eq(modules.assigneeId, user.id),
          orderBy: (m, { desc }) => [desc(m.createdAt)],
          with: {
            project: { columns: { id: true, title: true } },
          },
        });
        return ok(data);
      }

      case "get_module": {
        if (!params.moduleId) return badRequest("Missing moduleId");
        const mod = await db.query.modules.findFirst({
          where: eq(modules.id, params.moduleId),
          with: {
            assignee: { columns: { id: true, name: true, email: true } },
            project: { columns: { id: true, title: true } },
          },
        });
        if (!mod) return badRequest("Module not found");
        return ok(mod);
      }

      case "create_module": {
        if (!params.projectId || !params.title) return badRequest("Missing projectId or title");
        const newId = await nextId("MOD", db);
        const [mod] = await db.insert(modules).values({
          id: newId,
          projectId: params.projectId,
          title: params.title,
          description: params.description,
          assigneeId: params.assigneeId || null,
          deadline: params.deadline ? new Date(params.deadline) : undefined,
          createdBy: user.id,
        }).returning();
        return ok(mod);
      }

      case "update_module": {
        if (!params.moduleId) return badRequest("Missing moduleId");
        const updates: any = { updatedAt: new Date() };
        if (params.title) updates.title = params.title;
        if (params.description !== undefined) updates.description = params.description;
        if (params.assigneeId !== undefined) updates.assigneeId = params.assigneeId || null;
        if (params.deadline !== undefined) updates.deadline = params.deadline ? new Date(params.deadline) : null;
        const [updated] = await db.update(modules).set(updates).where(eq(modules.id, params.moduleId)).returning();
        return ok(updated);
      }

      case "update_module_status": {
        if (!params.moduleId || !params.status) return badRequest("Missing moduleId or status");
        const [updated] = await db.update(modules)
          .set({ status: params.status, updatedAt: new Date() })
          .where(eq(modules.id, params.moduleId))
          .returning();

        // Log activity
        await db.insert(activityLogs).values({
          userId: user.id,
          action: "module_status_changed",
          targetType: "module",
          targetId: params.moduleId,
          metadata: JSON.stringify({ newStatus: params.status }),
        });
        return ok(updated);
      }

      case "delete_module": {
        if (!params.moduleId) return badRequest("Missing moduleId");
        await db.transaction(async (tx) => {
          await tx.delete(tasks).where(eq(tasks.moduleId, params.moduleId));
          await tx.delete(comments).where(eq(comments.targetId, params.moduleId));
          await tx.delete(documents).where(eq(documents.targetId, params.moduleId));
          await tx.delete(scoreEvents).where(eq(scoreEvents.refId, params.moduleId));
          await tx.delete(modules).where(eq(modules.id, params.moduleId));
        });
        return ok({ deleted: true });
      }

      // =================
      // TASKS
      // =================
      case "get_tasks": {
        if (!params.moduleId) return badRequest("Missing moduleId");
        const data = await db.query.tasks.findMany({
          where: eq(tasks.moduleId, params.moduleId),
          orderBy: (t, { desc }) => [desc(t.createdAt)],
          with: {
            assignee: { columns: { id: true, name: true, email: true } },
          },
        });
        return ok(data);
      }

      case "get_my_tasks": {
        const data = await db.query.tasks.findMany({
          where: eq(tasks.assigneeId, user.id),
          orderBy: (t, { desc }) => [desc(t.createdAt)],
          with: {
            module: { columns: { id: true, title: true } },
          },
        });
        return ok(data);
      }

      case "create_task": {
        if (!params.moduleId || !params.title) return badRequest("Missing moduleId or title");
        const newId = await nextId("TASK", db);
        const [task] = await db.insert(tasks).values({
          id: newId,
          moduleId: params.moduleId,
          title: params.title,
          description: params.description,
          assigneeId: params.assigneeId || null,
          deadline: params.deadline ? new Date(params.deadline) : undefined,
          createdBy: user.id,
        }).returning();
        return ok(task);
      }

      case "update_task": {
        if (!params.taskId) return badRequest("Missing taskId");
        const updates: any = { updatedAt: new Date() };
        if (params.title) updates.title = params.title;
        if (params.description !== undefined) updates.description = params.description;
        if (params.assigneeId !== undefined) updates.assigneeId = params.assigneeId || null;
        if (params.deadline !== undefined) updates.deadline = params.deadline ? new Date(params.deadline) : null;
        const [updated] = await db.update(tasks).set(updates).where(eq(tasks.id, params.taskId)).returning();
        return ok(updated);
      }

      case "update_task_status": {
        if (!params.taskId || !params.status) return badRequest("Missing taskId or status");
        const [updated] = await db.update(tasks)
          .set({ status: params.status, updatedAt: new Date() })
          .where(eq(tasks.id, params.taskId))
          .returning();

        await db.insert(activityLogs).values({
          userId: user.id,
          action: "task_status_changed",
          targetType: "task",
          targetId: params.taskId,
          metadata: JSON.stringify({ newStatus: params.status }),
        });
        return ok(updated);
      }

      case "delete_task": {
        if (!params.taskId) return badRequest("Missing taskId");
        await db.delete(tasks).where(eq(tasks.id, params.taskId));
        return ok({ deleted: true });
      }

      // =================
      // COMMENTS
      // =================
      case "get_comments": {
        if (!params.targetType || !params.targetId) return badRequest("Missing targetType or targetId");
        const data = await db.query.comments.findMany({
          where: and(eq(comments.targetType, params.targetType), eq(comments.targetId, params.targetId)),
          orderBy: (c, { asc }) => [asc(c.createdAt)],
          with: {
            author: { columns: { id: true, name: true, email: true } },
          },
        });
        return ok(data);
      }

      case "add_comment": {
        if (!params.targetType || !params.targetId || !params.content)
          return badRequest("Missing targetType, targetId, or content");
        const [comment] = await db.insert(comments).values({
          targetType: params.targetType,
          targetId: params.targetId,
          content: params.content,
          authorId: user.id,
        }).returning();
        return ok(comment);
      }

      case "delete_comment": {
        if (!params.commentId) return badRequest("Missing commentId");
        await db.delete(comments).where(eq(comments.id, params.commentId));
        return ok({ deleted: true });
      }

      // =================
      // DOCUMENTS
      // =================
      case "list_documents": {
        if (!params.targetType || !params.targetId) return badRequest("Missing targetType or targetId");
        const data = await db.query.documents.findMany({
          where: and(eq(documents.targetType, params.targetType), eq(documents.targetId, params.targetId)),
          orderBy: (d, { desc }) => [desc(d.createdAt)],
        });
        return ok(data);
      }

      case "attach_link": {
        if (!params.targetType || !params.targetId || !params.title || !params.url)
          return badRequest("Missing targetType, targetId, title, or url");
        const [doc] = await db.insert(documents).values({
          title: params.title,
          type: "link",
          url: params.url,
          targetType: params.targetType,
          targetId: params.targetId,
          uploadedBy: user.id,
        }).returning();
        return ok(doc);
      }

      case "delete_document": {
        if (!params.documentId) return badRequest("Missing documentId");
        await db.delete(documents).where(eq(documents.id, params.documentId));
        return ok({ deleted: true });
      }

      case "upload_document": {
        if (!params.targetType || !params.targetId || !params.filename || !params.fileBase64)
          return badRequest("Missing targetType, targetId, filename, or fileBase64");

        // Decode base64 to Buffer
        const fileBuffer = Buffer.from(params.fileBase64, "base64");
        const maxSize = 50 * 1024 * 1024; // 50MB
        if (fileBuffer.length > maxSize) return badRequest("File exceeds 50MB limit");

        const ext = params.filename.split(".").pop() || "bin";
        const s3Key = `${params.targetType}/${params.targetId}/${crypto.randomUUID()}.${ext}`;
        const contentType = params.contentType || "application/octet-stream";

        // Upload to S3/MinIO
        await s3Client.send(new PutObjectCommand({
          Bucket: MINIO_BUCKET,
          Key: s3Key,
          Body: fileBuffer,
          ContentType: contentType,
        }));

        const url = `${MINIO_PUBLIC_URL}/${s3Key}`;
        const [doc] = await db.insert(documents).values({
          title: params.filename,
          type: "file",
          url,
          fileSize: fileBuffer.length,
          targetType: params.targetType,
          targetId: params.targetId,
          uploadedBy: user.id,
        }).returning();

        return ok(doc);
      }

      // =================
      // REVIEWS
      // =================
      case "submit_review": {
        if (!isPrivileged(user.role)) return forbidden("Only Chairman/Admin can submit reviews");
        if (!params.moduleId || !params.status || params.score === undefined)
          return badRequest("Missing moduleId, status, or score");

        const mod = await db.query.modules.findFirst({
          where: eq(modules.id, params.moduleId),
        });
        if (!mod) return badRequest("Module not found");

        const newStatus = params.status === "approved" ? "done" : "changes_requested";
        await db.update(modules).set({ status: newStatus, updatedAt: new Date() }).where(eq(modules.id, params.moduleId));

        if (params.status === "approved" && mod.assigneeId) {
          await db.insert(scoreEvents).values({
            userId: mod.assigneeId,
            points: params.score,
            eventType: "module_done",
            refType: "module",
            refId: params.moduleId,
          });
          await db.insert(reviewScores).values({
            taskId: params.moduleId,
            reviewerId: user.id,
            score: params.score,
            feedback: params.note || "",
            submittedVia: "mcp",
          });
        }

        await db.insert(activityLogs).values({
          userId: user.id,
          action: "module_reviewed",
          targetType: "module",
          targetId: params.moduleId,
          metadata: JSON.stringify({ status: params.status, score: params.score, note: params.note }),
        });

        if (mod.assigneeId) {
          await db.insert(notifications).values({
            userId: mod.assigneeId,
            type: "module_review",
            title: params.status === "approved" ? "Module Approved ✅" : "Changes Requested ❌",
            body: `${user.name} reviewed your module. Score: ${params.score}. ${params.note || ""}`,
            link: `/modules/${params.moduleId}`,
          });
        }
        return ok({ moduleId: params.moduleId, newStatus });
      }

      case "list_reviews": {
        if (!params.targetType || !params.targetId) return badRequest("Missing targetType or targetId");
        const data = await db.query.reviews.findMany({
          where: and(
            eq(reviews.targetType, params.targetType),
            eq(reviews.targetId, params.targetId)
          ),
          orderBy: (r, { desc }) => [desc(r.createdAt)],
          with: {
            reviewer: {
              columns: { id: true, name: true, image: true },
            },
          },
        });
        return ok(data);
      }

      case "get_latest_review": {
        if (!params.targetType || !params.targetId) return badRequest("Missing targetType or targetId");
        const latest = await db.query.reviews.findFirst({
          where: and(
            eq(reviews.targetType, params.targetType),
            eq(reviews.targetId, params.targetId)
          ),
          orderBy: (r, { desc }) => [desc(r.createdAt)],
          with: {
            reviewer: {
              columns: { id: true, name: true, image: true },
            },
          },
        });
        return ok(latest || null);
      }

      // =================
      // NOTIFICATIONS
      // =================
      case "get_notifications": {
        const data = await db.query.notifications.findMany({
          where: eq(notifications.userId, user.id),
          orderBy: (n, { desc }) => [desc(n.createdAt)],
          limit: 50,
        });
        return ok(data);
      }

      case "mark_notification_read": {
        if (params.notificationId) {
          await db.update(notifications).set({ isRead: true }).where(eq(notifications.id, params.notificationId));
        } else {
          // Mark all as read
          await db.update(notifications).set({ isRead: true }).where(
            and(eq(notifications.userId, user.id), eq(notifications.isRead, false))
          );
        }
        return ok({ done: true });
      }

      // =================
      // DASHBOARD
      // =================
      case "get_dashboard": {
        const [projectCount] = await db.select({ count: sql<number>`count(*)` }).from(projects);
        const [moduleCount] = await db.select({ count: sql<number>`count(*)` }).from(modules);
        const [taskCount] = await db.select({ count: sql<number>`count(*)` }).from(tasks);
        const [userCount] = await db.select({ count: sql<number>`count(*)` }).from(users);
        return ok({
          projects: Number(projectCount.count),
          modules: Number(moduleCount.count),
          tasks: Number(taskCount.count),
          users: Number(userCount.count),
        });
      }

      case "get_leaderboard": {
        const period = params.period || "month";
        const now = new Date();
        let cutoffDate: Date | null = null;

        if (period === "today") {
          cutoffDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        } else if (period === "week") {
          cutoffDate = new Date(now);
          cutoffDate.setDate(cutoffDate.getDate() - 7);
        } else if (period === "month") {
          cutoffDate = new Date(now);
          cutoffDate.setDate(cutoffDate.getDate() - 30);
        }

        const results = await db
          .select({
            userId: users.id,
            name: users.name,
            username: users.username,
            reviewPoints: sql<number>`CAST(COALESCE(SUM(CASE WHEN ${scoreEvents.eventType} IN ('module_done','module_early','module_late','task_done','task_early','task_late') THEN ${scoreEvents.points} ELSE 0 END), 0) AS INTEGER)`,
            autoPoints: sql<number>`CAST(COALESCE(SUM(CASE WHEN ${scoreEvents.eventType} IN ('comment','commit','doc_approved') THEN ${scoreEvents.points} ELSE 0 END), 0) AS INTEGER)`,
            totalBasePoints: sql<number>`CAST(COALESCE(SUM(${scoreEvents.points}), 0) AS INTEGER)`,
          })
          .from(users)
          .leftJoin(
            scoreEvents,
            cutoffDate
              ? and(eq(users.id, scoreEvents.userId), gte(scoreEvents.createdAt, cutoffDate))
              : eq(users.id, scoreEvents.userId)
          )
          .groupBy(users.id, users.name, users.username)
          .orderBy(desc(sql`SUM(${scoreEvents.points})`));

        const periodDays = period === "today" ? 1 : period === "week" ? 7 : period === "month" ? 30 : 365;

        const enrichedResults = await Promise.all(
          results.map(async (u) => {
            const logs = await db.query.userActivityLog.findMany({
              where: eq(userActivityLog.userId, u.userId),
              columns: { activityDate: true, actionCount: true },
            });
            const tempo = calculateTempoBonus(logs, periodDays);
            const streak = getCurrentStreak(logs);
            const totalPoints = u.totalBasePoints + tempo.total;
            return {
              userId: u.userId,
              name: u.name,
              username: u.username,
              reviewPoints: u.reviewPoints,
              autoPoints: u.autoPoints,
              tempoBonus: tempo.total,
              totalPoints,
              streak,
            };
          })
        );

        return ok(
          enrichedResults
            .filter(u => u.totalPoints > 0)
            .sort((a, b) => b.totalPoints - a.totalPoints)
            .slice(0, 20)
        );
      }

      case "get_my_rank": {
        const period = params.period || "month";
        const periodDays = period === "today" ? 1 : period === "week" ? 7 : period === "month" ? 30 : 365;

        const myActivityLogs = await db.query.userActivityLog.findMany({
          where: eq(userActivityLog.userId, user.id),
          columns: { activityDate: true, actionCount: true },
        });

        const tempo = calculateTempoBonus(myActivityLogs, periodDays);
        const streak = getCurrentStreak(myActivityLogs);

        const now = new Date();
        let cutoffDate: Date | null = null;
        if (period === "today") {
          cutoffDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        } else if (period === "week") {
          cutoffDate = new Date(now);
          cutoffDate.setDate(cutoffDate.getDate() - 7);
        } else if (period === "month") {
          cutoffDate = new Date(now);
          cutoffDate.setDate(cutoffDate.getDate() - 30);
        }

        const myScores = await db
          .select({
            total: sql<number>`CAST(COALESCE(SUM(${scoreEvents.points}), 0) AS INTEGER)`,
          })
          .from(scoreEvents)
          .where(
            cutoffDate
              ? and(eq(scoreEvents.userId, user.id), gte(scoreEvents.createdAt, cutoffDate))
              : eq(scoreEvents.userId, user.id)
          );

        const basePoints = myScores[0]?.total ?? 0;
        const totalPoints = basePoints + tempo.total;

        // Last 7 days activity
        const dailyActivity = [];
        for (let i = 6; i >= 0; i--) {
          const d = new Date(now);
          d.setDate(d.getDate() - i);
          const dateStr = d.toISOString().split("T")[0];
          const log = myActivityLogs.find(l => l.activityDate === dateStr);
          dailyActivity.push({
            date: dateStr,
            day: d.toLocaleDateString("en", { weekday: "short" }),
            actions: log?.actionCount ?? 0,
          });
        }

        return ok({
          totalPoints,
          tempoBonus: tempo.total,
          streak,
          dailyActivity,
        });
      }

      case "get_active_projects": {
        const activeProjects = await db.query.projects.findMany({
          where: eq(projects.status, "active"),
          orderBy: (p, { desc }) => [desc(p.updatedAt)],
          with: {
            chairman: { columns: { id: true, name: true, email: true, role: true } },
            members: { with: { user: { columns: { id: true, name: true, email: true, role: true } } } },
            modules: { columns: { id: true, status: true } },
          },
        });

        return ok(activeProjects.map(project => {
          const totalModules = project.modules.length;
          const doneModules = project.modules.filter(m => m.status === "done").length;
          const progressPct = totalModules === 0 ? 0 : Math.round((doneModules / totalModules) * 100);
          return {
            id: project.id,
            title: project.title,
            status: project.status,
            deadline: project.deadline,
            progressPct,
            members: project.members.map(m => m.user),
            chairman: project.chairman,
          };
        }));
      }

      case "get_project_progress": {
        const allProjects = await db.query.projects.findMany({
          where: eq(projects.status, "active"),
          columns: { id: true, title: true },
        });

        const result = [];
        for (const p of allProjects) {
          const mods = await db.query.modules.findMany({
            where: eq(modules.projectId, p.id),
            columns: { status: true },
          });
          const total = mods.length;
          const done = mods.filter(m => m.status === "done").length;
          const shortName = p.title.length > 20 ? p.title.slice(0, 17) + "..." : p.title;
          result.push({
            name: shortName,
            done,
            pending: total - done,
            total,
            pct: total > 0 ? Math.round((done / total) * 100) : 0,
          });
        }
        return ok(result);
      }

      // =================
      // USERS (limited)
      // =================
      case "get_users": {
        const data = await db.query.users.findMany({
          columns: { id: true, name: true, email: true, role: true },
          orderBy: (u, { asc }) => [asc(u.name)],
        });
        return ok(data);
      }

      case "get_me": {
        return ok({
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        });
      }

      // =================
      default:
        return badRequest(`Unknown action: ${action}. Use get_projects, get_modules, create_module, add_comment, upload_document, get_leaderboard, etc.`);
    }
  } catch (error: any) {
    console.error(`[MCP API] Error in action "${action}":`, error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
