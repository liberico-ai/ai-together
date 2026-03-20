import { z } from "zod";
import { router, protectedProcedure, chairmanProcedure } from "../index";
import { projects, projectMembers, projectStatusEnum } from "@drizzle/schema/projects";
import { users, userGithubMap } from "@drizzle/schema/users";
import { githubCommits } from "@drizzle/schema/github";
import { eq, and, or, inArray, sql } from "drizzle-orm";
import { nextId } from "@/lib/id-gen";

export const projectsRouter = router({
  // List projects user is a member of or chairman of (Admin sees all)
  list: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.user.id;
    const userRole = ctx.user.role as string;

    // Admin sees everything
    if (userRole === "admin") {
      return await ctx.db.query.projects.findMany({
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
    }

    // Non-admin: only projects where user is chairman or member
    const memberProjectIds = ctx.db
      .select({ projectId: projectMembers.projectId })
      .from(projectMembers)
      .where(eq(projectMembers.userId, userId));

    return await ctx.db.query.projects.findMany({
      where: or(
        eq(projects.chairmanId, userId),
        inArray(projects.id, memberProjectIds)
      ),
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
        deadline: z.string().optional(),
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
          deadline: input.deadline ? new Date(input.deadline) : undefined,
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
        githubOwner: z.string().optional().nullable(),
        githubRepo: z.string().optional().nullable(),
        deadline: z.string().optional().nullable(),
        startDate: z.string().optional().nullable(),
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
          ...(input.githubOwner !== undefined && { githubOwner: input.githubOwner }),
          ...(input.githubRepo !== undefined && { githubRepo: input.githubRepo }),
          ...(input.deadline !== undefined && { deadline: input.deadline ? new Date(input.deadline) : null }),
          ...(input.startDate !== undefined && { startDate: input.startDate ? new Date(input.startDate) : null }),
          updatedAt: new Date(),
        })
        .where(eq(projects.id, input.id))
        .returning();

      return updated;
    }),

  // Delete project (Chairman/Admin only)
  delete: chairmanProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Cascades to project_members, modules (via FK cascade), and commits
      await ctx.db.delete(projects).where(eq(projects.id, input.id));
      return { success: true };
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

  // Get Commits for a Linked GitHub Repo
  getCommits: protectedProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ ctx, input }) => {
      return await ctx.db.query.githubCommits.findMany({
         where: eq(githubCommits.projectId, input.projectId),
         orderBy: (commits, { desc }) => [desc(commits.committedAt)],
         limit: 50
      });
    }),

  // Sync commits from GitHub API (fetch existing commits)
  syncGithubCommits: protectedProcedure
    .input(z.object({ projectId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Get project to find repo info
      const project = await ctx.db.query.projects.findFirst({
        where: eq(projects.id, input.projectId),
      });

      if (!project) throw new Error("Project not found");
      if (!project.githubOwner || !project.githubRepo) {
        throw new Error("No GitHub repository linked to this project");
      }

      const { githubOwner, githubRepo } = project;

      // Build GitHub API headers
      const headers: Record<string, string> = {
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "Libe-Aios",
      };
      const token = process.env.GITHUB_TOKEN;
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      // Fetch latest 100 commits from GitHub API
      const response = await fetch(
        `https://api.github.com/repos/${githubOwner}/${githubRepo}/commits?per_page=100`,
        { headers }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error("[syncGithubCommits] GitHub API error:", response.status, errorText);
        throw new Error(
          response.status === 404
            ? `Repository ${githubOwner}/${githubRepo} not found or is private. Add a GITHUB_TOKEN for private repos.`
            : `GitHub API error: ${response.status}`
        );
      }

      const apiCommits = await response.json();

      // Get all GitHub username mappings for linking authors
      const allMappings = await ctx.db.query.userGithubMap.findMany();
      const usernameToUserId = new Map(
        allMappings.map((m) => [m.githubUsername.toLowerCase(), m.userId])
      );

      // Build all commit values at once for bulk insert
      const commitValues = apiCommits.map((apiCommit: any) => {
        const sha = apiCommit.sha;
        const message = apiCommit.commit?.message || "";
        const authorGithub = apiCommit.author?.login || apiCommit.commit?.author?.name || "Unknown";
        const committedAt = new Date(apiCommit.commit?.author?.date || new Date());
        const authorUserId = usernameToUserId.get(authorGithub.toLowerCase()) || null;
        return {
          projectId: input.projectId,
          sha,
          message,
          authorGithub,
          authorUserId,
          branch: null as string | null,
          committedAt,
        };
      });

      // Bulk insert — skip duplicates via onConflictDoNothing
      let inserted = 0;
      if (commitValues.length > 0) {
        const result = await ctx.db
          .insert(githubCommits)
          .values(commitValues)
          .onConflictDoNothing()
          .returning({ id: githubCommits.id });
        inserted = result.length;
      }

      return { synced: inserted, total: apiCommits.length };
    }),
});
