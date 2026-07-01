import { z } from "zod";
import { router, protectedProcedure, adminProcedure } from "../index";
import { users, userGithubMap } from "@drizzle/schema/users";
import { sessions, accounts } from "@drizzle/schema/auth";
import { eq, desc } from "drizzle-orm";
import { auth } from "@/lib/auth";

export const usersRouter = router({
  // 0a. All users search (for @mentions)
  searchUsers: protectedProcedure
    .input(z.object({ query: z.string().min(0).max(50) }))
    .query(async ({ ctx, input }) => {
      const { ilike, or } = await import("drizzle-orm");
      const q = `%${input.query}%`;
      return await ctx.db.query.users.findMany({
        where: or(
          ilike(users.name, q),
          ilike(users.username, q)
        ),
        columns: { id: true, name: true, username: true, image: true },
        limit: 50,
      });
    }),

  // 0b. Admin: Create new user
  createUser: adminProcedure
    .input(z.object({
      username: z.string().min(2).max(30).regex(/^[a-zA-Z0-9_.-]+$/, "Username can only contain letters, numbers, underscores, dots and hyphens"),
      password: z.string().min(6),
      name: z.string().min(1),
      role: z.enum(["admin", "chairman", "user"]).default("user"),
    }))
    .mutation(async ({ ctx, input }) => {
      // Check if username already exists
      const existing = await ctx.db.query.users.findFirst({
        where: eq(users.username, input.username),
      });
      if (existing) {
        throw new Error(`Username "${input.username}" is already taken`);
      }

      // Create user via BetterAuth API (email = username@libe.aios)
      const email = `${input.username}@libe.aios`;
      const result = await auth.api.signUpEmail({
        body: {
          email,
          password: input.password,
          name: input.name,
        },
      });

      if (!result?.user?.id) {
        throw new Error("Failed to create user account");
      }

      // Update username and role
      await ctx.db
        .update(users)
        .set({
          username: input.username,
          role: input.role,
          updatedAt: new Date(),
        })
        .where(eq(users.id, result.user.id));

      return { success: true, userId: result.user.id, username: input.username };
    }),

  // 1. Admin: List all users
  list: adminProcedure.query(async ({ ctx }) => {
    return await ctx.db.query.users.findMany({
      orderBy: [desc(users.createdAt)],
      with: {
        githubMap: true,
      }
    });
  }),

  // 2. Admin: Update User Role
  updateRole: adminProcedure
    .input(z.object({
      userId: z.string(),
      role: z.enum(["admin", "chairman", "user"]),
    }))
    .mutation(async ({ ctx, input }) => {
      if (input.userId === ctx.user.id && input.role !== "admin") {
         throw new Error("You cannot demote yourself. Ask another admin.");
      }
      
      await ctx.db
        .update(users)
        .set({ role: input.role, updatedAt: new Date() })
        .where(eq(users.id, input.userId));
        
      return { success: true };
    }),

  // 2a. Admin: Disable User (ban)
  disableUser: adminProcedure
    .input(z.object({ userId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      if (input.userId === ctx.user.id) {
        throw new Error("You cannot disable your own account.");
      }
      await ctx.db
        .update(users)
        .set({ banned: true, updatedAt: new Date() })
        .where(eq(users.id, input.userId));
      // Force logout: remove all sessions
      await ctx.db.delete(sessions).where(eq(sessions.userId, input.userId));
      return { success: true };
    }),

  // 2b. Admin: Enable User (unban)
  enableUser: adminProcedure
    .input(z.object({ userId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(users)
        .set({ banned: false, banReason: null, updatedAt: new Date() })
        .where(eq(users.id, input.userId));
      return { success: true };
    }),

  // 2c. Admin: Reset Password
  resetPassword: adminProcedure
    .input(z.object({
      userId: z.string(),
      newPassword: z.string().min(6),
    }))
    .mutation(async ({ ctx, input }) => {
      // Use Better Auth context to hash passwords
      const bcryptModule = await import("better-auth/crypto");
      const hashedPassword = await bcryptModule.hashPassword(input.newPassword);

      await ctx.db
        .update(accounts)
        .set({ password: hashedPassword, updatedAt: new Date() })
        .where(eq(accounts.userId, input.userId));

      return { success: true };
    }),

  // 2d. Admin: Force Logout (revoke all sessions)
  forceLogout: adminProcedure
    .input(z.object({ userId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.delete(sessions).where(eq(sessions.userId, input.userId));
      return { success: true };
    }),

  // 2e. Admin: Delete User (hard delete with cascade cleanup)
  deleteUser: adminProcedure
    .input(z.object({ userId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      if (input.userId === ctx.user.id) {
        throw new Error("You cannot delete your own account.");
      }

      const { scoreEvents, reviewScores, userActivityLog } = await import("@drizzle/schema/scoring");
      const { activityLogs, notifications } = await import("@drizzle/schema/notifications");
      const { comments } = await import("@drizzle/schema/comments");
      const { githubCommits } = await import("@drizzle/schema/github");
      const { modules } = await import("@drizzle/schema/modules");
      const { tasks } = await import("@drizzle/schema/tasks");
      const { documents } = await import("@drizzle/schema/documents");

      // Transaction: clean up all references then delete user
      await ctx.db.transaction(async (tx) => {
        // 1. Delete owned data
        await tx.delete(scoreEvents).where(eq(scoreEvents.userId, input.userId));
        await tx.delete(reviewScores).where(eq(reviewScores.reviewerId, input.userId));
        await tx.delete(userActivityLog).where(eq(userActivityLog.userId, input.userId));
        await tx.delete(activityLogs).where(eq(activityLogs.userId, input.userId));
        await tx.delete(notifications).where(eq(notifications.userId, input.userId));
        await tx.delete(comments).where(eq(comments.authorId, input.userId));
        await tx.delete(documents).where(eq(documents.uploadedBy, input.userId));

        // 2. Nullify references (keep modules/tasks but unassign)
        await tx.update(modules).set({ createdBy: null }).where(eq(modules.createdBy, input.userId));
        await tx.update(tasks).set({ assigneeId: null }).where(eq(tasks.assigneeId, input.userId));
        await tx.update(tasks).set({ createdBy: null }).where(eq(tasks.createdBy, input.userId));
        await tx.update(githubCommits).set({ authorUserId: null }).where(eq(githubCommits.authorUserId, input.userId));

        // 3. Delete github map
        await tx.delete(userGithubMap).where(eq(userGithubMap.userId, input.userId));

        // 4. Delete auth data (sessions, accounts cascade via FK)
        await tx.delete(sessions).where(eq(sessions.userId, input.userId));
        await tx.delete(accounts).where(eq(accounts.userId, input.userId));

        // 5. Finally delete the user
        await tx.delete(users).where(eq(users.id, input.userId));
      });

      return { success: true };
    }),

  // 3. User: Update personal profile
  updateProfile: protectedProcedure
    .input(z.object({
      name: z.string().min(2),
    }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(users)
        .set({ name: input.name, updatedAt: new Date() })
        .where(eq(users.id, ctx.user.id));
      return { success: true };
    }),

  // 4. User: Link GitHub (with existence check via GitHub API)
  linkGithub: protectedProcedure
    .input(z.object({
      githubUsername: z.string().min(1).max(39)
    }))
    .mutation(async ({ ctx, input }) => {
      const username = input.githubUsername.trim();

      // Step 1: Check if GitHub username exists via public API
      try {
        const ghResponse = await fetch(`https://api.github.com/users/${encodeURIComponent(username)}`, {
          headers: { 'Accept': 'application/vnd.github.v3+json', 'User-Agent': 'Libe-Aios' },
        });
        if (ghResponse.status === 404) {
          throw new Error(`GitHub user "@${username}" does not exist. Please check the username.`);
        }
        if (!ghResponse.ok) {
          // Rate limit or other error — allow linking anyway but warn
          console.warn(`[linkGithub] GitHub API returned ${ghResponse.status}, proceeding without verification`);
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.message.includes('does not exist')) throw err;
        // Network error — proceed without check
        console.warn('[linkGithub] GitHub API unreachable, proceeding');
      }

      // Step 2: Upsert into userGithubMap (always set githubVerified=false until OAuth verify)
      const existing = await ctx.db.query.userGithubMap.findFirst({
         where: eq(userGithubMap.userId, ctx.user.id)
      });

      if (existing) {
         await ctx.db
           .update(userGithubMap)
           .set({
             githubUsername: username,
             githubVerified: false,
             linkedAt: new Date(),
           })
           .where(eq(userGithubMap.userId, ctx.user.id));
      } else {
         await ctx.db
           .insert(userGithubMap)
           .values({
              userId: ctx.user.id,
              githubUsername: username,
              githubVerified: false,
           });
      }
      return { success: true };
    }),

  // 4b. User: Get GitHub OAuth verification URL
  getGithubVerifyUrl: protectedProcedure.query(async ({ ctx }) => {
    const clientId = process.env.GITHUB_CLIENT_ID;
    if (!clientId) {
      return { url: null, configured: false };
    }
    const { headers } = await import("next/headers");
    const h = await headers();
    const host = h.get("host") || "localhost:3000";
    const proto = h.get("x-forwarded-proto") || "http";
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || `${proto}://${host}`;
    const redirectUri = `${appUrl}/api/github-verify`;
    // S-03 FIX: Use random nonce instead of userId as OAuth state to prevent CSRF
    const { createOAuthNonce } = await import("@/lib/oauth-nonce");
    const state = createOAuthNonce(ctx.user.id);
    const url = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=read:user&state=${state}`;
    return { url, configured: true };
  }),

  // 5. User: Generate API Key
  generateApiKey: protectedProcedure.mutation(async ({ ctx }) => {
     // Generate secure API key starting with 'laios_'
     const randomBytes = crypto.getRandomValues(new Uint8Array(24));
     const keyString = Array.from(randomBytes).map(b => b.toString(16).padStart(2, '0')).join('');
     const apiKey = `laios_${keyString}`;

     await ctx.db
       .update(users)
       .set({ apiKey, updatedAt: new Date() })
       .where(eq(users.id, ctx.user.id));
       
     return { apiKey };
  }),

  // 6. User: Get Profile Data including api key
  me: protectedProcedure.query(async ({ ctx }) => {
     return await ctx.db.query.users.findFirst({
        where: eq(users.id, ctx.user.id),
        with: { githubMap: true }
     });
  }),

  // 7. User: Get My Score Summary (for Profile page)
  myScore: protectedProcedure.query(async ({ ctx }) => {
    const { scoreEvents: scoreEventsTable } = await import("@drizzle/schema/scoring");
    const { userActivityLog } = await import("@drizzle/schema/scoring");
    const { calculateTempoBonus, getCurrentStreak } = await import("@/lib/scoring");
    const { sql, gte, and: andOp } = await import("drizzle-orm");

    // Last 30 days
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);

    // Score breakdown
    const scores = await ctx.db
      .select({
        reviewPoints: sql<number>`CAST(COALESCE(SUM(CASE WHEN ${scoreEventsTable.eventType} IN ('task_done','task_early','task_late') THEN ${scoreEventsTable.points} ELSE 0 END), 0) AS INTEGER)`,
        autoPoints: sql<number>`CAST(COALESCE(SUM(CASE WHEN ${scoreEventsTable.eventType} IN ('comment','commit','doc_approved') THEN ${scoreEventsTable.points} ELSE 0 END), 0) AS INTEGER)`,
        totalBase: sql<number>`CAST(COALESCE(SUM(${scoreEventsTable.points}), 0) AS INTEGER)`,
      })
      .from(scoreEventsTable)
      .where(andOp(eq(scoreEventsTable.userId, ctx.user.id), gte(scoreEventsTable.createdAt, cutoff)));

    // Activity logs
    const activityLogs = await ctx.db.query.userActivityLog.findMany({
      where: eq(userActivityLog.userId, ctx.user.id),
      columns: { activityDate: true, actionCount: true },
    });

    const tempo = calculateTempoBonus(activityLogs, 30);
    const streak = getCurrentStreak(activityLogs);

    // Sparkline: last 7 days
    const now = new Date();
    const dailyActivity = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split("T")[0];
      const log = activityLogs.find(l => l.activityDate === dateStr);
      dailyActivity.push({
        date: dateStr,
        day: d.toLocaleDateString("en", { weekday: "short" }),
        actions: log?.actionCount ?? 0,
      });
    }

    const r = scores[0];
    return {
      reviewPoints: r?.reviewPoints ?? 0,
      autoPoints: r?.autoPoints ?? 0,
      tempoBonus: tempo.total,
      totalPoints: (r?.totalBase ?? 0) + tempo.total,
      streak,
      dailyActivity,
    };
  }),

  // 8. User: Change Password (requires old password)
  changePassword: protectedProcedure
    .input(z.object({
      currentPassword: z.string().min(1),
      newPassword: z.string().min(6),
    }))
    .mutation(async ({ ctx, input }) => {
      const bcryptModule = await import("better-auth/crypto");

      // Get current account
      const account = await ctx.db.query.accounts.findFirst({
        where: eq(accounts.userId, ctx.user.id),
      });

      if (!account?.password) {
        throw new Error("No password set for this account.");
      }

      // Verify old password
      const isValid = await bcryptModule.verifyPassword({
        hash: account.password,
        password: input.currentPassword,
      });

      if (!isValid) {
        throw new Error("Current password is incorrect.");
      }

      // Hash new password
      const hashedPassword = await bcryptModule.hashPassword(input.newPassword);

      await ctx.db
        .update(accounts)
        .set({ password: hashedPassword, updatedAt: new Date() })
        .where(eq(accounts.userId, ctx.user.id));

      return { success: true };
    }),
});
