import { NextRequest } from "next/server";
import { githubEmitter } from "@/lib/events";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";

const HEARTBEAT_INTERVAL_MS = 30_000;

/**
 * SSE endpoint for GitHub realtime events (commits + CI status).
 * 
 * Usage: GET /api/sse/github?projectId=PROJ-001
 * 
 * Events pushed:
 * - new_commits: { type: "new_commits", projectId, count }
 * - status_update: { type: "status_update", projectId, sha, status, url }
 */
export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const projectId = req.nextUrl.searchParams.get("projectId");
  if (!projectId) {
    return new Response("Missing projectId", { status: 400 });
  }

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      // Initial connection message
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ type: "connected", projectId })}\n\n`)
      );

      // Heartbeat to keep connection alive
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: heartbeat\n\n`));
        } catch {
          clearInterval(heartbeat);
        }
      }, HEARTBEAT_INTERVAL_MS);

      // Handle new commits pushed via webhook
      const onNewCommits = (data: { projectId: string; count: number }) => {
        if (data.projectId === projectId) {
          try {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: "new_commits", ...data })}\n\n`)
            );
          } catch {}
        }
      };

      // Handle CI status updates
      const onStatusUpdate = (data: { projectId: string; sha: string; status: string; url: string | null }) => {
        if (data.projectId === projectId) {
          try {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: "status_update", ...data })}\n\n`)
            );
          } catch {}
        }
      };

      githubEmitter.on("new_commits", onNewCommits);
      githubEmitter.on("status_update", onStatusUpdate);

      // Clean up when connection terminates
      req.signal.addEventListener("abort", () => {
        clearInterval(heartbeat);
        githubEmitter.off("new_commits", onNewCommits);
        githubEmitter.off("status_update", onStatusUpdate);
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
