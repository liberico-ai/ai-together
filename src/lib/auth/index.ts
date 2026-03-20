import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin } from "better-auth/plugins";
import { db } from "@/server/db";
import { sendMail } from "@/lib/mail";
import { escapeHtml } from "@/lib/escape-html";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    usePlural: true,
  }),
  emailAndPassword: {
    enabled: true,
    // B-05 FIX: Enable email verification in production via env var
    requireEmailVerification: process.env.REQUIRE_EMAIL_VERIFICATION === "true",
    sendResetPassword: async ({ user, url }: { user: { email: string; name: string }; url: string }) => {
      await sendMail({
        to: user.email,
        subject: "🔒 Reset your Libe Aios password",
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e7e5e4; border-radius: 8px;">
            <h2 style="color: #ec4899;">Password Reset Request</h2>
            <p>Hi ${escapeHtml(user.name)},</p>
            <p>We received a request to reset the password for your Libe Aios account.</p>
            <a href="${url}" style="display: inline-block; padding: 10px 20px; background-color: #f43f5e; color: white; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 16px 0;">Reset Password</a>
            <p style="font-size: 12px; color: #78716c;">If you didn't request this, you can safely ignore this email.</p>
          </div>
        `,
      });
    },
    sendVerificationEmail: async ({ user, url }: { user: { email: string; name: string }; url: string }) => {
      await sendMail({
        to: user.email,
        subject: "👋 Welcome to Libe Aios - Verify your email",
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e7e5e4; border-radius: 8px;">
            <h2 style="color: #ec4899;">Verify Your Email Address</h2>
            <p>Hi ${escapeHtml(user.name)},</p>
            <p>Thanks for joining Libe Aios! Please click the button below to verify your email address and activate your account.</p>
            <a href="${url}" style="display: inline-block; padding: 10px 20px; background-color: #f43f5e; color: white; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 16px 0;">Verify Email</a>
          </div>
        `,
      });
    },
  },
  socialProviders: {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID || "",
      clientSecret: process.env.GITHUB_CLIENT_SECRET || "",
    }
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    cookieCache: {
      enabled: false,
      maxAge: 60 * 5, // 5 minutes
    },
  },
  plugins: [admin()],
});

export type Session = typeof auth.$Infer.Session;
