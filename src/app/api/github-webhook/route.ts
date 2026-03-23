import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { projects } from "@drizzle/schema/projects";
import { githubCommits } from "@drizzle/schema/github";
import { userGithubMap } from "@drizzle/schema/users";
import { eq, and } from "drizzle-orm";
import crypto from "crypto";
import { githubEmitter } from "@/lib/events";
import { recordScore, SCORE_POINTS } from "@/lib/scoring";

/**
 * GitHub Webhook endpoint — receives push, status, and check_run events.
 * 
 * Setup on GitHub:
 *   1. Go to repo Settings → Webhooks → Add webhook
 *   2. URL: https://your-app.com/api/github-webhook
 *   3. Content type: application/json
 *   4. Secret: same as GITHUB_WEBHOOK_SECRET env var
 *   5. Events: "push", "Statuses", "Check runs"
 */

function verifySignature(payload: string, signature: string | null, secret: string): boolean {
  if (!signature) return false;
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(payload);
  const expected = `sha256=${hmac.digest("hex")}`;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

// ==========================================
// Push Event Handler — auto-save commits
// ==========================================
async function handlePushEvent(body: Record<string, any>) {
  const repoFullName = body.repository?.full_name;
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
    const commitValues = commits.map((c: { id: string; message?: string; author?: { username?: string; name?: string }; timestamp?: string }) => ({
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

    // Award commit score to mapped users (BUG-3 fix)
    for (const cv of commitValues) {
      if (cv.authorUserId) {
        await recordScore(db, {
          userId: cv.authorUserId,
          eventType: "commit",
          points: SCORE_POINTS.COMMIT,
          refType: "commit",
          refId: cv.sha,
        });
      }
    }

    // Emit realtime event for SSE clients watching this project
    if (totalInserted > 0) {
      githubEmitter.emit("new_commits", { projectId: project.id, count: totalInserted });
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

// ==========================================
// Status Event Handler — CI commit statuses
// GitHub sends this for external CI systems (CircleCI, Jenkins, etc.)
// ==========================================
async function handleStatusEvent(body: Record<string, any>) {
  const sha = body.sha;
  const state = body.state; // "pending" | "success" | "failure" | "error"
  const targetUrl = body.target_url || null;
  const repoFullName = body.repository?.full_name;

  if (!sha || !state || !repoFullName) {
    return NextResponse.json({ message: "Missing required fields" }, { status: 200 });
  }

  const [owner, repo] = repoFullName.split("/");

  // Find matching projects
  const matchingProjects = await db.query.projects.findMany({
    where: and(eq(projects.githubOwner, owner), eq(projects.githubRepo, repo)),
    columns: { id: true },
  });

  if (matchingProjects.length === 0) {
    return NextResponse.json({ message: "No matching project" }, { status: 200 });
  }

  let updated = 0;
  for (const project of matchingProjects) {
    const result = await db
      .update(githubCommits)
      .set({
        ciStatus: state,
        ciUrl: targetUrl,
        ciUpdatedAt: new Date(),
      })
      .where(and(eq(githubCommits.sha, sha), eq(githubCommits.projectId, project.id)))
      .returning({ id: githubCommits.id });

    if (result.length > 0) {
      updated += result.length;
      githubEmitter.emit("status_update", {
        projectId: project.id,
        sha,
        status: state,
        url: targetUrl,
      });
    }
  }

  console.log(`[Webhook] Status ${state} for ${sha.substring(0, 7)} in ${repoFullName} (${updated} updated)`);

  return NextResponse.json({ message: "OK", sha, state, updated });
}

// ==========================================
// Check Run Event Handler — GitHub Actions
// ==========================================
async function handleCheckRunEvent(body: Record<string, any>) {
  const checkRun = body.check_run;
  if (!checkRun) {
    return NextResponse.json({ message: "Missing check_run" }, { status: 200 });
  }

  // Only process completed check runs
  const action = body.action; // "created" | "completed" | "rerequested" | "requested_action"
  const sha = checkRun.head_sha;
  const repoFullName = body.repository?.full_name;
  const detailsUrl = checkRun.html_url || checkRun.details_url || null;

  if (!sha || !repoFullName) {
    return NextResponse.json({ message: "Missing required fields" }, { status: 200 });
  }

  // Map GitHub check_run conclusion to our CI status
  let ciStatus: string;
  if (action === "created" || checkRun.status === "in_progress" || checkRun.status === "queued") {
    ciStatus = "pending";
  } else if (checkRun.conclusion === "success") {
    ciStatus = "success";
  } else if (checkRun.conclusion === "failure" || checkRun.conclusion === "timed_out") {
    ciStatus = "failure";
  } else if (checkRun.conclusion === "cancelled" || checkRun.conclusion === "skipped") {
    ciStatus = "failure";
  } else {
    ciStatus = "error";
  }

  const [owner, repo] = repoFullName.split("/");

  const matchingProjects = await db.query.projects.findMany({
    where: and(eq(projects.githubOwner, owner), eq(projects.githubRepo, repo)),
    columns: { id: true },
  });

  if (matchingProjects.length === 0) {
    return NextResponse.json({ message: "No matching project" }, { status: 200 });
  }

  let updated = 0;
  for (const project of matchingProjects) {
    const result = await db
      .update(githubCommits)
      .set({
        ciStatus,
        ciUrl: detailsUrl,
        ciUpdatedAt: new Date(),
      })
      .where(and(eq(githubCommits.sha, sha), eq(githubCommits.projectId, project.id)))
      .returning({ id: githubCommits.id });

    if (result.length > 0) {
      updated += result.length;
      githubEmitter.emit("status_update", {
        projectId: project.id,
        sha,
        status: ciStatus,
        url: detailsUrl,
      });
    }
  }

  console.log(`[Webhook] CheckRun ${action}/${ciStatus} for ${sha.substring(0, 7)} in ${repoFullName} (${updated} updated)`);

  return NextResponse.json({ message: "OK", sha, ciStatus, updated });
}

// ==========================================
// Main Handler — route by event type
// ==========================================
export async function POST(req: NextRequest) {
  const event = req.headers.get("x-github-event");
  const rawBody = await req.text();

  // Verify webhook signature if secret is configured
  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  if (secret) {
    const signature = req.headers.get("x-hub-signature-256");
    if (!verifySignature(rawBody, signature, secret)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let body: Record<string, any>;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  switch (event) {
    case "push":
      return handlePushEvent(body);
    case "status":
      return handleStatusEvent(body);
    case "check_run":
      return handleCheckRunEvent(body);
    case "ping":
      return NextResponse.json({ message: "pong" }, { status: 200 });
    default:
      return NextResponse.json({ message: `Ignored: ${event} event` }, { status: 200 });
  }
}
