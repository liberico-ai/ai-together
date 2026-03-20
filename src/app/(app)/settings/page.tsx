"use client";

import { useState } from "react";
import { Settings, Github, Zap, Info, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function SettingsPage() {
  const [githubAppId, setGithubAppId] = useState("");
  const [githubWebhookSecret, setGithubWebhookSecret] = useState("");
  const [minioEndpoint, setMinioEndpoint] = useState(process.env.NEXT_PUBLIC_MINIO_ENDPOINT || "127.0.0.1:9000");

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Settings className="h-6 w-6 text-coral-500" />
          Settings
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Configure platform integrations and system parameters.
        </p>
      </div>

      {/* GitHub Integration */}
      <Card className="border-stone-200 dark:border-stone-800 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Github className="h-5 w-5" />
            GitHub App Integration
          </CardTitle>
          <CardDescription>
            Connect your GitHub App to enable automatic commit tracking, issue sync, and code-push scoring.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-lg flex gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <p className="text-sm text-amber-700 dark:text-amber-400">
              These settings require a running backend with access to your environment variables. Changes here are for reference only. Update your <code className="bg-amber-100 dark:bg-amber-900/50 px-1 rounded text-xs">.env.local</code> file directly.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>GitHub App ID</Label>
              <Input
                placeholder="123456"
                value={githubAppId}
                onChange={(e) => setGithubAppId(e.target.value)}
                className="font-mono"
              />
              <p className="text-xs text-stone-500">Found in your GitHub App's settings page.</p>
            </div>

            <div className="space-y-2">
              <Label>Webhook Secret</Label>
              <Input
                placeholder="your_webhook_secret"
                value={githubWebhookSecret}
                onChange={(e) => setGithubWebhookSecret(e.target.value)}
                className="font-mono"
                type="password"
              />
              <p className="text-xs text-stone-500">Used to verify incoming webhook payloads.</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Webhook URL (for your GitHub App config)</Label>
            <div className="flex gap-2">
              <Input
                readOnly
                value={`${typeof window !== 'undefined' ? window.location.origin : 'https://your-domain.com'}/api/webhooks/github`}
                className="font-mono text-xs bg-stone-50 dark:bg-stone-900"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigator.clipboard.writeText(`${window.location.origin}/api/webhooks/github`)}
              >
                Copy
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Scoring Rubric */}
      <Card className="border-stone-200 dark:border-stone-800 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Zap className="h-5 w-5 text-amber-500" />
            Scoring Rubric
          </CardTitle>
          <CardDescription>Default point values assigned to each scoring event type.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[
              { event: "task_done (Low)", pts: 30, desc: "Task approved by Chairman" },
              { event: "task_done (Medium)", pts: 50, desc: "Task approved by Chairman" },
              { event: "task_done (High)", pts: 70, desc: "Task approved by Chairman" },
              { event: "task_done (Critical)", pts: 100, desc: "Task approved by Chairman" },
              { event: "comment", pts: 5, desc: "Leaving a comment on module/task" },
              { event: "commit", pts: 15, desc: "Pushing a commit (via GitHub webhook)" },
            ].map(item => (
              <div key={item.event} className="flex items-center justify-between py-2 px-3 rounded-lg bg-stone-50 dark:bg-stone-900/30">
                <div>
                  <p className="text-sm font-medium font-mono text-stone-700 dark:text-stone-300">{item.event}</p>
                  <p className="text-xs text-stone-500">{item.desc}</p>
                </div>
                <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900 font-mono">
                  +{item.pts} pts
                </Badge>
              </div>
            ))}
          </div>
          <p className="text-xs text-stone-400 mt-4 italic">
            Scoring values are currently defined in code at <code className="bg-stone-100 dark:bg-stone-800 px-1 rounded">src/server/trpc/routers/tasks.ts</code>. Future version will support editing via this UI.
          </p>
        </CardContent>
      </Card>

      {/* System Info */}
      <Card className="border-stone-200 dark:border-stone-800 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Info className="h-5 w-5 text-blue-500" />
            System Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[
              { label: "Platform", value: "Libe Aios v1.0.0" },
              { label: "Framework", value: "Next.js 14 (App Router)" },
              { label: "Database", value: "PostgreSQL via Drizzle ORM" },
              { label: "Auth", value: "Better Auth" },
              { label: "API Layer", value: "tRPC v11" },
              { label: "File Storage", value: "MinIO (S3-compatible)" },
            ].map(item => (
              <div key={item.label} className="flex items-center justify-between py-2 px-3 rounded-lg border border-stone-100 dark:border-stone-800">
                <span className="text-xs text-stone-500">{item.label}</span>
                <span className="text-xs font-medium font-mono text-stone-800 dark:text-stone-200">{item.value}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
