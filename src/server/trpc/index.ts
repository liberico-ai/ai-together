import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { db } from "@/server/db";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

/**
 * Context creator for tRPC
 */
export async function createTRPCContext() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  return {
    db,
    session,
    user: session?.user ?? null,
  };
}

export type TRPCContext = Awaited<ReturnType<typeof createTRPCContext>>;

/**
 * Initialize tRPC
 */
const t = initTRPC.context<TRPCContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

/**
 * Protected procedure — requires session
 */
export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.session || !ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated" });
  }
  return next({
    ctx: {
      ...ctx,
      session: ctx.session,
      user: ctx.user,
    },
  });
});

/**
 * Chairman procedure — requires chairman or admin role
 */
export const chairmanProcedure = protectedProcedure.use(({ ctx, next }) => {
  const role = (ctx.user as Record<string, unknown>).role as string;
  if (role !== "chairman" && role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Chairman or Admin role required" });
  }
  return next({ ctx });
});

/**
 * Admin procedure — requires admin role
 */
export const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  const role = (ctx.user as Record<string, unknown>).role as string;
  if (role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Admin role required" });
  }
  return next({ ctx });
});
