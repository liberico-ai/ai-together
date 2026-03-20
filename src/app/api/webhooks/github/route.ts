import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { db } from '@/server/db';
import { userGithubMap } from '@drizzle/schema/users';
import { scoreEvents } from '@drizzle/schema/scoring';
import { githubCommits } from '@drizzle/schema/github';
import { projects } from '@drizzle/schema/projects';
import { eq, and } from 'drizzle-orm';
import { checkRateLimit, WEBHOOK_RATE_LIMIT } from '@/lib/rate-limit';

export async function POST(req: Request) {
  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "Secret not configured" }, { status: 500 });

  // B-04: Rate limit webhook endpoint
  const clientIp = req.headers.get("x-forwarded-for") || "unknown";
  const rateLimitResult = checkRateLimit(`webhook:${clientIp}`, WEBHOOK_RATE_LIMIT);
  if (!rateLimitResult.success) {
    return NextResponse.json({ error: "Rate limited" }, { status: 429 });
  }
  
  const signature = req.headers.get("x-hub-signature-256");
  const event = req.headers.get("x-github-event");
  const payload = await req.text();
  
  const hmac = crypto.createHmac("sha256", secret);
  const digest = `sha256=${hmac.update(payload).digest("hex")}`;
  
  // NEW-01 FIX (Sprint 1): timing-safe comparison
  if (!signature || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (event === "push") {
    const data = JSON.parse(payload);
    const commits = data.commits || [];
    const repoFullName = data.repository?.full_name;
    const branch = data.ref?.replace("refs/heads/", "") || null;

    // Find the project linked to this repo
    let projectId: string | null = null;
    if (repoFullName) {
      const [owner, repo] = repoFullName.split("/");
      const project = await db.query.projects.findFirst({
        where: and(
          eq(projects.githubOwner, owner),
          eq(projects.githubRepo, repo)
        ),
      });
      projectId = project?.id || null;
    }

    // B-02 FIX: Pre-fetch ALL GitHub username → userId mappings BEFORE the loop
    const allMappings = await db.query.userGithubMap.findMany();
    const usernameToUserId = new Map(
      allMappings.map((m) => [m.githubUsername.toLowerCase(), m.userId])
    );

    // Process all commits in bulk
    const commitValues = [];
    const scoreValues = [];

    for (const commit of commits) {
      const username = commit.author?.username;

      // 1. Prepare commit insert
      if (projectId) {
        const authorUserId = username
          ? usernameToUserId.get(username.toLowerCase()) || null
          : null;

        commitValues.push({
          projectId,
          sha: commit.id,
          message: commit.message,
          authorGithub: username || commit.author?.name || "Unknown",
          authorUserId,
          branch,
          committedAt: new Date(commit.timestamp),
        });
      }

      // 2. Prepare score award
      if (username) {
        const userId = usernameToUserId.get(username.toLowerCase());
        if (userId) {
          scoreValues.push({
            userId,
            points: 15,
            eventType: "github_commit" as const,
            refType: "commit" as const,
            refId: commit.id,
          });
        }
      }
    }

    // Bulk insert commits + scores (skip duplicates)
    if (commitValues.length > 0) {
      await db.insert(githubCommits).values(commitValues).onConflictDoNothing();
    }
    if (scoreValues.length > 0) {
      // NEW-05 (Sprint 1): unique constraint prevents duplicate scoring on retry
      await db.insert(scoreEvents).values(scoreValues).onConflictDoNothing();
    }
  }

  return NextResponse.json({ received: true });
}
