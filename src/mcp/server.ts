#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";

// ==========================================
// HTTP Client — calls production REST API
// ==========================================
const API_URL = process.env.LIBE_API_URL || "http://localhost:3000";
const API_KEY = process.env.LIBE_API_KEY || "";

async function callAPI(action: string, params: Record<string, unknown> = {}) {
  if (!API_KEY) {
    throw new McpError(ErrorCode.InvalidRequest, "LIBE_API_KEY environment variable is not set.");
  }

  const res = await fetch(`${API_URL}/api/mcp`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ action, ...params }),
  });

  const json = await res.json();

  if (!res.ok || json.error) {
    throw new McpError(
      ErrorCode.InternalError,
      json.error || `API error: ${res.status}`
    );
  }

  return json.data;
}

// ==========================================
// MCP Server
// ==========================================
const server = new Server(
  { name: "libe-aios-mcp", version: "2.0.0" },
  { capabilities: { tools: {} } }
);

// ==========================================
// Tool Definitions
// ==========================================
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      // ---- PROJECTS ----
      {
        name: "get_projects",
        description: "List all projects in the AI Together system with their members and status.",
        inputSchema: { type: "object", properties: {} },
      },
      {
        name: "get_project",
        description: "Get detailed info about a specific project by its ID.",
        inputSchema: {
          type: "object",
          properties: { projectId: { type: "string", description: "Project ID (e.g. PROJ-001)" } },
          required: ["projectId"],
        },
      },
      {
        name: "create_project",
        description: "Create a new project. Any user can create. The project manager defaults to the system Chairman if not specified.",
        inputSchema: {
          type: "object",
          properties: {
            title: { type: "string", description: "Project title" },
            description: { type: "string", description: "Project description" },
            managerId: { type: "string", description: "Optional: User ID for Project Manager" },
            deadline: { type: "string", description: "Optional: Deadline date (YYYY-MM-DD)" },
          },
          required: ["title"],
        },
      },
      {
        name: "update_project",
        description: "Update project details like title, description, status, or GitHub repo link. Chairman/Admin only.",
        inputSchema: {
          type: "object",
          properties: {
            projectId: { type: "string" },
            title: { type: "string" },
            description: { type: "string" },
            status: { type: "string", enum: ["planning", "active", "on_hold", "completed", "cancelled"] },
            githubOwner: { type: "string" },
            githubRepo: { type: "string" },
            deadline: { type: "string" },
          },
          required: ["projectId"],
        },
      },
      {
        name: "delete_project",
        description: "Permanently delete a project and all its modules, tasks, comments, and commits. Chairman/Admin only.",
        inputSchema: {
          type: "object",
          properties: { projectId: { type: "string" } },
          required: ["projectId"],
        },
      },
      {
        name: "add_project_member",
        description: "Add a user to a project's team. Chairman/Admin only.",
        inputSchema: {
          type: "object",
          properties: {
            projectId: { type: "string" },
            userId: { type: "string", description: "User ID to add" },
          },
          required: ["projectId", "userId"],
        },
      },
      {
        name: "remove_project_member",
        description: "Remove a user from a project's team. Chairman/Admin only.",
        inputSchema: {
          type: "object",
          properties: {
            projectId: { type: "string" },
            userId: { type: "string" },
          },
          required: ["projectId", "userId"],
        },
      },
      {
        name: "sync_github_commits",
        description: "Sync latest commits from the linked GitHub repository into the system.",
        inputSchema: {
          type: "object",
          properties: { projectId: { type: "string" } },
          required: ["projectId"],
        },
      },

      // ---- MODULES ----
      {
        name: "get_modules",
        description: "List all modules in a project with their assignees and status.",
        inputSchema: {
          type: "object",
          properties: { projectId: { type: "string" } },
          required: ["projectId"],
        },
      },
      {
        name: "get_my_modules",
        description: "List all modules assigned to the current user.",
        inputSchema: { type: "object", properties: {} },
      },
      {
        name: "get_module",
        description: "Get detailed info about a specific module.",
        inputSchema: {
          type: "object",
          properties: { moduleId: { type: "string", description: "Module ID (e.g. MOD-001)" } },
          required: ["moduleId"],
        },
      },
      {
        name: "create_module",
        description: "Create a new module in a project.",
        inputSchema: {
          type: "object",
          properties: {
            projectId: { type: "string" },
            title: { type: "string", description: "Module title" },
            description: { type: "string", description: "Module description" },
            assigneeId: { type: "string", description: "Optional: User ID to assign" },
            deadline: { type: "string", description: "Optional: Deadline (YYYY-MM-DD)" },
          },
          required: ["projectId", "title"],
        },
      },
      {
        name: "update_module",
        description: "Update module details like title, description, assignee, or deadline.",
        inputSchema: {
          type: "object",
          properties: {
            moduleId: { type: "string" },
            title: { type: "string" },
            description: { type: "string" },
            assigneeId: { type: "string" },
            deadline: { type: "string" },
          },
          required: ["moduleId"],
        },
      },
      {
        name: "update_module_status",
        description: "Change module status: planned, in_progress, in_review, changes_requested, done.",
        inputSchema: {
          type: "object",
          properties: {
            moduleId: { type: "string" },
            status: { type: "string", enum: ["planned", "in_progress", "in_review", "changes_requested", "done"] },
          },
          required: ["moduleId", "status"],
        },
      },
      {
        name: "delete_module",
        description: "Delete a module and all its tasks, comments, and documents.",
        inputSchema: {
          type: "object",
          properties: { moduleId: { type: "string" } },
          required: ["moduleId"],
        },
      },

      // ---- TASKS ----
      {
        name: "get_tasks",
        description: "List all tasks in a module.",
        inputSchema: {
          type: "object",
          properties: { moduleId: { type: "string" } },
          required: ["moduleId"],
        },
      },
      {
        name: "get_my_tasks",
        description: "List all tasks assigned to the current user across all modules.",
        inputSchema: { type: "object", properties: {} },
      },
      {
        name: "create_task",
        description: "Create a new task in a module.",
        inputSchema: {
          type: "object",
          properties: {
            moduleId: { type: "string" },
            title: { type: "string" },
            description: { type: "string" },
            assigneeId: { type: "string", description: "Optional: User ID to assign" },
            deadline: { type: "string" },
          },
          required: ["moduleId", "title"],
        },
      },
      {
        name: "update_task",
        description: "Update task details.",
        inputSchema: {
          type: "object",
          properties: {
            taskId: { type: "string" },
            title: { type: "string" },
            description: { type: "string" },
            assigneeId: { type: "string" },
            deadline: { type: "string" },
          },
          required: ["taskId"],
        },
      },
      {
        name: "update_task_status",
        description: "Change task status: todo, in_progress, in_review, done.",
        inputSchema: {
          type: "object",
          properties: {
            taskId: { type: "string" },
            status: { type: "string", enum: ["todo", "in_progress", "in_review", "done"] },
          },
          required: ["taskId", "status"],
        },
      },
      {
        name: "delete_task",
        description: "Delete a task.",
        inputSchema: {
          type: "object",
          properties: { taskId: { type: "string" } },
          required: ["taskId"],
        },
      },
      {
        name: "set_task_blocker",
        description: "Mark a task as blocked with a reason. Sets status to 'blocked' and records who/what it is waiting on and the time it became blocked.",
        inputSchema: {
          type: "object",
          properties: {
            taskId: { type: "string" },
            reason: { type: "string", description: "Why the task is blocked" },
            blockedBy: { type: "string", description: "Optional: who/which BU/external party is blocking it" },
          },
          required: ["taskId", "reason"],
        },
      },
      {
        name: "assign_task_multi",
        description: "Assign a task to multiple users at once (multi-assignee). Adds each user to the task's assignee list; sets the primary assignee if none exists yet.",
        inputSchema: {
          type: "object",
          properties: {
            taskId: { type: "string" },
            userIds: { type: "array", items: { type: "string" }, description: "User IDs to assign" },
          },
          required: ["taskId", "userIds"],
        },
      },
      {
        name: "add_subtask",
        description: "Create a child task (subtask) under a parent task. Inherits the parent's business unit, project, and module. Optionally assigns users.",
        inputSchema: {
          type: "object",
          properties: {
            parentTaskId: { type: "string", description: "Parent task ID" },
            title: { type: "string", description: "Subtask title" },
            description: { type: "string", description: "Optional subtask description" },
            assigneeIds: { type: "array", items: { type: "string" }, description: "Optional: user IDs to assign" },
          },
          required: ["parentTaskId", "title"],
        },
      },

      // ---- BUSINESS UNITS ----
      {
        name: "get_bu_status",
        description: "Get the status dashboard for every business unit (BU): IVP-weighted progress percentage, open task count, overdue count, blocker count, and health indicator (green/yellow/red).",
        inputSchema: { type: "object", properties: {} },
      },
      {
        name: "get_blockers",
        description: "List all blocked tasks across the system, sorted by days blocked (descending). Includes BU code, assignee, blocked reason, and who/what is blocking each task.",
        inputSchema: { type: "object", properties: {} },
      },

      // ---- COMMENTS ----
      {
        name: "get_comments",
        description: "Get all comments on a module or task.",
        inputSchema: {
          type: "object",
          properties: {
            targetType: { type: "string", enum: ["module", "task"] },
            targetId: { type: "string", description: "Module or Task ID" },
          },
          required: ["targetType", "targetId"],
        },
      },
      {
        name: "add_comment",
        description: "Add a comment to a module or task. Supports Markdown. Use **@username** to mention users.",
        inputSchema: {
          type: "object",
          properties: {
            targetType: { type: "string", enum: ["module", "task"] },
            targetId: { type: "string" },
            content: { type: "string", description: "Comment text (Markdown supported)" },
          },
          required: ["targetType", "targetId", "content"],
        },
      },
      {
        name: "delete_comment",
        description: "Delete a comment by its ID.",
        inputSchema: {
          type: "object",
          properties: { commentId: { type: "string" } },
          required: ["commentId"],
        },
      },

      // ---- DOCUMENTS ----
      {
        name: "list_documents",
        description: "List all documents attached to a project, module, or task.",
        inputSchema: {
          type: "object",
          properties: {
            targetType: { type: "string", enum: ["project", "module", "task"] },
            targetId: { type: "string" },
          },
          required: ["targetType", "targetId"],
        },
      },
      {
        name: "attach_link",
        description: "Attach a link (URL) as a document to a project, module, or task.",
        inputSchema: {
          type: "object",
          properties: {
            targetType: { type: "string", enum: ["project", "module", "task"] },
            targetId: { type: "string" },
            title: { type: "string", description: "Document title" },
            url: { type: "string", description: "URL to attach" },
          },
          required: ["targetType", "targetId", "title", "url"],
        },
      },
      {
        name: "delete_document",
        description: "Delete a document by its ID.",
        inputSchema: {
          type: "object",
          properties: { documentId: { type: "string" } },
          required: ["documentId"],
        },
      },
      {
        name: "upload_document",
        description: "Upload a local file as a document to a project, module, or task. The file is read from the local filesystem and uploaded to the server.",
        inputSchema: {
          type: "object",
          properties: {
            targetType: { type: "string", enum: ["project", "module", "task"] },
            targetId: { type: "string" },
            filePath: { type: "string", description: "Absolute path to the local file to upload" },
            contentType: { type: "string", description: "Optional MIME type (auto-detected if omitted)" },
          },
          required: ["targetType", "targetId", "filePath"],
        },
      },

      // ---- REVIEWS (extended) ----
      {
        name: "list_reviews",
        description: "List all reviews for a module or task, with reviewer info and scores.",
        inputSchema: {
          type: "object",
          properties: {
            targetType: { type: "string", enum: ["module", "task"] },
            targetId: { type: "string" },
          },
          required: ["targetType", "targetId"],
        },
      },
      {
        name: "get_latest_review",
        description: "Get the most recent review for a module or task.",
        inputSchema: {
          type: "object",
          properties: {
            targetType: { type: "string", enum: ["module", "task"] },
            targetId: { type: "string" },
          },
          required: ["targetType", "targetId"],
        },
      },

      // ---- DASHBOARD (extended) ----
      {
        name: "get_leaderboard",
        description: "Get the gamification leaderboard with scores, streaks, and tempo bonuses. Top 20 users.",
        inputSchema: {
          type: "object",
          properties: {
            period: { type: "string", enum: ["today", "week", "month", "all"], description: "Time period filter (default: month)" },
          },
        },
      },
      {
        name: "get_my_rank",
        description: "Get the current user's score stats: total points, tempo bonus, streak, and daily activity.",
        inputSchema: {
          type: "object",
          properties: {
            period: { type: "string", enum: ["today", "week", "month", "all"], description: "Time period filter (default: month)" },
          },
        },
      },
      {
        name: "get_active_projects",
        description: "Get all active projects with progress percentage, members, and chairman.",
        inputSchema: { type: "object", properties: {} },
      },
      {
        name: "get_project_progress",
        description: "Get module completion progress for all active projects (done/pending/total counts).",
        inputSchema: { type: "object", properties: {} },
      },

      // ---- REVIEWS ----
      {
        name: "submit_review",
        description: "Submit a review for a module. Approve or request changes, with score and feedback. Chairman/Admin only.",
        inputSchema: {
          type: "object",
          properties: {
            moduleId: { type: "string" },
            status: { type: "string", enum: ["approved", "changes_requested"] },
            score: { type: "number", description: "Score (0-100)" },
            note: { type: "string", description: "Review feedback" },
          },
          required: ["moduleId", "status", "score"],
        },
      },

      // ---- NOTIFICATIONS ----
      {
        name: "get_notifications",
        description: "Get the current user's recent notifications.",
        inputSchema: { type: "object", properties: {} },
      },
      {
        name: "mark_notification_read",
        description: "Mark a notification as read, or mark all as read if no ID is given.",
        inputSchema: {
          type: "object",
          properties: { notificationId: { type: "string", description: "Optional: specific notification ID" } },
        },
      },

      // ---- DASHBOARD ----
      {
        name: "get_dashboard",
        description: "Get system-wide stats: project count, module count, task count, user count.",
        inputSchema: { type: "object", properties: {} },
      },

      // ---- USERS ----
      {
        name: "get_users",
        description: "List all users in the system (names, emails, roles).",
        inputSchema: { type: "object", properties: {} },
      },
      {
        name: "get_me",
        description: "Get the current authenticated user's info.",
        inputSchema: { type: "object", properties: {} },
      },

      // ---- CHAT ----
      {
        name: "list_conversations",
        description: "List all chat conversations the current user is a participant of, with last message preview and unread counts.",
        inputSchema: { type: "object", properties: {} },
      },
      {
        name: "read_chat_messages",
        description: "Read messages from a specific chat conversation. Returns the most recent messages (newest first).",
        inputSchema: {
          type: "object",
          properties: {
            conversationId: { type: "string", description: "Conversation ID to read messages from" },
            limit: { type: "number", description: "Number of messages to return (default: 20, max: 50)" },
          },
          required: ["conversationId"],
        },
      },
      {
        name: "send_chat_message",
        description: "Send a text message to a chat conversation. The user must be a participant of the conversation.",
        inputSchema: {
          type: "object",
          properties: {
            conversationId: { type: "string", description: "Conversation ID to send message to" },
            content: { type: "string", description: "Message text content" },
          },
          required: ["conversationId", "content"],
        },
      },
      {
        name: "search_chat",
        description: "Search messages across a conversation by keyword.",
        inputSchema: {
          type: "object",
          properties: {
            conversationId: { type: "string", description: "Conversation ID to search within" },
            query: { type: "string", description: "Search keyword" },
          },
          required: ["conversationId", "query"],
        },
      },

      // ---- KPI & FINANCE ----
      {
        name: "get_kpi_scores",
        description: "Get the KPI composite scoreboard for everyone in a period (Tempo, Completion, Quality, AIAdoption axes + composite), joined with user names. Uses the latest period if periodId is omitted.",
        inputSchema: {
          type: "object",
          properties: {
            periodId: { type: "string", description: "Optional: KPI period ID. Defaults to the latest quarter." },
          },
        },
      },
      {
        name: "get_my_kpi",
        description: "Get the current user's KPI composite score and its 4 axes (Tempo, Completion, Quality, AIAdoption) for a period. Uses the latest period if periodId is omitted.",
        inputSchema: {
          type: "object",
          properties: {
            periodId: { type: "string", description: "Optional: KPI period ID. Defaults to the latest quarter." },
          },
        },
      },
      {
        name: "get_cover_ratio",
        description: "Get the 24-month cover ratio (the key operational finance metric): 24-month cost, 24-month revenue, ratio, surplus/deficit (diff), and health (green/yellow/red). Amounts are in million VND.",
        inputSchema: { type: "object", properties: {} },
      },
      {
        name: "get_bu_finance",
        description: "Get profit/loss per business unit: revenue, allocated cost (shared cost split by revenue share), and profit. Amounts are in million VND.",
        inputSchema: { type: "object", properties: {} },
      },
    ],
  };
});

// ==========================================
// Tool Execution — proxy to REST API
// ==========================================
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    // Special handling for upload_document: read local file and base64-encode
    if (name === "upload_document") {
      const { filePath, targetType, targetId, contentType } =
        (args as {
          filePath?: string;
          targetType?: string;
          targetId?: string;
          contentType?: string;
        }) || {};
      if (!filePath) {
        return {
          content: [{ type: "text", text: "Error: filePath is required" }],
          isError: true,
        };
      }

      const resolvedPath = path.resolve(filePath);
      if (!fs.existsSync(resolvedPath)) {
        return {
          content: [{ type: "text", text: `Error: File not found: ${resolvedPath}` }],
          isError: true,
        };
      }

      const fileBuffer = fs.readFileSync(resolvedPath);
      const fileBase64 = fileBuffer.toString("base64");
      const filename = path.basename(resolvedPath);

      // Auto-detect content type from extension
      const extMap: Record<string, string> = {
        pdf: "application/pdf",
        doc: "application/msword",
        docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        xls: "application/vnd.ms-excel",
        xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        ppt: "application/vnd.ms-powerpoint",
        pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        png: "image/png",
        jpg: "image/jpeg",
        jpeg: "image/jpeg",
        gif: "image/gif",
        svg: "image/svg+xml",
        zip: "application/zip",
        txt: "text/plain",
        md: "text/markdown",
        json: "application/json",
        csv: "text/csv",
      };
      const ext = filename.split(".").pop()?.toLowerCase() || "";
      const detectedType = contentType || extMap[ext] || "application/octet-stream";

      const result = await callAPI("upload_document", {
        targetType,
        targetId,
        filename,
        contentType: detectedType,
        fileBase64,
      });

      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    }

    const result = await callAPI(name, (args as Record<string, unknown>) || {});
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: "text", text: `Error: ${message}` }],
      isError: true,
    };
  }
});

// ==========================================
// Start
// ==========================================
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`Libe Aios MCP Server v2.0 connected.`);
  console.error(`API URL: ${API_URL}`);
  console.error(`API Key: ${API_KEY ? API_KEY.slice(0, 8) + "..." : "(not set)"}`);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
