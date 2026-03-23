import { NextRequest } from "next/server";
import { chatEmitter } from "@/lib/events";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/server/db";
import { conversationParticipants } from "@drizzle/schema/chat";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

// ── Online Presence Tracking ────────────────────────────────
const onlineUsers = new Map<string, { count: number; lastSeen: Date }>();

export function getOnlineUserIds(): string[] {
  return [...onlineUsers.keys()];
}

// ── SSE Connection Management ───────────────────────────────
const activeConnections = new Map<string, Set<ReadableStreamDefaultController>>();
const MAX_CONNECTIONS_PER_USER = 2;
const HEARTBEAT_MS = 30_000;

export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const userId = session.user.id;

  // Get user's conversation IDs for filtering
  const userConvs = await db
    .select({ cid: conversationParticipants.conversationId })
    .from(conversationParticipants)
    .where(eq(conversationParticipants.userId, userId));
  const convIds = new Set(userConvs.map((c) => c.cid));

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      const send = (data: unknown) => {
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
          );
        } catch {
          /* connection closed */
        }
      };

      // ── Connection Management (same pattern as notifications SSE) ──
      if (!activeConnections.has(userId)) {
        activeConnections.set(userId, new Set());
      }
      const userConns = activeConnections.get(userId)!;

      // Evict oldest connections if over limit
      while (userConns.size >= MAX_CONNECTIONS_PER_USER) {
        const oldest = userConns.values().next().value;
        if (oldest) {
          try {
            oldest.close();
          } catch {}
          userConns.delete(oldest);
        }
      }
      userConns.add(controller);

      // ── Online Presence ──
      const entry = onlineUsers.get(userId) || {
        count: 0,
        lastSeen: new Date(),
      };
      entry.count++;
      entry.lastSeen = new Date();
      onlineUsers.set(userId, entry);
      chatEmitter.emit("presence", { userId, status: "online" });

      // Send connected event
      send({ type: "connected", conversationIds: [...convIds] });

      // ── Heartbeat ──
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: heartbeat\n\n`));
        } catch {
          clearInterval(heartbeat);
        }
      }, HEARTBEAT_MS);

      // ── Listen for chat events — FILTER by user's conversations ──
      const onMessage = (data: {
        conversationId: string;
        message: unknown;
      }) => {
        if (convIds.has(data.conversationId)) {
          send({ type: "new_message", ...data });
        }
      };

      const onTyping = (data: {
        conversationId: string;
        userId: string;
        userName: string;
      }) => {
        if (convIds.has(data.conversationId) && data.userId !== userId) {
          send({ type: "typing", ...data });
        }
      };

      const onRead = (data: { conversationId: string; userId: string; lastReadAt: string }) => {
        if (convIds.has(data.conversationId)) {
          send({ type: "read_receipt", ...data });
        }
      };

      const onReaction = (data: {
        conversationId: string;
        messageId: string;
        userId: string;
        emoji: string;
      }) => {
        if (convIds.has(data.conversationId)) {
          send({ type: "reaction", ...data });
        }
      };

      const onConvUpdate = (data: {
        conversationId: string;
        userId: string;
      }) => {
        if (data.userId === userId) {
          convIds.add(data.conversationId);
        }
      };

      const onPresence = (data: { userId: string; status: string }) => {
        send({ type: "presence", ...data });
      };

      chatEmitter.on("new_message", onMessage);
      chatEmitter.on("typing", onTyping);
      chatEmitter.on("read_receipt", onRead);
      chatEmitter.on("reaction", onReaction);
      chatEmitter.on("conv_joined", onConvUpdate);
      chatEmitter.on("presence", onPresence);

      // ── Cleanup on disconnect ──
      req.signal.addEventListener("abort", () => {
        clearInterval(heartbeat);
        chatEmitter.off("new_message", onMessage);
        chatEmitter.off("typing", onTyping);
        chatEmitter.off("read_receipt", onRead);
        chatEmitter.off("reaction", onReaction);
        chatEmitter.off("conv_joined", onConvUpdate);
        chatEmitter.off("presence", onPresence);

        const conns = activeConnections.get(userId);
        if (conns) {
          conns.delete(controller);
          if (conns.size === 0) activeConnections.delete(userId);
        }

        // Online presence: grace period 30s (handle tab refresh)
        const currentEntry = onlineUsers.get(userId);
        if (currentEntry) {
          currentEntry.count--;
          if (currentEntry.count <= 0) {
            setTimeout(() => {
              const check = onlineUsers.get(userId);
              if (check && check.count <= 0) {
                onlineUsers.delete(userId);
                chatEmitter.emit("presence", {
                  userId,
                  status: "offline",
                });
              }
            }, 30_000);
          }
        }
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
