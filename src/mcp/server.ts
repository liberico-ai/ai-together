#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";

// Import Libe Aios environment & DB
import { db } from "@/server/db";
import { users } from "@drizzle/schema/users";
import { projects } from "@drizzle/schema/projects";
import { modules } from "@drizzle/schema/modules";
import { scoreEvents, reviewScores } from "@drizzle/schema/scoring";
import { activityLogs, notifications } from "@drizzle/schema/notifications";
import { eq, and } from "drizzle-orm";

const server = new Server(
  {
    name: "libe-aios-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

/**
 * Auth Middleware
 * Verifies the LIBE_API_KEY environment variable against the database.
 * Returns the authenticated user object.
 */
async function authenticateAgent() {
  const apiKey = process.env.LIBE_API_KEY;
  if (!apiKey) {
    throw new McpError(ErrorCode.InvalidRequest, "Unauthorized: LIBE_API_KEY environment variable is missing.");
  }

  const user = await db.query.users.findFirst({
    where: eq(users.apiKey, apiKey),
  });

  if (!user) {
    throw new McpError(ErrorCode.InvalidRequest, "Unauthorized: Invalid API Key provided for Libe Aios.");
  }

  return user;
}

// ==========================================
// Tool List Definition
// ==========================================
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "get_projects",
        description: "List all active projects in the Libe Aios system to understand context.",
        inputSchema: { type: "object", properties: {} },
      },
      {
        name: "get_modules_for_review",
        description: "Fetch all modules that are currently marked as 'in_review' and awaiting Chairman approval.",
        inputSchema: {
          type: "object",
          properties: {
            projectId: {
              type: "string",
              description: "Optional project ID to filter modules.",
            },
          },
        },
      },
      {
        name: "submit_module_review",
        description: "As the Chairman AI Agent, review a module and approve or request changes. Approving a module automatically updates its status and awards score points to the assignee.",
        inputSchema: {
          type: "object",
          properties: {
            moduleId: { type: "string", description: "The internal ID of the module to review." },
            status: { type: "string", enum: ["approved", "changes_requested"], description: "The outcome of the review." },
            note: { type: "string", description: "Detailed AI feedback or reason for the decision." },
            score: { type: "number", description: "Score awarded (0-100 points) if approved." },
          },
          required: ["moduleId", "status", "score", "note"],
        },
      },
    ],
  };
});

// ==========================================
// Tool Execution Logic
// ==========================================
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  // Enforce authentication for all tool calls
  const agentUser = await authenticateAgent();

  const { name, arguments: args } = request.params;

  switch (name) {
    case "get_projects": {
      const activeProjects = await db.query.projects.findMany({
        where: eq(projects.status, "active"),
      });
      return {
        content: [{ type: "text", text: JSON.stringify(activeProjects, null, 2) }],
      };
    }

    case "get_modules_for_review": {
      // Find modules in review status
      const reviewModules = await db.query.modules.findMany({
        where: eq(modules.status, "in_review"),
        with: {
          project: true,
          assignee: true,
        },
      });

      // Optionally filter by Project
      const projectId = args && typeof args === "object" && "projectId" in args ? String(args.projectId) : undefined;
      const filtered = projectId 
        ? reviewModules.filter(m => m.project?.id === projectId)
        : reviewModules;

      return {
        content: [{ type: "text", text: JSON.stringify(filtered, null, 2) }],
      };
    }

    case "submit_module_review": {
      if (!args || typeof args !== "object") {
        throw new McpError(ErrorCode.InvalidParams, "Invalid arguments provided.");
      }

      const { moduleId, status, note, score } = args as { moduleId: string; status: string; note: string; score: number };

      // Role check: Only Chairman or Admin can review (or an Agent running on their behalf)
      if (agentUser.role !== "chairman" && agentUser.role !== "admin") {
        throw new McpError(ErrorCode.InvalidRequest, "Forbidden: Only Chairman/Admin can submit module reviews.");
      }

      const mod = await db.query.modules.findFirst({
        where: eq(modules.id, moduleId),
        with: { project: true },
      });

      if (!mod) {
        throw new McpError(ErrorCode.InvalidParams, `Module not found: ${moduleId}`);
      }

      if (mod.status !== "in_review") {
        throw new McpError(ErrorCode.InvalidRequest, `Module is not in review status. Current status: ${mod.status}`);
      }

      const newStatus = status === "approved" ? "done" : "changes_requested";

      // 1. Update Module Status
      await db.update(modules)
        .set({ status: newStatus, updatedAt: new Date() })
        .where(eq(modules.id, moduleId));

      // 2. Award Points if Approved
      if (status === "approved" && mod.assigneeId) {
        await db.insert(scoreEvents).values({
          userId: mod.assigneeId,
          points: score || 0,
          eventType: "module_done",
          refType: "module",
          refId: moduleId,
        });

        await db.insert(reviewScores).values({
          taskId: moduleId,
          reviewerId: agentUser.id,
          score: score || 0,
          feedback: note,
          submittedVia: "mcp", // Mark as Agent-evaluated
        });
      }

      // 3. Log Activity
      await db.insert(activityLogs).values({
        userId: agentUser.id,
        action: `module_reviewed_by_ai`,
        targetType: "module",
        targetId: moduleId,
        metadata: JSON.stringify({ status, note, score }),
      });

      // 4. Notify Assignee
      if (mod.assigneeId) {
        await db.insert(notifications).values({
          userId: mod.assigneeId,
          type: "module_review",
          title: status === "approved" ? "Module Approved by AI ✅" : "Changes Requested by AI ❌",
          body: `Agent ${agentUser.name} evaluated your module: ${note}. Score: ${score}`,
          link: `/modules/${moduleId}`,
        });
      }

      return {
        content: [{ type: "text", text: `Successfully processed review for module ${moduleId}. New status: ${newStatus}` }],
      };
    }

    default:
      throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Libe Aios MCP Server is running and waiting for Stdio connections...");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
