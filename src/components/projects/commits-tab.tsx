"use client";

import { trpc } from "@/lib/trpc/client";
import { formatDistanceToNow } from "date-fns";
import { GitCommit, RefreshCw, Loader2, ExternalLink, Circle, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useState, useEffect, useRef } from "react";

// CI Status badge component
function CiStatusBadge({ status, url }: { status: string | null; url: string | null }) {
  if (!status) return null;

  const config: Record<string, { icon: typeof Circle; color: string; label: string; animate?: boolean }> = {
    pending: { icon: Circle, color: "text-amber-500", label: "CI Running", animate: true },
    success: { icon: CheckCircle2, color: "text-green-500", label: "CI Passed" },
    failure: { icon: XCircle, color: "text-red-500", label: "CI Failed" },
    error: { icon: AlertCircle, color: "text-red-400", label: "CI Error" },
  };

  const cfg = config[status] || config.error;
  const Icon = cfg.icon;

  const badge = (
    <span
      className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded ${cfg.color}`}
      title={cfg.label}
    >
      <Icon className={`w-3 h-3 ${cfg.animate ? "animate-pulse" : ""}`} />
      {cfg.label}
    </span>
  );

  if (url) {
    return (
      <a href={url} target="_blank" rel="noreferrer" className="hover:opacity-80 transition-opacity">
        {badge}
      </a>
    );
  }

  return badge;
}

export function CommitsTab({
  projectId,
  githubOwner,
  githubRepo,
}: {
  projectId: string;
  githubOwner?: string | null;
  githubRepo?: string | null;
}) {
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const hasSynced = useRef(false);
  const utils = trpc.useUtils();

  const { data: commits, isLoading } = trpc.projects.getCommits.useQuery(
    { projectId },
    { enabled: !!githubOwner && !!githubRepo }
  );

  const syncMutation = trpc.projects.syncGithubCommits.useMutation({
    onSuccess: (result) => {
      setSyncMessage(
        result.synced > 0
          ? `Synced ${result.synced} new commits (${result.total} total from GitHub)`
          : `Already up to date (${result.total} commits checked)`
      );
      utils.projects.getCommits.invalidate({ projectId });
      setTimeout(() => setSyncMessage(null), 5000);
    },
    onError: (err) => {
      setSyncMessage(`Error: ${err.message}`);
      setTimeout(() => setSyncMessage(null), 8000);
    },
  });

  // Auto-sync on first load if no commits exist
  useEffect(() => {
    if (
      !hasSynced.current &&
      !isLoading &&
      commits !== undefined &&
      commits.length === 0 &&
      githubOwner &&
      githubRepo
    ) {
      hasSynced.current = true;
      syncMutation.mutate({ projectId });
    }
  }, [isLoading, commits, githubOwner, githubRepo, projectId]);

  // ========================================
  // SSE: Real-time commit & CI status updates
  // ========================================
  useEffect(() => {
    if (!githubOwner || !githubRepo) return;

    const es = new EventSource(`/api/sse/github?projectId=${encodeURIComponent(projectId)}`);

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === "new_commits") {
          // Auto-refresh commit list when new commits arrive via webhook
          utils.projects.getCommits.invalidate({ projectId });
        }

        if (data.type === "status_update") {
          // Auto-refresh to show updated CI status
          utils.projects.getCommits.invalidate({ projectId });
        }
      } catch {
        // Ignore parse errors (e.g. heartbeat)
      }
    };

    es.onerror = () => {
      // EventSource auto-reconnects on error
    };

    return () => {
      es.close();
    };
  }, [projectId, githubOwner, githubRepo, utils]);

  if (!githubOwner || !githubRepo) {
    return (
      <EmptyState
        title="No GitHub Repository Linked"
        description="Go to Project Settings to link a GitHub repository and track commits."
        icon={GitCommit}
      />
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with repo link + sync button */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-2">
          <GitCommit className="w-5 h-5 text-coral-500" />
          <h3 className="text-lg font-semibold border-b border-transparent">
            Repository:{" "}
            <a
              href={`https://github.com/${githubOwner}/${githubRepo}`}
              target="_blank"
              rel="noreferrer"
              className="text-coral-500 hover:border-coral-500 border-b inline-flex items-center gap-1"
            >
              {githubOwner}/{githubRepo}
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-green-500 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            Live
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => syncMutation.mutate({ projectId })}
            disabled={syncMutation.isPending}
          >
            {syncMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            {syncMutation.isPending ? "Syncing..." : "Sync"}
          </Button>
        </div>
      </div>

      {/* Sync status message */}
      {syncMessage && (
        <div
          className={`text-sm px-4 py-2.5 rounded-lg border ${
            syncMessage.startsWith("Error")
              ? "bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800"
              : "bg-green-50 dark:bg-green-950/30 text-green-600 dark:text-green-400 border-green-200 dark:border-green-800"
          }`}
        >
          {syncMessage}
        </div>
      )}

      {/* Loading state during first sync */}
      {syncMutation.isPending && (!commits || commits.length === 0) && (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!syncMutation.isPending && (!commits || commits.length === 0) && (
        <EmptyState
          title="No Commits Found"
          description={`No commits found for ${githubOwner}/${githubRepo}. Click "Sync" to fetch from GitHub or push some code.`}
          icon={GitCommit}
        />
      )}

      {/* Commits list */}
      {commits && commits.length > 0 &&
        commits.map((commit) => (
          <div
            key={commit.id}
            className="p-4 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 shadow-sm flex items-start space-x-4"
          >
            <div className="mt-1 bg-stone-100 dark:bg-stone-800 p-2 rounded-full hidden sm:block">
              <GitCommit className="h-5 w-5 text-stone-500" />
            </div>
            <div className="flex-1 space-y-1.5">
              <p className="text-sm font-semibold text-stone-900 dark:text-stone-100 leading-snug">
                {commit.message}
              </p>
              <div className="flex flex-wrap items-center text-xs text-stone-500 gap-2">
                <a
                  href={`https://github.com/${githubOwner}/${githubRepo}/commit/${commit.sha}`}
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono bg-stone-100 dark:bg-stone-800 px-1.5 py-0.5 rounded text-[10px] text-stone-600 dark:text-stone-300 hover:text-coral-500 transition-colors"
                >
                  {commit.sha.substring(0, 7)}
                </a>
                <span>
                  by{" "}
                  <span className="font-medium text-stone-700 dark:text-stone-300">
                    {commit.authorGithub || "Unknown"}
                  </span>
                </span>
                <span>•</span>
                <span>
                  {formatDistanceToNow(new Date(commit.committedAt), {
                    addSuffix: true,
                  })}
                </span>
                {commit.branch && (
                  <>
                    <span>•</span>
                    <span className="font-mono text-[10px] bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-1.5 py-0.5 rounded">
                      {commit.branch}
                    </span>
                  </>
                )}
                {/* CI Status Badge */}
                {commit.ciStatus && (
                  <>
                    <span>•</span>
                    <CiStatusBadge status={commit.ciStatus} url={commit.ciUrl} />
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
    </div>
  );
}
