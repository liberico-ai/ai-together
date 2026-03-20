import { NextRequest } from "next/server";
import { notificationEmitter } from "@/lib/events";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";

// S-04 FIX: Track active SSE connections per user
const activeConnections = new Map<string, Set<ReadableStreamDefaultController>>();
const MAX_CONNECTIONS_PER_USER = 3;
const HEARTBEAT_INTERVAL_MS = 30_000;

export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const userId = session.user.id;

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      // Track this connection
      if (!activeConnections.has(userId)) {
        activeConnections.set(userId, new Set());
      }
      const userConns = activeConnections.get(userId)!;

      // Evict oldest connections if over limit
      while (userConns.size >= MAX_CONNECTIONS_PER_USER) {
        const oldest = userConns.values().next().value;
        if (oldest) {
          try { oldest.close(); } catch {}
          userConns.delete(oldest);
        }
      }
      userConns.add(controller);

      // Initial connection message
      controller.enqueue(encoder.encode(`data: {"type": "connected"}\n\n`));

      // Heartbeat to keep connection alive and detect dead clients
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: heartbeat\n\n`));
        } catch {
          clearInterval(heartbeat);
        }
      }, HEARTBEAT_INTERVAL_MS);

      // Handle notification events
      const listener = (targetUserId: string) => {
        if (targetUserId === userId) {
          try {
            controller.enqueue(encoder.encode(`data: {"type": "new_notification"}\n\n`));
          } catch {}
        }
      };

      notificationEmitter.on("new_notification", listener);

      // Clean up when connection terminates
      req.signal.addEventListener("abort", () => {
        clearInterval(heartbeat);
        notificationEmitter.off("new_notification", listener);
        const conns = activeConnections.get(userId);
        if (conns) {
          conns.delete(controller);
          if (conns.size === 0) activeConnections.delete(userId);
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}
