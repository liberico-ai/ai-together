import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { projects } from "@drizzle/schema/projects";
import { githubCommits } from "@drizzle/schema/github";
import { userGithubMap } from "@drizzle/schema/users";
import { eq, and } from "drizzle-orm";
import crypto from "crypto";

/**
 * GitHub Webhook endpoint — receives push events and auto-saves commits.
 * 
 * Setup on GitHub:
 *   1. Go to repo Settings → Webhooks → Add webhook
 *   2. URL: https://your-app.com/api/github-webhook
 *   3. Content type: application/json
 *   4. Secret: same as GITHUB_WEBHOOK_SECRET env var
 *   5. Events: "Just the push event"
 */

function verifySignature(payload: string, signature: string | null, secret: string): boolean {
  if (!signature) return false;
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(payload);
  const expected = `sha256=${hmac.digest("hex")}`;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

export async function POST(req: NextRequest) {
  const event = req.headers.get("x-github-event");
  
  // Only handle push events
  if (event !== "push") {
    return NextResponse.json({ message: "Ignored: not a push event" }, { status: 200 });
  }

  const rawBody = await req.text();
  
  // Verify webhook signature if secret is configured
  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  if (secret) {
    const signature = req.headers.get("x-hub-signature-256");
    if (!verifySignature(rawBody, signature, secret)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
  }

  let body: any;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const repoFullName = body.repository?.full_name; // e.g. "org/repo"
  if (!repoFullName) {
    return NextResponse.json({ error: "Missing repo info" }, { status: 400 });
  }

  const [owner, repo] = repoFullName.split("/");
  const branch = body.ref?.replace("refs/heads/", "") || null;
  const commits = body.commits || [];

  if (commits.length === 0) {
    return NextResponse.json({ message: "No commits in push" }, { status: 200 });
  }

  // Find matching project(s) by GitHub owner/repo
  const matchingProjects = await db.query.projects.findMany({
    where: and(eq(projects.githubOwner, owner), eq(projects.githubRepo, repo)),
    columns: { id: true },
  });

  if (matchingProjects.length === 0) {
    return NextResponse.json({ message: "No matching project found" }, { status: 200 });
  }

  // Load GitHub → User ID mappings
  const allMappings = await db.query.userGithubMap.findMany();
  const usernameToUserId = new Map(
    allMappings.map((m) => [m.githubUsername.toLowerCase(), m.userId])
  );

  let totalInserted = 0;

  for (const project of matchingProjects) {
    const commitValues = commits.map((c: any) => ({
      projectId: project.id,
      sha: c.id,
      message: (c.message || "").slice(0, 1000),
      authorGithub: c.author?.username || c.author?.name || "Unknown",
      authorUserId: usernameToUserId.get((c.author?.username || "").toLowerCase()) || null,
      branch,
      committedAt: new Date(c.timestamp || new Date()),
    }));

    if (commitValues.length > 0) {
      const result = await db
        .insert(githubCommits)
        .values(commitValues)
        .onConflictDoNothing()
        .returning({ id: githubCommits.id });
      totalInserted += result.length;
    }
  }

  console.log(`[Webhook] Push to ${repoFullName}: ${commits.length} commits, ${totalInserted} new saved`);

  return NextResponse.json({
    message: "OK",
    repo: repoFullName,
    branch,
    commitsReceived: commits.length,
    commitsSaved: totalInserted,
    projectsMatched: matchingProjects.length,
  });
}
