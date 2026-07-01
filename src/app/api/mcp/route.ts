import { NextRequest, NextResponse } from "next/server";
import { differenceInCalendarDays } from "date-fns";
import { db } from "@/server/db";
import { users } from "@drizzle/schema/users";
import { projects, projectMembers } from "@drizzle/schema/projects";
import { modules } from "@drizzle/schema/modules";
import { tasks } from "@drizzle/schema/tasks";
import { businessUnits } from "@drizzle/schema/business-units";
import { taskAssignees } from "@drizzle/schema/task-assignees";
import { comments } from "@drizzle/schema/comments";
import { documents } from "@drizzle/schema/documents";
import { scoreEvents, reviewScores, userActivityLog } from "@drizzle/schema/scoring";
import { activityLogs, notifications } from "@drizzle/schema/notifications";
import { githubCommits } from "@drizzle/schema/github";
import { reviews } from "@drizzle/schema/reviews";
import { kpiPeriods, kpiScores } from "@drizzle/schema/kpi";
import { costItems, buRevenues } from "@drizzle/schema/finance";
import { eq, and, or, sql, desc, inArray, gte } from "drizzle-orm";
import { nextId } from "@/lib/id-gen";
import { s3Client, MINIO_BUCKET, getPublicUrl, ensureBucket } from "@/lib/minio";
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

function ok(data: unknown) {
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let body: Record<string, any>;
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

        // Auto-create project group conversation
        try {
          const { conversations, conversationParticipants, messages: chatMessages } = await import("@drizzle/schema/chat");
          const { chatEmitter } = await import("@/lib/events");
          const convId = crypto.randomUUID();
          await db.insert(conversations).values({
            id: convId,
            type: "project",
            title: `📁 ${params.title}`,
            projectId: newId,
            createdBy: user.id,
          });
          const participantValues = Array.from(memberIds).map((uid) => ({
            id: crypto.randomUUID(),
            conversationId: convId,
            userId: uid,
            role: uid === user.id ? "admin" as const : "member" as const,
          }));
          if (participantValues.length > 0) {
            await db.insert(conversationParticipants).values(participantValues);
          }
          await db.insert(chatMessages).values({
            id: crypto.randomUUID(),
            conversationId: convId,
            senderId: null,
            content: `Nhóm chat đã được tạo tự động cho dự án "${params.title}"`,
            messageType: "system",
          });
          chatEmitter.emit("conv_joined", { conversationId: convId });
        } catch (err) {
          console.error("[MCP create_project] Chat conv creation failed:", err);
        }

        return ok(project);
      }

      case "update_project": {
        if (!params.projectId) return badRequest("Missing projectId");
        const updates: Record<string, unknown> = { updatedAt: new Date() };
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
        if (!params.projectId || !params.userId) return badRequest("Missing projectId or userId");
        const [member] = await db.insert(projectMembers)
          .values({ projectId: params.projectId, userId: params.userId })
          .onConflictDoNothing()
          .returning();
        return ok(member || { already_member: true });
      }

      case "remove_project_member": {
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
        await import("@drizzle/schema/users");
        const allMappings = await db.query.userGithubMap.findMany();
        const usernameToUserId = new Map(allMappings.map(m => [m.githubUsername.toLowerCase(), m.userId]));

        const commitValues = (apiCommits as Array<{
          sha: string;
          commit?: { message?: string; author?: { name?: string; date?: string } };
          author?: { login?: string };
        }>).map((c) => ({
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
            project: { columns: { id: true, title: true } },
          },
        });
        return ok(data);
      }

      case "get_my_modules": {
        const data = await db.query.modules.findMany({
          where: eq(modules.createdBy, user.id),
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
          createdBy: user.id,
        }).returning();
        return ok(mod);
      }

      case "update_module": {
        if (!params.moduleId) return badRequest("Missing moduleId");
        const updates: Record<string, unknown> = { updatedAt: new Date() };
        if (params.title) updates.title = params.title;
        if (params.description !== undefined) updates.description = params.description;
        if (params.checklist !== undefined) updates.checklist = params.checklist;
        const [updated] = await db.update(modules).set(updates).where(eq(modules.id, params.moduleId)).returning();
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
        if (!params.projectId || !params.title) return badRequest("Missing projectId or title");
        const newId = await nextId("TASK", db);
        const [task] = await db.insert(tasks).values({
          id: newId,
          projectId: params.projectId,
          moduleId: params.moduleId || null,
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
        const updates: Record<string, unknown> = { updatedAt: new Date() };
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
      // BUSINESS UNITS
      // =================
      case "get_bu_status": {
        const bus = await db.query.businessUnits.findMany({
          orderBy: (bu, { asc }) => [asc(bu.code)],
          with: { lead: { columns: { id: true, name: true, image: true } } },
        });

        const now = new Date();
        const result = [];

        for (const bu of bus) {
          const rows = await db.query.tasks.findMany({
            where: eq(tasks.buId, bu.id),
            columns: {
              id: true, status: true, ivp: true, deadline: true, blockedSince: true,
            },
          });

          const totalIvp = rows.reduce((s, t) => s + (t.ivp ?? 0), 0);
          const doneIvp = rows
            .filter((t) => t.status === "done")
            .reduce((s, t) => s + (t.ivp ?? 0), 0);
          const openTasks = rows.filter((t) => t.status !== "done");
          const overdue = openTasks.filter((t) => t.deadline && t.deadline < now).length;
          const blockers = rows.filter((t) => t.status === "blocked");
          const staleBlockers = blockers.filter(
            (t) => t.blockedSince && differenceInCalendarDays(now, t.blockedSince) > 3
          ).length;

          const progressPct = totalIvp > 0 ? Math.round((doneIvp / totalIvp) * 100) : 0;
          const overdueRatio = openTasks.length > 0 ? overdue / openTasks.length : 0;

          let health: "green" | "yellow" | "red" = "green";
          if (overdueRatio > 0.2 || staleBlockers > 0) health = "red";
          else if (overdueRatio > 0 || blockers.length > 0) health = "yellow";

          result.push({
            id: bu.id,
            code: bu.code,
            name: bu.name,
            lead: bu.lead,
            progressPct,
            totalTasks: rows.length,
            openTasks: openTasks.length,
            overdue,
            blockers: blockers.length,
            staleBlockers,
            health,
          });
        }
        return ok(result);
      }

      case "get_blockers": {
        const rows = await db.query.tasks.findMany({
          where: eq(tasks.status, "blocked"),
          columns: {
            id: true, title: true, buId: true, assigneeId: true,
            blockedReason: true, blockedBy: true, blockedSince: true, priority: true,
          },
          with: {
            bu: { columns: { code: true } },
            assignee: { columns: { id: true, name: true } },
          },
        });
        const now = Date.now();
        const result = rows
          .map((t) => ({
            taskId: t.id,
            title: t.title,
            buCode: t.bu?.code ?? null,
            assignee: t.assignee,
            blockedReason: t.blockedReason,
            blockedBy: t.blockedBy,
            priority: t.priority,
            daysBlocked: t.blockedSince
              ? differenceInCalendarDays(now, t.blockedSince)
              : 0,
          }))
          .sort((a, b) => b.daysBlocked - a.daysBlocked);
        return ok(result);
      }

      case "set_task_blocker": {
        if (!params.taskId || !params.reason) return badRequest("Missing taskId or reason");
        const existing = await db.query.tasks.findFirst({
          where: eq(tasks.id, params.taskId),
          columns: { id: true },
        });
        if (!existing) return badRequest("Task not found");
        const [updated] = await db.update(tasks)
          .set({
            status: "blocked",
            blockedReason: params.reason,
            blockedBy: params.blockedBy || null,
            blockedSince: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(tasks.id, params.taskId))
          .returning();
        return ok(updated);
      }

      case "assign_task_multi": {
        if (!params.taskId || !Array.isArray(params.userIds) || params.userIds.length === 0)
          return badRequest("Missing taskId or userIds");
        const task = await db.query.tasks.findFirst({
          where: eq(tasks.id, params.taskId),
          columns: { id: true, assigneeId: true },
        });
        if (!task) return badRequest("Task not found");

        const userIds: string[] = params.userIds;
        await db.insert(taskAssignees)
          .values(userIds.map((uid) => ({
            taskId: params.taskId,
            userId: uid,
            addedBy: user.id,
          })))
          .onConflictDoNothing();

        // Set primary assignee if none yet
        if (!task.assigneeId) {
          await db.update(tasks)
            .set({ assigneeId: userIds[0], updatedAt: new Date() })
            .where(eq(tasks.id, params.taskId));
        }

        const assignees = await db.query.taskAssignees.findMany({
          where: eq(taskAssignees.taskId, params.taskId),
          with: { user: { columns: { id: true, name: true, email: true } } },
        });
        return ok({ taskId: params.taskId, assignees: assignees.map((a) => a.user) });
      }

      case "add_subtask": {
        if (!params.parentTaskId || !params.title) return badRequest("Missing parentTaskId or title");
        const parent = await db.query.tasks.findFirst({
          where: eq(tasks.id, params.parentTaskId),
          columns: { id: true, buId: true, projectId: true, moduleId: true },
        });
        if (!parent) return badRequest("Parent task not found");

        const newId = await nextId("TASK", db);
        const [subtask] = await db.insert(tasks).values({
          id: newId,
          parentTaskId: parent.id,
          buId: parent.buId,
          projectId: parent.projectId,
          moduleId: parent.moduleId,
          title: params.title,
          description: params.description,
          createdBy: user.id,
        }).returning();

        if (Array.isArray(params.assigneeIds) && params.assigneeIds.length > 0) {
          const assigneeIds: string[] = params.assigneeIds;
          await db.insert(taskAssignees)
            .values(assigneeIds.map((uid) => ({
              taskId: newId,
              userId: uid,
              addedBy: user.id,
            })))
            .onConflictDoNothing();
          await db.update(tasks)
            .set({ assigneeId: assigneeIds[0], updatedAt: new Date() })
            .where(eq(tasks.id, newId));
        }
        return ok(subtask);
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

        // Ensure bucket exists before uploading
        await ensureBucket();

        // Upload to S3/MinIO
        await s3Client.send(new PutObjectCommand({
          Bucket: MINIO_BUCKET,
          Key: s3Key,
          Body: fileBuffer,
          ContentType: contentType,
        }));

        const url = getPublicUrl(s3Key);
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

        if (params.status === "approved" && mod.createdBy) {
          await db.insert(scoreEvents).values({
            userId: mod.createdBy,
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

        if (mod.createdBy) {
          await db.insert(notifications).values({
            userId: mod.createdBy,
            type: "module_review",
            title: params.status === "approved" ? "Module Approved ✅" : "Changes Requested ❌",
            body: `${user.name} reviewed your module. Score: ${params.score}. ${params.note || ""}`,
            link: `/modules/${params.moduleId}`,
          });
        }
        return ok({ moduleId: params.moduleId, status: params.status });
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
            tasks: { columns: { id: true, status: true } },
          },
        });

        return ok(activeProjects.map(project => {
          const totalTasks = project.tasks.length;
          const doneTasks = project.tasks.filter(t => t.status === "done").length;
          const progressPct = totalTasks === 0 ? 0 : Math.round((doneTasks / totalTasks) * 100);
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
          const projectTasks = await db.query.tasks.findMany({
            where: eq(tasks.projectId, p.id),
            columns: { status: true },
          });
          const total = projectTasks.length;
          const done = projectTasks.filter(t => t.status === "done").length;
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
      // CHAT
      // =================
      case "list_conversations": {
        const { conversations, conversationParticipants, messages } = await import("@drizzle/schema/chat");
        // Get user's conversation IDs
        const myConvs = await db.query.conversationParticipants.findMany({
          where: eq(conversationParticipants.userId, user.id),
          columns: { conversationId: true, lastReadAt: true },
        });
        if (myConvs.length === 0) return ok([]);

        const convIds = myConvs.map(c => c.conversationId);
        const convData = await db.query.conversations.findMany({
          where: inArray(conversations.id, convIds),
          orderBy: (c, { desc }) => [desc(c.lastMessageAt)],
        });

        // Enrich with participants and unread counts
        const result = await Promise.all(convData.map(async (conv) => {
          const participants = await db.query.conversationParticipants.findMany({
            where: eq(conversationParticipants.conversationId, conv.id),
            with: { user: { columns: { id: true, name: true } } },
          });
          const myEntry = myConvs.find(c => c.conversationId === conv.id);
          const unreadConditions = [eq(messages.conversationId, conv.id), eq(messages.isDeleted, false)];
          if (myEntry?.lastReadAt) {
            const { gt } = await import("drizzle-orm");
            unreadConditions.push(gt(messages.createdAt, myEntry.lastReadAt));
          }
          const [unreadResult] = await db.select({ count: sql<number>`count(*)` }).from(messages).where(and(...unreadConditions));
          return {
            id: conv.id,
            type: conv.type,
            title: conv.title,
            lastMessageAt: conv.lastMessageAt,
            lastMessagePreview: conv.lastMessagePreview,
            participants: participants.map(p => ({ id: p.user.id, name: p.user.name, role: p.role })),
            unreadCount: Number(unreadResult?.count ?? 0),
          };
        }));
        return ok(result);
      }

      case "read_chat_messages": {
        if (!params.conversationId) return badRequest("Missing conversationId");
        const { conversationParticipants, messages } = await import("@drizzle/schema/chat");
        // Verify participant
        const isParticipant = await db.query.conversationParticipants.findFirst({
          where: and(eq(conversationParticipants.conversationId, params.conversationId), eq(conversationParticipants.userId, user.id)),
        });
        if (!isParticipant) return forbidden("Not a participant of this conversation");

        const limit = Math.min(params.limit || 20, 50);
        const msgs = await db.query.messages.findMany({
          where: and(eq(messages.conversationId, params.conversationId), eq(messages.isDeleted, false)),
          orderBy: (m, { desc }) => [desc(m.createdAt)],
          limit,
          with: {
            sender: { columns: { id: true, name: true } },
          },
        });
        // Mark as read
        await db.update(conversationParticipants).set({ lastReadAt: new Date() }).where(
          and(eq(conversationParticipants.conversationId, params.conversationId), eq(conversationParticipants.userId, user.id))
        );
        return ok(msgs.map(m => ({
          id: m.id,
          content: m.content,
          messageType: m.messageType,
          sender: m.sender,
          createdAt: m.createdAt,
          isEdited: m.isEdited,
        })));
      }

      case "send_chat_message": {
        if (!params.conversationId || !params.content) return badRequest("Missing conversationId or content");
        const { conversationParticipants, messages, conversations } = await import("@drizzle/schema/chat");
        const { chatEmitter } = await import("@/lib/events");
        // Verify participant
        const isParticipant = await db.query.conversationParticipants.findFirst({
          where: and(eq(conversationParticipants.conversationId, params.conversationId), eq(conversationParticipants.userId, user.id)),
        });
        if (!isParticipant) return forbidden("Not a participant of this conversation");

        // Sanitize content
        const content = params.content.replace(/</g, "&lt;").replace(/>/g, "&gt;");
        const preview = content.length > 100 ? content.slice(0, 97) + "..." : content;

        const [msg] = await db.insert(messages).values({
          id: crypto.randomUUID(),
          conversationId: params.conversationId,
          senderId: user.id,
          content,
          messageType: "text",
        }).returning();

        // Update conversation cache
        await db.update(conversations).set({
          lastMessageAt: new Date(),
          lastMessagePreview: preview,
          updatedAt: new Date(),
        }).where(eq(conversations.id, params.conversationId));

        // Emit SSE event
        chatEmitter.emit("new_message", {
          conversationId: params.conversationId,
          messageId: msg.id,
          senderId: user.id,
          senderName: user.name,
          preview,
        });

        return ok({ messageId: msg.id, content, createdAt: msg.createdAt });
      }

      case "search_chat": {
        if (!params.conversationId || !params.query) return badRequest("Missing conversationId or query");
        const { conversationParticipants, messages } = await import("@drizzle/schema/chat");
        const { ilike } = await import("drizzle-orm");
        // Verify participant
        const isParticipant = await db.query.conversationParticipants.findFirst({
          where: and(eq(conversationParticipants.conversationId, params.conversationId), eq(conversationParticipants.userId, user.id)),
        });
        if (!isParticipant) return forbidden("Not a participant of this conversation");

        const escapedQuery = params.query.replace(/%/g, '\\%').replace(/_/g, '\\_');

        const results = await db.query.messages.findMany({
          where: and(
            eq(messages.conversationId, params.conversationId),
            eq(messages.isDeleted, false),
            ilike(messages.content, `%${escapedQuery}%`)
          ),
          orderBy: (m, { desc }) => [desc(m.createdAt)],
          limit: 20,
          with: {
            sender: { columns: { id: true, name: true } },
          },
        });
        return ok(results.map(m => ({
          id: m.id,
          content: m.content,
          sender: m.sender,
          createdAt: m.createdAt,
        })));
      }

      // =================
      // KPI & FINANCE
      // =================
      case "get_kpi_scores": {
        // Resolve period: explicit periodId, else latest (by quarter desc).
        let periodId: string | undefined = params.periodId;
        if (!periodId) {
          const [latest] = await db
            .select({ id: kpiPeriods.id, quarter: kpiPeriods.quarter })
            .from(kpiPeriods)
            .orderBy(desc(kpiPeriods.quarter))
            .limit(1);
          if (!latest) return ok({ periodId: null, scores: [] });
          periodId = latest.id;
        }

        const rows = await db
          .select({
            id: kpiScores.id,
            userId: kpiScores.userId,
            userName: users.name,
            userImage: users.image,
            tempoScore: kpiScores.tempoScore,
            completionScore: kpiScores.completionScore,
            qualityScore: kpiScores.qualityScore,
            aiScore: kpiScores.aiScore,
            compositeScore: kpiScores.compositeScore,
            status: kpiScores.status,
            note: kpiScores.note,
            updatedAt: kpiScores.updatedAt,
          })
          .from(kpiScores)
          .innerJoin(users, eq(kpiScores.userId, users.id))
          .where(eq(kpiScores.periodId, periodId))
          .orderBy(sql`${kpiScores.compositeScore} desc`);

        return ok({ periodId, scores: rows });
      }

      case "get_my_kpi": {
        let periodId: string | undefined = params.periodId;
        if (!periodId) {
          const [latest] = await db
            .select({ id: kpiPeriods.id })
            .from(kpiPeriods)
            .orderBy(desc(kpiPeriods.quarter))
            .limit(1);
          if (!latest) return ok(null);
          periodId = latest.id;
        }

        const [row] = await db
          .select({
            id: kpiScores.id,
            userId: kpiScores.userId,
            periodId: kpiScores.periodId,
            tempoScore: kpiScores.tempoScore,
            completionScore: kpiScores.completionScore,
            qualityScore: kpiScores.qualityScore,
            aiScore: kpiScores.aiScore,
            compositeScore: kpiScores.compositeScore,
            status: kpiScores.status,
            note: kpiScores.note,
            updatedAt: kpiScores.updatedAt,
          })
          .from(kpiScores)
          .where(and(eq(kpiScores.userId, user.id), eq(kpiScores.periodId, periodId)))
          .limit(1);

        return ok(row ?? null);
      }

      case "get_cover_ratio": {
        // Reproduce finance.coverRatio. DB stores VND; return in triệu VND.
        const toMil = (vnd: number) => Math.round(vnd / 1_000_000);
        const COVER_TARGET = 1.05;
        const coverHealth = (r: number): "green" | "yellow" | "red" =>
          r >= COVER_TARGET ? "green" : r >= 1.0 ? "yellow" : "red";

        const costs = await db.select().from(costItems);
        const revs = await db.select().from(buRevenues);

        const costMonthVnd = costs.reduce((s, c) => s + c.amountVnd, 0);
        const cost24Vnd = costMonthVnd * 24;

        const totalRevVnd = revs.reduce((s, r) => s + r.amountVnd, 0);
        const months = new Set(revs.map((r) => r.month)).size;
        const monthsCount = Math.max(months, 1);
        const revAvgMonthVnd = totalRevVnd / monthsCount;
        const rev24Vnd = revAvgMonthVnd * 24;

        const ratio = cost24Vnd > 0 ? rev24Vnd / cost24Vnd : 0;
        return ok({
          cost24: toMil(cost24Vnd),
          rev24: toMil(rev24Vnd),
          ratio: Math.round(ratio * 1000) / 1000,
          diff: toMil(rev24Vnd - cost24Vnd),
          health: coverHealth(ratio),
          monthsWithData: monthsCount,
          target: COVER_TARGET,
        });
      }

      case "get_bu_finance": {
        // Reproduce finance.buProfit. Return amounts in triệu VND.
        const toMil = (vnd: number) => Math.round(vnd / 1_000_000);

        const bus = await db.select().from(businessUnits);
        const revs = await db.select().from(buRevenues);
        const costs = await db.select().from(costItems);

        const totalCostVnd = costs.reduce((s, c) => s + c.amountVnd, 0);

        const revByBu = new Map<string, number>();
        for (const r of revs) {
          revByBu.set(r.buId, (revByBu.get(r.buId) ?? 0) + r.amountVnd);
        }
        const totalRevVnd = [...revByBu.values()].reduce((s, v) => s + v, 0);
        const buCount = Math.max(bus.length, 1);

        const result = bus.map((bu) => {
          const revenueVnd = revByBu.get(bu.id) ?? 0;
          const share = totalRevVnd > 0 ? revenueVnd / totalRevVnd : 1 / buCount;
          const costVnd = totalCostVnd * share;
          return {
            buCode: bu.code,
            revenue: toMil(revenueVnd),
            cost: toMil(costVnd),
            profit: toMil(revenueVnd - costVnd),
          };
        });
        return ok(result);
      }

      // =================
      default:
        return badRequest(`Unknown action: ${action}. Use get_projects, get_modules, create_module, add_comment, upload_document, get_leaderboard, list_conversations, send_chat_message, get_kpi_scores, get_cover_ratio, etc.`);
    }
  } catch (error: unknown) {
    console.error(`[MCP API] Error in action "${action}":`, error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
