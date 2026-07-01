import { z } from "zod";
import { router, protectedProcedure } from "../index";
import {
  conversations,
  conversationParticipants,
  messages,
  messageReactions,
} from "@drizzle/schema/chat";
import { users } from "@drizzle/schema/users";
import { eq, and, desc, lt, inArray, sql, ne, or, isNull, gt } from "drizzle-orm";
import { chatEmitter } from "@/lib/events";
import { escapeHtml } from "@/lib/escape-html";
import { s3Client, MINIO_BUCKET, ensureBucket } from "@/lib/minio";
import { PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { TRPCError } from "@trpc/server";

// ── Rate Limiting (in-memory, simple) ───────────────────────
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= maxRequests) return false;
  entry.count++;
  return true;
}

// ── Helpers ─────────────────────────────────────────────────

/** Verify that user is a participant of the conversation */
async function verifyParticipant(
  db: typeof import("@/server/db").db,
  conversationId: string,
  userId: string
) {
  const participant =
    await db.query.conversationParticipants.findFirst({
      where: and(
        eq(conversationParticipants.conversationId, conversationId),
        eq(conversationParticipants.userId, userId)
      ),
    });
  if (!participant) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Not a participant of this conversation",
    });
  }
  return participant;
}

// ── Chat Router ─────────────────────────────────────────────

export const chatRouter = router({
  // ─── 1. List Conversations ──────────────────────────────
  listConversations: protectedProcedure.query(async ({ ctx }) => {
    // Get all conversations where user is a participant
    const participantRows = await ctx.db.query.conversationParticipants.findMany(
      {
        where: eq(conversationParticipants.userId, ctx.user.id),
        with: {
          conversation: {
            with: {
              participants: {
                with: {
                  user: {
                    columns: {
                      id: true,
                      name: true,
                      image: true,
                      avatarUrl: true,
                    },
                  },
                },
              },
            },
          },
        },
      }
    );

    // Map to a clean structure with unread count
    return participantRows
      .map((p) => {
        const conv = p.conversation;
        // Count unread = messages after lastReadAt
        const unreadCount = p.lastReadAt
          ? 0 // Will be computed client-side or via a separate query
          : 0;

        return {
          id: conv.id,
          type: conv.type,
          title: conv.title,
          avatarUrl: conv.avatarUrl,
          projectId: conv.projectId,
          lastMessageAt: conv.lastMessageAt,
          lastMessagePreview: conv.lastMessagePreview,
          createdAt: conv.createdAt,
          myRole: p.role,
          isMuted: p.isMuted,
          lastReadAt: p.lastReadAt,
          unreadCount,
          participants: conv.participants.map((pp) => ({
            id: pp.user.id,
            name: pp.user.name,
            image: pp.user.image,
            avatarUrl: pp.user.avatarUrl,
            role: pp.role,
          })),
        };
      })
      .sort(
        (a, b) =>
          (b.lastMessageAt?.getTime() ?? 0) -
          (a.lastMessageAt?.getTime() ?? 0)
      );
  }),

  // ─── 2. Get Messages (cursor-based pagination) ──────────
  getMessages: protectedProcedure
    .input(
      z.object({
        conversationId: z.string(),
        cursor: z.string().optional(), // message ID as cursor
        limit: z.number().min(1).max(50).default(20),
      })
    )
    .query(async ({ ctx, input }) => {
      await verifyParticipant(ctx.db, input.conversationId, ctx.user.id);

      let cursorDate: Date | null = null;
      if (input.cursor) {
        const cursorMsg = await ctx.db.query.messages.findFirst({
          where: eq(messages.id, input.cursor),
          columns: { createdAt: true },
        });
        cursorDate = cursorMsg?.createdAt ?? null;
      }

      const conditions = [eq(messages.conversationId, input.conversationId)];
      if (cursorDate) {
        conditions.push(lt(messages.createdAt, cursorDate));
      }

      const result = await ctx.db.query.messages.findMany({
        where: and(...conditions),
        orderBy: [desc(messages.createdAt)],
        limit: input.limit + 1, // +1 to check if there are more
        with: {
          sender: {
            columns: { id: true, name: true, image: true, avatarUrl: true },
          },
          replyTo: {
            columns: {
              id: true,
              content: true,
              senderId: true,
              isDeleted: true,
            },
            with: {
              sender: {
                columns: { id: true, name: true },
              },
            },
          },
          reactions: {
            with: {
              user: { columns: { id: true, name: true } },
            },
          },
        },
      });

      const hasMore = result.length > input.limit;
      const items = hasMore ? result.slice(0, input.limit) : result;

      return {
        items,
        nextCursor: hasMore ? items[items.length - 1]?.id : null,
      };
    }),

  // ─── 3. Send Message ────────────────────────────────────
  sendMessage: protectedProcedure
    .input(
      z.object({
        conversationId: z.string(),
        content: z.string().max(4000).optional(),
        messageType: z.enum(["text", "image", "file"]).default("text"),
        mediaUrl: z.string().optional(),
        mediaType: z.string().optional(),
        fileName: z.string().max(255).optional(),
        fileSize: z.number().optional(),
        replyToId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Rate limit: 30 messages per 10 seconds
      if (!checkRateLimit(`chat:${ctx.user.id}`, 30, 10_000)) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: "Too many messages, please slow down",
        });
      }

      await verifyParticipant(ctx.db, input.conversationId, ctx.user.id);

      // Sanitize content
      const sanitizedContent = input.content
        ? escapeHtml(input.content)
        : null;
      const sanitizedFileName = input.fileName
        ? escapeHtml(input.fileName)
        : null;

      // Insert message
      const [message] = await ctx.db
        .insert(messages)
        .values({
          conversationId: input.conversationId,
          senderId: ctx.user.id,
          content: sanitizedContent,
          messageType: input.messageType,
          mediaUrl: input.mediaUrl,
          mediaType: input.mediaType,
          fileName: sanitizedFileName,
          fileSize: input.fileSize,
          replyToId: input.replyToId,
        })
        .returning();

      // Update conversation cache
      const preview = sanitizedContent
        ? sanitizedContent.slice(0, 100)
        : input.messageType === "image"
          ? "📷 Ảnh"
          : "📎 File";

      await ctx.db
        .update(conversations)
        .set({
          lastMessageAt: message.createdAt,
          lastMessagePreview: `${ctx.user.name}: ${preview}`,
          updatedAt: new Date(),
        })
        .where(eq(conversations.id, input.conversationId));

      // Fetch full message with sender for SSE push
      const fullMessage = await ctx.db.query.messages.findFirst({
        where: eq(messages.id, message.id),
        with: {
          sender: {
            columns: { id: true, name: true, image: true, avatarUrl: true },
          },
          replyTo: {
            columns: {
              id: true,
              content: true,
              senderId: true,
              isDeleted: true,
            },
            with: { sender: { columns: { id: true, name: true } } },
          },
          reactions: true,
        },
      });

      // Emit SSE event
      chatEmitter.emit("new_message", {
        conversationId: input.conversationId,
        message: fullMessage,
      });

      return fullMessage;
    }),

  // ─── 4. Create Direct Conversation ──────────────────────
  createDirect: protectedProcedure
    .input(z.object({ userId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      if (input.userId === ctx.user.id) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot chat with yourself",
        });
      }

      // Check for existing direct conversation between these two users
      const myConvs = await ctx.db.query.conversationParticipants.findMany({
        where: eq(conversationParticipants.userId, ctx.user.id),
        columns: { conversationId: true },
      });
      const myConvIds = myConvs.map((c) => c.conversationId);

      if (myConvIds.length > 0) {
        const otherParticipant =
          await ctx.db.query.conversationParticipants.findFirst({
            where: and(
              inArray(conversationParticipants.conversationId, myConvIds),
              eq(conversationParticipants.userId, input.userId)
            ),
            with: {
              conversation: true,
            },
          });

        if (otherParticipant?.conversation?.type === "direct") {
          // Return existing conversation
          return { id: otherParticipant.conversation.id, existing: true };
        }
      }

      // Create new direct conversation
      const [conv] = await ctx.db
        .insert(conversations)
        .values({
          type: "direct",
          createdBy: ctx.user.id,
        })
        .returning();

      // Add both participants
      await ctx.db.insert(conversationParticipants).values([
        {
          conversationId: conv.id,
          userId: ctx.user.id,
          role: "admin",
        },
        {
          conversationId: conv.id,
          userId: input.userId,
          role: "admin",
        },
      ]);

      // Emit conv_joined for both users
      chatEmitter.emit("conv_joined", {
        conversationId: conv.id,
        userId: ctx.user.id,
      });
      chatEmitter.emit("conv_joined", {
        conversationId: conv.id,
        userId: input.userId,
      });

      return { id: conv.id, existing: false };
    }),

  // ─── 5. Create Group Conversation ──────────────────────
  createGroup: protectedProcedure
    .input(
      z.object({
        title: z.string().min(1).max(100),
        participantIds: z.array(z.string()).min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Create group conversation
      const [conv] = await ctx.db
        .insert(conversations)
        .values({
          type: "group",
          title: input.title,
          createdBy: ctx.user.id,
        })
        .returning();

      // Add creator as admin + other members
      const allUserIds = [
        ctx.user.id,
        ...input.participantIds.filter((id) => id !== ctx.user.id),
      ];
      await ctx.db.insert(conversationParticipants).values(
        allUserIds.map((userId) => ({
          conversationId: conv.id,
          userId,
          role: userId === ctx.user.id ? ("admin" as const) : ("member" as const),
        }))
      );

      // Insert system message
      await ctx.db.insert(messages).values({
        conversationId: conv.id,
        senderId: null,
        content: `${escapeHtml(ctx.user.name)} đã tạo nhóm "${escapeHtml(input.title)}"`,
        messageType: "system",
      });

      // Emit conv_joined for all users
      for (const userId of allUserIds) {
        chatEmitter.emit("conv_joined", {
          conversationId: conv.id,
          userId,
        });
      }

      return { id: conv.id };
    }),

  // ─── 6. Add Participants to Group ──────────────────────
  addParticipants: protectedProcedure
    .input(
      z.object({
        conversationId: z.string(),
        userIds: z.array(z.string()).min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const participant = await verifyParticipant(
        ctx.db,
        input.conversationId,
        ctx.user.id
      );
      if (participant.role !== "admin" && ctx.user.role !== "admin") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only group admin can add members",
        });
      }

      // Fetch new users' names for system message
      const newUsers = await ctx.db.query.users.findMany({
        where: inArray(users.id, input.userIds),
        columns: { id: true, name: true },
      });

      // Insert participants (ignore duplicates)
      for (const user of newUsers) {
        try {
          await ctx.db.insert(conversationParticipants).values({
            conversationId: input.conversationId,
            userId: user.id,
            role: "member",
          });
          chatEmitter.emit("conv_joined", {
            conversationId: input.conversationId,
            userId: user.id,
          });
        } catch {
          // duplicate — skip
        }
      }

      // System message
      const names = newUsers.map((u) => escapeHtml(u.name)).join(", ");
      await ctx.db.insert(messages).values({
        conversationId: input.conversationId,
        senderId: null,
        content: `${escapeHtml(ctx.user.name)} đã thêm ${names}`,
        messageType: "system",
      });

      chatEmitter.emit("new_message", {
        conversationId: input.conversationId,
        message: { type: "system", content: `Added ${names}` },
      });

      return { success: true };
    }),

  // ─── 7. Remove Participant / Leave Group ───────────────
  removeParticipant: protectedProcedure
    .input(
      z.object({
        conversationId: z.string(),
        userId: z.string(), // target user to remove (can be self = leave)
      })
    )
    .mutation(async ({ ctx, input }) => {
      const myParticipant = await verifyParticipant(
        ctx.db,
        input.conversationId,
        ctx.user.id
      );

      const isSelf = input.userId === ctx.user.id;

      if (!isSelf && myParticipant.role !== "admin" && ctx.user.role !== "admin") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only group admin can remove members",
        });
      }

      // Remove participant
      await ctx.db
        .delete(conversationParticipants)
        .where(
          and(
            eq(
              conversationParticipants.conversationId,
              input.conversationId
            ),
            eq(conversationParticipants.userId, input.userId)
          )
        );

      // System message
      const targetUser = await ctx.db.query.users.findFirst({
        where: eq(users.id, input.userId),
        columns: { name: true },
      });
      const systemMsg = isSelf
        ? `${escapeHtml(ctx.user.name)} đã rời nhóm`
        : `${escapeHtml(ctx.user.name)} đã xóa ${escapeHtml(targetUser?.name ?? "user")}`;

      const [sysMessage] = await ctx.db
        .insert(messages)
        .values({
          conversationId: input.conversationId,
          senderId: null,
          content: systemMsg,
          messageType: "system",
        })
        .returning();

      chatEmitter.emit("new_message", {
        conversationId: input.conversationId,
        message: sysMessage,
      });

      return { success: true };
    }),

  // ─── 8. Mark as Read ────────────────────────────────────
  markAsRead: protectedProcedure
    .input(z.object({ conversationId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const now = new Date();
      await ctx.db
        .update(conversationParticipants)
        .set({ lastReadAt: now })
        .where(
          and(
            eq(
              conversationParticipants.conversationId,
              input.conversationId
            ),
            eq(conversationParticipants.userId, ctx.user.id)
          )
        );

      chatEmitter.emit("read_receipt", {
        conversationId: input.conversationId,
        userId: ctx.user.id,
        lastReadAt: now.toISOString(),
      });

      return { success: true };
    }),

  // ─── 9. Typing Indicator ───────────────────────────────
  typing: protectedProcedure
    .input(z.object({ conversationId: z.string() }))
    .mutation(({ ctx, input }) => {
      // Rate limit: 5 typing events per 5 seconds
      if (!checkRateLimit(`typing:${ctx.user.id}`, 5, 5_000)) {
        return { ok: true }; // silently skip
      }

      chatEmitter.emit("typing", {
        conversationId: input.conversationId,
        userId: ctx.user.id,
        userName: ctx.user.name,
      });

      return { ok: true };
    }),

  // ─── 10. Toggle Reaction ───────────────────────────────
  react: protectedProcedure
    .input(
      z.object({
        messageId: z.string(),
        emoji: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Whitelist emojis
      const ALLOWED_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "😡"];
      if (!ALLOWED_EMOJIS.includes(input.emoji)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid emoji",
        });
      }

      // Get the message to verify access
      const msg = await ctx.db.query.messages.findFirst({
        where: eq(messages.id, input.messageId),
        columns: { id: true, conversationId: true },
      });
      if (!msg) throw new TRPCError({ code: "NOT_FOUND" });

      await verifyParticipant(ctx.db, msg.conversationId, ctx.user.id);

      // Toggle: if exists → remove, otherwise → add
      const existing = await ctx.db.query.messageReactions.findFirst({
        where: and(
          eq(messageReactions.messageId, input.messageId),
          eq(messageReactions.userId, ctx.user.id),
          eq(messageReactions.emoji, input.emoji)
        ),
      });

      if (existing) {
        await ctx.db
          .delete(messageReactions)
          .where(eq(messageReactions.id, existing.id));
      } else {
        await ctx.db.insert(messageReactions).values({
          messageId: input.messageId,
          userId: ctx.user.id,
          emoji: input.emoji,
        });
      }

      chatEmitter.emit("reaction", {
        conversationId: msg.conversationId,
        messageId: input.messageId,
        userId: ctx.user.id,
        emoji: input.emoji,
        action: existing ? "removed" : "added",
      });

      return { toggled: !existing };
    }),

  // ─── 11. Edit Message ──────────────────────────────────
  editMessage: protectedProcedure
    .input(
      z.object({
        messageId: z.string(),
        content: z.string().max(4000).min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const msg = await ctx.db.query.messages.findFirst({
        where: eq(messages.id, input.messageId),
      });
      if (!msg) throw new TRPCError({ code: "NOT_FOUND" });
      if (msg.senderId !== ctx.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Can only edit own messages",
        });
      }

      // 15-minute edit window
      const diffMs = Date.now() - msg.createdAt.getTime();
      if (diffMs > 15 * 60 * 1000) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Edit window expired (15 minutes)",
        });
      }

      const sanitized = escapeHtml(input.content);
      await ctx.db
        .update(messages)
        .set({
          content: sanitized,
          isEdited: true,
          updatedAt: new Date(),
        })
        .where(eq(messages.id, input.messageId));

      chatEmitter.emit("new_message", {
        conversationId: msg.conversationId,
        message: { id: msg.id, content: sanitized, isEdited: true, type: "edit" },
      });

      return { success: true };
    }),

  // ─── 12. Delete Message (soft) ─────────────────────────
  deleteMessage: protectedProcedure
    .input(z.object({ messageId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const msg = await ctx.db.query.messages.findFirst({
        where: eq(messages.id, input.messageId),
      });
      if (!msg) throw new TRPCError({ code: "NOT_FOUND" });

      // Only sender or conv admin or system admin can delete
      if (msg.senderId !== ctx.user.id && ctx.user.role !== "admin") {
        const participant = await verifyParticipant(
          ctx.db,
          msg.conversationId,
          ctx.user.id
        );
        if (participant.role !== "admin") {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Cannot delete this message",
          });
        }
      }

      await ctx.db
        .update(messages)
        .set({ isDeleted: true, content: null, updatedAt: new Date() })
        .where(eq(messages.id, input.messageId));

      chatEmitter.emit("new_message", {
        conversationId: msg.conversationId,
        message: { id: msg.id, isDeleted: true, type: "delete" },
      });

      return { success: true };
    }),

  // ─── 13. Get Presigned URL for Media Upload ────────────
  getMediaUploadUrl: protectedProcedure
    .input(
      z.object({
        conversationId: z.string(),
        filename: z.string(),
        contentType: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      await verifyParticipant(ctx.db, input.conversationId, ctx.user.id);

      // Whitelist MIME types
      const ALLOWED_TYPES = [
        "image/jpeg",
        "image/png",
        "image/gif",
        "image/webp",
        "application/pdf",
        "text/plain",
        "text/csv",
        "application/zip",
        "application/x-rar-compressed",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      ];
      if (!ALLOWED_TYPES.includes(input.contentType)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Unsupported file type",
        });
      }

      await ensureBucket();
      const ext = input.filename.split(".").pop();
      const s3Key = `chat/${input.conversationId}/${crypto.randomUUID()}.${ext}`;

      const command = new PutObjectCommand({
        Bucket: MINIO_BUCKET,
        Key: s3Key,
        ContentType: input.contentType,
      });

      const presignedUrl = await getSignedUrl(s3Client, command, {
        expiresIn: 300,
      }); // 5 minutes

      return { presignedUrl, s3Key };
    }),

  // ─── 13b. Get Presigned URL for Media Download ────────────
  getMediaDownloadUrl: protectedProcedure
    .input(
      z.object({
        s3Key: z.string(),
        conversationId: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      await verifyParticipant(ctx.db, input.conversationId, ctx.user.id);

      const command = new GetObjectCommand({
        Bucket: MINIO_BUCKET,
        Key: input.s3Key,
      });

      const presignedUrl = await getSignedUrl(s3Client, command, {
        expiresIn: 3600, // 1 hour
      });

      return { presignedUrl };
    }),

  // ─── 14. Search Messages ───────────────────────────────
  searchMessages: protectedProcedure
    .input(
      z.object({
        query: z.string().min(1).max(200),
        conversationId: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      // Get user's conversation IDs
      const userConvs =
        await ctx.db.query.conversationParticipants.findMany({
          where: eq(conversationParticipants.userId, ctx.user.id),
          columns: { conversationId: true },
        });
      const convIds = userConvs.map((c) => c.conversationId);

      if (convIds.length === 0) return [];

      const targetConvIds = input.conversationId
        ? convIds.includes(input.conversationId)
          ? [input.conversationId]
          : []
        : convIds;

      if (targetConvIds.length === 0) return [];

      const escaped = input.query.replace(/%/g, '\\%').replace(/_/g, '\\_');

      return await ctx.db.query.messages.findMany({
        where: and(
          inArray(messages.conversationId, targetConvIds),
          sql`${messages.content} ILIKE ${`%${escaped}%`}`,
          eq(messages.isDeleted, false)
        ),
        orderBy: [desc(messages.createdAt)],
        limit: 20,
        with: {
          sender: {
            columns: { id: true, name: true, image: true, avatarUrl: true },
          },
          conversation: {
            columns: { id: true, type: true, title: true },
          },
        },
      });
    }),

  // ─── 15. Get Unread Counts ─────────────────────────────
  getUnreadCounts: protectedProcedure.query(async ({ ctx }) => {
    const participantRows = await ctx.db.query.conversationParticipants.findMany({
      where: eq(conversationParticipants.userId, ctx.user.id),
      columns: { conversationId: true },
    });

    if (participantRows.length === 0) return {};

    const convIds = participantRows.map((p) => p.conversationId);

    // Đếm tin CHƯA ĐỌC mỗi hội thoại trong 1 query duy nhất.
    // Join sang conversation_participants của chính user để lấy last_read_at,
    // rồi so per-conversation ngay trong SQL (không interpolate Date thô).
    // Chưa đọc = tin KHÔNG phải của mình, chưa xoá, và
    //   (chưa từng đọc hội thoại — last_read_at NULL — HOẶC gửi SAU last_read_at).
    const rows = await ctx.db
      .select({
        conversationId: messages.conversationId,
        count: sql<number>`cast(count(*) as integer)`,
      })
      .from(messages)
      .innerJoin(
        conversationParticipants,
        and(
          eq(conversationParticipants.conversationId, messages.conversationId),
          eq(conversationParticipants.userId, ctx.user.id)
        )
      )
      .where(
        and(
          inArray(messages.conversationId, convIds),
          eq(messages.isDeleted, false),
          ne(messages.senderId, ctx.user.id),
          or(
            isNull(conversationParticipants.lastReadAt),
            gt(messages.createdAt, conversationParticipants.lastReadAt)
          )
        )
      )
      .groupBy(messages.conversationId);

    const counts: Record<string, number> = {};
    for (const convId of convIds) counts[convId] = 0;
    for (const row of rows) counts[row.conversationId] = row.count;
    return counts;
  }),

  // ─── 16. Update Group Info ─────────────────────────────
  updateGroup: protectedProcedure
    .input(
      z.object({
        conversationId: z.string(),
        title: z.string().min(1).max(100).optional(),
        avatarUrl: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const participant = await verifyParticipant(
        ctx.db,
        input.conversationId,
        ctx.user.id
      );
      if (participant.role !== "admin" && ctx.user.role !== "admin") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only group admin can update group",
        });
      }

      const updates: Record<string, unknown> = { updatedAt: new Date() };
      if (input.title) updates.title = escapeHtml(input.title);
      if (input.avatarUrl) updates.avatarUrl = input.avatarUrl;

      await ctx.db
        .update(conversations)
        .set(updates)
        .where(eq(conversations.id, input.conversationId));

      // System message for rename
      if (input.title) {
        await ctx.db.insert(messages).values({
          conversationId: input.conversationId,
          senderId: null,
          content: `${escapeHtml(ctx.user.name)} đã đổi tên nhóm thành "${escapeHtml(input.title)}"`,
          messageType: "system",
        });
      }

      return { success: true };
    }),

  // ─── 17. Toggle Mute ───────────────────────────────────
  toggleMute: protectedProcedure
    .input(z.object({ conversationId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const participant = await verifyParticipant(
        ctx.db,
        input.conversationId,
        ctx.user.id
      );

      const newMuted = !participant.isMuted;
      await ctx.db
        .update(conversationParticipants)
        .set({ isMuted: newMuted })
        .where(eq(conversationParticipants.id, participant.id));

      return { isMuted: newMuted };
    }),
});
