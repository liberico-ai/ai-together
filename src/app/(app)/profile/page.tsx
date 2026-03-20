"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { trpc } from "@/lib/trpc/client";
import { useSession } from "@/lib/auth/client";
import { Loader2, User as UserIcon, Shield, Key, Github, Copy, Check, ExternalLink, ShieldCheck, ShieldAlert, Flame, Zap, Trophy, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function ProfilePage() {
  const utils = trpc.useUtils();
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  
  const { data: profile, isLoading } = trpc.users.me.useQuery();
  const { data: githubVerify } = trpc.users.getGithubVerifyUrl.useQuery();
  const { data: myScore } = trpc.users.myScore.useQuery();

  // Change Password state
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwMessage, setPwMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  
  const [name, setName] = useState("");
  const [githubUsername, setGithubUsername] = useState("");
  const [copied, setCopied] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [linkSuccess, setLinkSuccess] = useState<string | null>(null);
  const [verifyMessage, setVerifyMessage] = useState<{ type: "success" | "error" | "warning"; text: string } | null>(null);

  // Handle GitHub verify callback messages from URL
  useEffect(() => {
    const status = searchParams.get("github_verify");
    if (status === "success") {
      setVerifyMessage({ type: "success", text: "GitHub account verified successfully! ✅" });
      utils.users.me.invalidate();
    } else if (status === "mismatch") {
      const expected = searchParams.get("expected");
      const actual = searchParams.get("actual");
      setVerifyMessage({ 
        type: "error", 
        text: `Mismatch: you linked "@${expected}" but logged into GitHub as "@${actual}". Please update your username or try again.` 
      });
    } else if (status === "error") {
      const reason = searchParams.get("reason");
      const reasonMessages: Record<string, string> = {
        missing_params: "Missing parameters from GitHub callback.",
        not_configured: "GitHub OAuth is not configured on this server.",
        token_exchange_failed: "Failed to exchange token with GitHub.",
        no_github_user: "Could not get your GitHub user info.",
        no_linked_account: "No GitHub account linked. Please link one first.",
        server_error: "An unexpected server error occurred.",
      };
      setVerifyMessage({ type: "error", text: reasonMessages[reason || ""] || "GitHub verification failed." });
    }
    // Clean URL params
    if (status) {
      window.history.replaceState({}, '', '/profile');
    }
  }, [searchParams, utils]);

  useEffect(() => {
    if (profile) {
      setName(profile.name);
      if (profile.githubMap?.githubUsername) {
         setGithubUsername(profile.githubMap.githubUsername);
      }
    }
  }, [profile]);

  const updateProfile = trpc.users.updateProfile.useMutation({
    onSuccess: () => {
      utils.users.me.invalidate();
      setLinkSuccess("Profile updated successfully");
      setTimeout(() => setLinkSuccess(null), 3000);
    }
  });

  const linkGithub = trpc.users.linkGithub.useMutation({
    onSuccess: () => {
      utils.users.me.invalidate();
      setLinkError(null);
      setLinkSuccess("GitHub username linked! Use 'Verify with GitHub' to confirm ownership.");
      setTimeout(() => setLinkSuccess(null), 5000);
    },
    onError: (err) => {
      setLinkError(err.message);
      setLinkSuccess(null);
    }
  });

  const generateApiKey = trpc.users.generateApiKey.useMutation({
    onSuccess: () => {
      utils.users.me.invalidate();
    }
  });

  const handleCopyApi = () => {
    if (profile?.apiKey) {
      navigator.clipboard.writeText(profile.apiKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (isLoading) {
     return <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-coral-500" /></div>;
  }

  const isGithubLinked = !!profile?.githubMap?.githubUsername;
  const isGithubVerified = !!profile?.githubMap?.githubVerified;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Your Profile</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Manage your personal information and developer settings.
        </p>
      </div>

      {/* Verify callback message toast */}
      {verifyMessage && (
        <div className={`p-3 rounded-lg border text-sm ${
          verifyMessage.type === 'success' ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800' :
          verifyMessage.type === 'warning' ? 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800' :
          'bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800'
        }`}>
          {verifyMessage.text}
          <button onClick={() => setVerifyMessage(null)} className="ml-2 text-xs opacity-60 hover:opacity-100">✕</button>
        </div>
      )}

      {/* Score Summary Card */}
      {myScore && (
        <Card className="shadow-sm border-stone-200 dark:border-stone-800 bg-gradient-to-r from-coral-50/30 to-amber-50/30 dark:from-coral-950/10 dark:to-amber-950/10">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-coral-500 to-amber-500 flex items-center justify-center shadow">
                  <Trophy className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-xs text-stone-500">Your Score (30 days)</p>
                  <p className="text-2xl font-bold flex items-center gap-1">
                    <Zap className="h-5 w-5 text-amber-500" />
                    {myScore.totalPoints}
                    <span className="text-sm font-normal text-stone-400">pts</span>
                  </p>
                </div>
              </div>

              {/* Breakdown pills */}
              <div className="flex flex-col gap-1 items-end">
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-medium">
                  Review: {myScore.reviewPoints}
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 font-medium">
                  Auto: {myScore.autoPoints}
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-orange-100 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400 font-medium">
                  Tempo: {myScore.tempoBonus}
                </span>
              </div>
            </div>

            {/* Streak + Sparkline Row */}
            <div className="flex items-center gap-4 mt-4 pt-3 border-t border-stone-200/50 dark:border-stone-800/50">
              <div className="flex items-center gap-1.5">
                <Flame className="h-4 w-4 text-orange-500" />
                <span className="text-sm font-bold">{myScore.streak}</span>
                <span className="text-xs text-stone-500">day streak</span>
              </div>
              
              {/* Mini sparkline */}
              <div className="flex-1 flex items-end gap-0.5 h-6">
                {myScore.dailyActivity.map((d, i) => {
                  const maxActions = Math.max(1, ...myScore.dailyActivity.map(x => x.actions));
                  const heightPct = (d.actions / maxActions) * 100;
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center">
                      <div
                        className={`w-full rounded-sm transition-all ${d.actions > 0 ? "bg-gradient-to-t from-coral-400 to-amber-400" : "bg-stone-200 dark:bg-stone-800"}`}
                        style={{ height: `${Math.max(3, heightPct)}%` }}
                        title={`${d.date}: ${d.actions} actions`}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Personal Info Module */}
        <Card className="shadow-sm border-stone-200 dark:border-stone-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <UserIcon className="h-5 w-5 text-coral-500" />
              Personal Information
            </CardTitle>
            <CardDescription>Update your display name and view your account role.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>User ID</Label>
              <Input value={profile?.username || '—'} disabled className="bg-stone-50 dark:bg-stone-900 font-mono" />
              <p className="text-xs text-stone-500">Your unique login ID. Cannot be changed.</p>
            </div>
            
            <div className="space-y-2">
              <Label>Role</Label>
              <div>
                <Badge variant="outline" className={`
                   ${profile?.role === 'admin' ? 'border-rose-200 text-rose-600 bg-rose-50 dark:bg-rose-950/30 dark:border-rose-900' : ''}
                   ${profile?.role === 'chairman' ? 'border-amber-200 text-amber-600 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900' : ''}
                   ${profile?.role === 'user' ? 'border-stone-200 text-stone-600 bg-stone-50 dark:bg-stone-900/30 dark:border-stone-800' : ''}
                `}>
                  <Shield className="h-3 w-3 mr-1" />
                  {profile?.role?.toUpperCase()}
                </Badge>
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t border-stone-100 dark:border-stone-800">
              <Label>Display Name</Label>
              <Input 
                value={name} 
                onChange={(e) => setName(e.target.value)} 
                placeholder="John Doe" 
              />
            </div>
            
            <Button 
               disabled={updateProfile.isPending || name === profile?.name || name.trim() === ""}
               onClick={() => updateProfile.mutate({ name })}
               className="w-full bg-stone-900 hover:bg-stone-800 text-white dark:bg-stone-100 dark:text-stone-900"
            >
              {updateProfile.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Save Changes
            </Button>
          </CardContent>
        </Card>

        <div className="space-y-6">
           {/* GitHub Link Module */}
           <Card className="shadow-sm border-stone-200 dark:border-stone-800">
             <CardHeader>
               <CardTitle className="flex items-center gap-2 text-lg">
                 <Github className="h-5 w-5" />
                 GitHub Account
                 {isGithubLinked && (
                   isGithubVerified ? (
                     <Badge className="ml-auto bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800 text-[10px]">
                       <ShieldCheck className="h-3 w-3 mr-1" /> Verified
                     </Badge>
                   ) : (
                     <Badge variant="outline" className="ml-auto border-amber-200 text-amber-600 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 text-[10px]">
                       <ShieldAlert className="h-3 w-3 mr-1" /> Unverified
                     </Badge>
                   )
                 )}
               </CardTitle>
               <CardDescription>
                 Link your GitHub username to map commits to your account. Verify ownership via OAuth.
               </CardDescription>
             </CardHeader>
             <CardContent className="space-y-4">
                {/* Error/Success messages */}
                {linkError && (
                  <div className="bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 text-sm p-2.5 rounded-md border border-red-200 dark:border-red-800">
                    {linkError}
                  </div>
                )}
                {linkSuccess && (
                  <div className="bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 text-sm p-2.5 rounded-md border border-emerald-200 dark:border-emerald-800">
                    {linkSuccess}
                  </div>
                )}

                <div className="space-y-2">
                  <Label>GitHub Username</Label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-stone-500">
                         @
                      </div>
                      <Input 
                        value={githubUsername} 
                        onChange={(e) => {
                          setGithubUsername(e.target.value);
                          setLinkError(null);
                        }} 
                        className="pl-8"
                        placeholder="torvalds" 
                      />
                    </div>
                    <Button 
                       variant="outline"
                       disabled={linkGithub.isPending || githubUsername === profile?.githubMap?.githubUsername || githubUsername.trim() === ""}
                       onClick={() => {
                         setLinkError(null);
                         setLinkSuccess(null);
                         linkGithub.mutate({ githubUsername: githubUsername.trim() });
                       }}
                    >
                      {linkGithub.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Link"}
                    </Button>
                  </div>
                </div>

                {/* Verify with GitHub OAuth */}
                {isGithubLinked && !isGithubVerified && (
                  <div className="pt-2 border-t border-stone-100 dark:border-stone-800">
                    {githubVerify?.configured ? (
                      <Button 
                        variant="outline"
                        className="w-full border-stone-300 dark:border-stone-700 hover:bg-stone-50 dark:hover:bg-stone-900"
                        onClick={() => {
                          if (githubVerify.url) {
                            window.location.href = githubVerify.url;
                          }
                        }}
                      >
                        <Github className="h-4 w-4 mr-2" />
                        Verify with GitHub
                        <ExternalLink className="h-3 w-3 ml-2 opacity-50" />
                      </Button>
                    ) : (
                      <p className="text-xs text-stone-400 text-center py-2">
                        GitHub OAuth not configured. Contact admin to enable verification.
                      </p>
                    )}
                  </div>
                )}

                {isGithubLinked && isGithubVerified && (
                  <div className="pt-2 border-t border-stone-100 dark:border-stone-800">
                    <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 text-sm">
                      <ShieldCheck className="h-4 w-4" />
                      <span>Ownership verified via GitHub OAuth</span>
                    </div>
                  </div>
                )}
             </CardContent>
           </Card>

           {/* API Key Module */}
           <Card className="shadow-sm border-stone-200 dark:border-stone-800">
             <CardHeader>
               <CardTitle className="flex items-center gap-2 text-lg text-emerald-600 dark:text-emerald-500">
                 <Key className="h-5 w-5" />
                 Developer API Key
               </CardTitle>
               <CardDescription>Use this key to authenticate external MCP tools or CLI operations securely.</CardDescription>
             </CardHeader>
             <CardContent className="space-y-4">
                {profile?.apiKey ? (
                  <div className="space-y-2">
                     <Label>Active Key</Label>
                     <div className="flex items-center gap-2 bg-stone-100 dark:bg-stone-900 p-2 rounded-md font-mono text-xs overflow-hidden">
                        <span className="flex-1 truncate select-all">{profile.apiKey}</span>
                        <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0" onClick={handleCopyApi}>
                           {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3 text-stone-500" />}
                        </Button>
                     </div>
                     <p className="text-[10px] text-stone-500">
                        This key grants full access to your Libe Aios account. Do not share it publicly.
                     </p>
                  </div>
                ) : (
                  <div className="text-sm text-stone-500 border border-dashed border-stone-200 dark:border-stone-800 p-4 rounded-md text-center">
                     No active API key found for this account.
                  </div>
                )}
                <Button 
                   variant={profile?.apiKey ? "outline" : "default"}
                   className={!profile?.apiKey ? "w-full bg-emerald-600 hover:bg-emerald-700 text-white" : "w-full text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30"}
                   onClick={() => {
                      if (confirm(profile?.apiKey ? "Regenerating will invalidate your old key. Are you sure?" : "Generate a new API Key?")) {
                          generateApiKey.mutate();
                      }
                   }}
                   disabled={generateApiKey.isPending}
                >
                   {generateApiKey.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                   {profile?.apiKey ? "Regenerate Key" : "Generate API Key"}
                </Button>
             </CardContent>
           </Card>

            {/* API Key for MCP Integration */}
            <Card className="shadow-sm border-stone-200 dark:border-stone-800">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Key className="h-5 w-5 text-amber-500" />
                  API Key
                </CardTitle>
                <CardDescription>
                  Use this key to connect AI assistants (Antigravity, Cursor, Claude) to AI Together via MCP.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {profile?.apiKey ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Input
                        readOnly
                        value={profile.apiKey}
                        className="font-mono text-xs bg-stone-50 dark:bg-stone-900"
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        className="shrink-0"
                        onClick={() => {
                          navigator.clipboard.writeText(profile.apiKey!);
                          setCopied(true);
                          setTimeout(() => setCopied(false), 2000);
                        }}
                      >
                        {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    </div>
                    <Button
                      variant="outline"
                      className="w-full text-amber-600 border-amber-200 dark:border-amber-800 hover:bg-amber-50 dark:hover:bg-amber-950/30"
                      onClick={async () => {
                        if (confirm("Regenerate API key? The old key will stop working.")) {
                          await utils.client.users.generateApiKey.mutate();
                          utils.users.me.invalidate();
                        }
                      }}
                    >
                      Regenerate Key
                    </Button>
                  </div>
                ) : (
                  <Button
                    className="w-full bg-amber-500 hover:bg-amber-600 text-white"
                    onClick={async () => {
                      await utils.client.users.generateApiKey.mutate();
                      utils.users.me.invalidate();
                    }}
                  >
                    <Key className="mr-2 h-4 w-4" />
                    Generate API Key
                  </Button>
                )}
                <p className="text-[10px] text-muted-foreground">
                  Add to your AI assistant config: <code className="bg-muted px-1 rounded">LIBE_API_KEY=your_key</code>
                </p>
              </CardContent>
            </Card>

            {/* Change Password Card */}
            <Card className="shadow-sm border-stone-200 dark:border-stone-800">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Lock className="h-5 w-5 text-stone-500" />
                  Change Password
                </CardTitle>
                <CardDescription>Update your account password. Requires your current password.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {pwMessage && (
                  <div className={`p-2.5 rounded-lg border text-sm ${
                    pwMessage.type === 'success' 
                      ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
                      : 'bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800'
                  }`}>
                    {pwMessage.text}
                    <button onClick={() => setPwMessage(null)} className="ml-2 text-xs opacity-60 hover:opacity-100">✕</button>
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label htmlFor="current-pw" className="text-xs">Current Password</Label>
                  <Input id="current-pw" type="password" value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} placeholder="Enter current password" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="new-pw" className="text-xs">New Password</Label>
                  <Input id="new-pw" type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} placeholder="Min. 6 characters" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="confirm-pw" className="text-xs">Confirm New Password</Label>
                  <Input id="confirm-pw" type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} placeholder="Re-enter new password" />
                </div>
                <Button
                  className="w-full"
                  disabled={!currentPw || newPw.length < 6 || newPw !== confirmPw}
                  onClick={async () => {
                    setPwMessage(null);
                    try {
                      await utils.client.users.changePassword.mutate({
                        currentPassword: currentPw,
                        newPassword: newPw,
                      });
                      setPwMessage({ type: "success", text: "Password changed successfully!" });
                      setCurrentPw(""); setNewPw(""); setConfirmPw("");
                    } catch (e: any) {
                      setPwMessage({ type: "error", text: e?.message || "Failed to change password." });
                    }
                  }}
                >
                  Change Password
                </Button>
              </CardContent>
            </Card>
        </div>
      </div>
    </div>
  );
}
