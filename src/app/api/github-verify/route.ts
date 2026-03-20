import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { userGithubMap } from "@drizzle/schema/users";
import { eq } from "drizzle-orm";
import { consumeOAuthNonce } from "@/lib/oauth-nonce";

/**
 * GitHub OAuth callback for verifying GitHub account ownership.
 * Flow:
 *   1. User clicks "Verify with GitHub" on Profile page
 *   2. Redirect to GitHub OAuth authorize URL (with state = random nonce)
 *   3. GitHub redirects back here with `code` and `state`
 *   4. We validate the nonce to get the userId
 *   5. We exchange the code for an access_token
 *   6. We call /user API to get the authenticated GitHub username
 *   7. If it matches the username stored in user_github_map, mark as verified
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state"); // This is the nonce

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;

  if (!code || !state) {
    return NextResponse.redirect(`${appUrl}/profile?github_verify=error&reason=missing_params`);
  }

  // S-03 FIX: Validate and consume the nonce to get the real userId
  const userId = consumeOAuthNonce(state);
  if (!userId) {
    return NextResponse.redirect(`${appUrl}/profile?github_verify=error&reason=invalid_or_expired_state`);
  }

  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(`${appUrl}/profile?github_verify=error&reason=not_configured`);
  }

  try {
    // Step 1: Exchange code for access_token
    const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
      }),
    });

    const tokenData = await tokenResponse.json();

    if (!tokenData.access_token) {
      return NextResponse.redirect(`${appUrl}/profile?github_verify=error&reason=token_exchange_failed`);
    }

    // Step 2: Get the authenticated user's GitHub username
    const userResponse = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "Libe-Aios",
      },
    });

    const githubUser = await userResponse.json();
    const verifiedGithubUsername = githubUser.login;

    if (!verifiedGithubUsername) {
      return NextResponse.redirect(`${appUrl}/profile?github_verify=error&reason=no_github_user`);
    }

    // Step 3: Check if this matches the stored GitHub username for this user
    const storedMapping = await db.query.userGithubMap.findFirst({
      where: eq(userGithubMap.userId, userId),
    });

    if (!storedMapping) {
      return NextResponse.redirect(
        `${appUrl}/profile?github_verify=error&reason=no_linked_account`
      );
    }

    if (storedMapping.githubUsername.toLowerCase() !== verifiedGithubUsername.toLowerCase()) {
      return NextResponse.redirect(
        `${appUrl}/profile?github_verify=mismatch&expected=${encodeURIComponent(storedMapping.githubUsername)}&actual=${encodeURIComponent(verifiedGithubUsername)}`
      );
    }

    // Step 4: Mark as verified!
    await db
      .update(userGithubMap)
      .set({ githubVerified: true })
      .where(eq(userGithubMap.userId, userId));

    return NextResponse.redirect(`${appUrl}/profile?github_verify=success`);
  } catch (error) {
    console.error("[github-verify] Error:", error);
    return NextResponse.redirect(`${appUrl}/profile?github_verify=error&reason=server_error`);
  }
}
