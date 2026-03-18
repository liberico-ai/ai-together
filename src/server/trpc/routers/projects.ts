import { z } from "zod";
import { router, protectedProcedure, chairmanProcedure } from "../index";
import { projects, projectMembers, projectStatusEnum } from "@drizzle/schema/projects";
import { users } from "@drizzle/schema/users";
import { eq, and } from "drizzle-orm";
import { nextId } from "@/lib/id-gen";

export const projectsRouter = router({
  // List projects user is a member of or chairman of
  list: protectedProcedure.query(async ({ ctx }) => {
    // If Admin or Chairman, maybe return more, but for now just return all for simplicity in demo
    // We should filter by project_members or chairmanId
    const allProjects = await ctx.db.query.projects.findMany({
      orderBy: (projects, { desc }) => [desc(projects.createdAt)],
      with: {
        chairman: {
          columns: { id: true, name: true, email: true, role: true },
        },
        members: {
          with: {
            user: {
              columns: { id: true, name: true, email: true, role: true },
            },
          },
        },
      },
    });
    return allProjects;
  }),

  // Get single project details
  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const project = await ctx.db.query.projects.findFirst({
        where: eq(projects.id, input.id),
        with: {
          chairman: true,
          members: {
            with: { user: true },
          },
        },
      });
      if (!project) throw new Error("Project not found");
      return project;
    }),

  // Create project (Admin/Chairman only)
  create: chairmanProcedure
    .input(
      z.object({
        title: z.string().min(1),
        description: z.string().optional(),
        scoringRubric: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const newId = await nextId("PROJ", ctx.db);

      const [project] = await ctx.db
        .insert(projects)
        .values({
          id: newId,
          title: input.title,
          description: input.description,
          chairmanId: ctx.user.id, // Current chairman creates it
          scoringRubric: input.scoringRubric,
        })
        .returning();

      return project;
    }),

  // Update project
  update: chairmanProcedure
    .input(
      z.object({
        id: z.string(),
        title: z.string().optional(),
        description: z.string().optional(),
        status: z.enum(projectStatusEnum.enumValues).optional(),
        scoringRubric: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(projects)
        .set({
          ...(input.title && { title: input.title }),
          ...(input.description !== undefined && { description: input.description }),
          ...(input.status && { status: input.status }),
          ...(input.scoringRubric !== undefined && { scoringRubric: input.scoringRubric }),
          updatedAt: new Date(),
        })
        .where(eq(projects.id, input.id))
        .returning();

      return updated;
    }),

  // Add member
  addMember: chairmanProcedure
    .input(
      z.object({
        projectId: z.string(),
        userId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [member] = await ctx.db
        .insert(projectMembers)
        .values({
          projectId: input.projectId,
          userId: input.userId,
        })
        .returning();
      return member;
    }),

  // Remove member
  removeMember: chairmanProcedure
    .input(
      z.object({
        projectId: z.string(),
        userId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .delete(projectMembers)
        .where(
          and(
            eq(projectMembers.projectId, input.projectId),
            eq(projectMembers.userId, input.userId)
          )
        );
      return { success: true };
    }),
});
