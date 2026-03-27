"use client";

import { useState } from "react";
import { useTheme } from "next-themes";
import { trpc } from "@/lib/trpc/client";
import { useSession } from "@/lib/auth/client";
import {
  Trophy, Loader2, Zap, Flame, TrendingUp, ChevronUp, Target,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const PERIODS = [
  { key: "today", label: "Today" },
  { key: "week", label: "This Week" },
  { key: "month", label: "This Month" },
  { key: "all", label: "All Time" },
] as const;

type Period = typeof PERIODS[number]["key"];

// Podium config per rank (0=Gold #1, 1=Silver #2, 2=Bronze #3)
const PODIUM_META = [
  { ring: "ring-yellow-400", gradient: "from-yellow-400 to-amber-500", height: "h-44", avatarSize: "h-24 w-24", textSize: "text-2xl", nameSize: "text-lg", order: "order-2" },
  { ring: "ring-slate-400", gradient: "from-slate-300 to-slate-400", height: "h-36", avatarSize: "h-20 w-20", textSize: "text-xl", nameSize: "text-base", order: "order-1" },
  { ring: "ring-orange-400", gradient: "from-orange-400 to-orange-600", height: "h-28", avatarSize: "h-20 w-20", textSize: "text-xl", nameSize: "text-base", order: "order-3" },
];

// Theme-dependent podium styles
const PODIUM_THEME = {
  light: {
    bg: "background: linear-gradient(to bottom, #fffbeb, rgba(255,237,213,0.5), #f5f5f4)",
    columns: [
      { bg: "linear-gradient(to top, rgba(245,158,11,0.5), rgba(251,191,36,0.6), rgba(253,224,71,0.4))", border: "rgba(251,191,36,0.5)", glow: "rgba(251,191,36,0.3)" },
      { bg: "linear-gradient(to top, rgba(148,163,184,0.5), rgba(203,213,225,0.6), rgba(226,232,240,0.4))", border: "rgba(148,163,184,0.4)", glow: "rgba(148,163,184,0.2)" },
      { bg: "linear-gradient(to top, rgba(234,88,12,0.5), rgba(249,115,22,0.6), rgba(251,146,60,0.4))", border: "rgba(249,115,22,0.4)", glow: "rgba(249,115,22,0.25)" },
    ],
    textPrimary: "#1c1917",
    textSecondary: "#78716c",
    nameColor: "#292524",
    zapColor: "#d97706",
    streakColor: "#ea580c",
    sparkleColors: [
      ["#fde68a", "#fbbf24", "#fef3c7", "#f59e0b"],
      ["#cbd5e1", "#94a3b8", "#e2e8f0", "#f1f5f9"],
      ["#fed7aa", "#fb923c", "#ffedd5", "#f59e0b"],
    ],
  },
  dark: {
    bg: "background: linear-gradient(to bottom, #1c1917, #0c0a09, #0c0a09)",
    columns: [
      { bg: "linear-gradient(to top, rgba(180,83,9,0.6), rgba(245,158,11,0.7), rgba(251,191,36,0.5))", border: "rgba(251,191,36,0.4)", glow: "rgba(251,191,36,0.2)" },
      { bg: "linear-gradient(to top, rgba(71,85,105,0.5), rgba(100,116,139,0.6), rgba(148,163,184,0.4))", border: "rgba(148,163,184,0.3)", glow: "rgba(148,163,184,0.15)" },
      { bg: "linear-gradient(to top, rgba(154,52,18,0.6), rgba(234,88,12,0.7), rgba(249,115,22,0.5))", border: "rgba(249,115,22,0.3)", glow: "rgba(249,115,22,0.15)" },
    ],
    textPrimary: "#ffffff",
    textSecondary: "#a8a29e",
    nameColor: "#ffffff",
    zapColor: "#fcd34d",
    streakColor: "#fdba74",
    sparkleColors: [
      ["#fde68a", "#fbbf24", "#fef3c7", "#f59e0b"],
      ["#e2e8f0", "#cbd5e1", "#f8fafc", "#ffffff"],
      ["#fed7aa", "#fb923c", "#ffedd5", "#fbbf24"],
    ],
  },
};

export default function LeaderboardPage() {
  const { data: session } = useSession();
  const { resolvedTheme } = useTheme();
  const [period, setPeriod] = useState<Period>("month");

  const isDark = resolvedTheme === "dark";
  const theme = isDark ? PODIUM_THEME.dark : PODIUM_THEME.light;

  const { data: leaderboard, isLoading } = trpc.dashboard.getLeaderboard.useQuery({ period });
  const { data: myStats } = trpc.dashboard.getMyRankStats.useQuery({ period });

  const myRank = leaderboard?.findIndex(u => u.userId === session?.user?.id);
  const myRankNum = myRank !== undefined && myRank >= 0 ? myRank + 1 : null;
  const nextRankGap = myRankNum && myRankNum > 1 && leaderboard
    ? leaderboard[myRankNum - 2].totalPoints - leaderboard[myRankNum - 1].totalPoints
    : null;

  return (
    <div className="w-full space-y-0">
      {/* ===== PODIUM SECTION ===== */}
      <div
        className="relative rounded-t-2xl overflow-hidden px-8 pt-8 pb-4"
        style={{ [theme.bg.split(":")[0]]: theme.bg.split(": ")[1] }}
      >
        {/* Ambient glow */}
        <div
          className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 blur-[120px] pointer-events-none"
          style={{ backgroundColor: isDark ? "rgba(245,158,11,0.08)" : "rgba(251,191,36,0.1)" }}
        />
        <div
          className="absolute top-1/2 left-1/4 w-64 h-64 blur-[100px] pointer-events-none"
          style={{ backgroundColor: isDark ? "rgba(234,179,8,0.05)" : "rgba(234,179,8,0.08)" }}
        />
        <div
          className="absolute top-1/2 right-1/4 w-64 h-64 blur-[100px] pointer-events-none"
          style={{ backgroundColor: isDark ? "rgba(249,115,22,0.05)" : "rgba(249,115,22,0.08)" }}
        />
        {!isDark && (
          <div className="absolute top-0 left-0 right-0 h-32 pointer-events-none"
            style={{ background: "linear-gradient(to bottom, rgba(255,241,242,0.4), transparent)" }}
          />
        )}

        {isLoading ? (
          <div className="flex justify-center py-24">
            <Loader2 className="h-10 w-10 animate-spin" style={{ color: "#f59e0b" }} />
          </div>
        ) : leaderboard && leaderboard.length >= 3 ? (
          <div className="flex items-end justify-center gap-6 md:gap-10 pt-4 pb-0 relative z-10">
            {[1, 0, 2].map((rankIndex) => {
              const user = leaderboard[rankIndex];
              if (!user) return null;
              const meta = PODIUM_META[rankIndex];
              const colTheme = theme.columns[rankIndex];
              const sparkles = theme.sparkleColors[rankIndex];
              const isMe = user.userId === session?.user?.id;
              const rank = rankIndex + 1;

              return (
                <div key={user.userId} className={`flex flex-col items-center gap-2 ${meta.order} group`}>
                  {/* Crown for #1 */}
                  {rank === 1 && (
                    <div className="text-4xl mb-0 animate-bounce" style={{ animationDuration: "3s" }}>👑</div>
                  )}

                  {/* Avatar */}
                  <div className="relative">
                    <Avatar className={`${meta.avatarSize} ring-4 ${meta.ring} shadow-2xl transition-transform group-hover:scale-110`}>
                      {(user.avatarUrl || user.image) ? (
                        <AvatarImage src={user.avatarUrl || user.image || ""} alt={user.name || ""} />
                      ) : null}
                      <AvatarFallback className={`bg-gradient-to-br ${meta.gradient} text-white font-bold ${meta.textSize}`}>
                        {user.name?.charAt(0) || "?"}
                      </AvatarFallback>
                    </Avatar>
                    {user.streak >= 3 && (
                      <div className="absolute -top-1 -right-1 bg-orange-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center shadow-md">🔥</div>
                    )}
                  </div>

                  {/* Name */}
                  <span className={`${meta.nameSize} font-semibold truncate max-w-[140px]`} style={{ color: theme.nameColor }}>
                    {user.name?.split(" ").slice(-1)[0] || user.username}
                    {isMe && <span style={{ color: "#f59e0b" }} className="text-xs ml-1">(You)</span>}
                  </span>

                  {/* Podium Column */}
                  <div className="relative">
                    {/* Glow */}
                    <div
                      className={`absolute -inset-3 rounded-2xl blur-xl ${rankIndex === 0 ? "podium-glow-gold" : rankIndex === 1 ? "podium-glow-silver" : "podium-glow-bronze"}`}
                      style={{ backgroundColor: colTheme.glow }}
                    />

                    {/* Column */}
                    <div
                      className={`relative w-32 md:w-36 ${meta.height} backdrop-blur-sm rounded-t-2xl flex flex-col items-center justify-start pt-4 gap-1.5 shadow-2xl transition-all group-hover:shadow-3xl overflow-hidden podium-shimmer`}
                      style={{
                        background: colTheme.bg,
                        border: `1px solid ${colTheme.border}`,
                      }}
                    >
                      <span className="relative font-black text-2xl opacity-90" style={{ color: theme.textPrimary }}>#{rank}</span>
                      <div className="relative flex items-center gap-1.5">
                        <Zap className="h-4 w-4" style={{ color: theme.zapColor }} />
                        <span className="font-bold text-lg" style={{ color: theme.textPrimary }}>{user.totalPoints}</span>
                      </div>
                      {user.streak >= 3 && (
                        <div className="relative flex items-center gap-0.5 text-xs font-medium" style={{ color: theme.streakColor }}>
                          <Flame className="h-3.5 w-3.5" />
                          {user.streak} days
                        </div>
                      )}
                    </div>

                    {/* Sparkle particles */}
                    <div className="absolute inset-0 pointer-events-none overflow-visible">
                      {sparkles.map((color, i) => (
                        <div
                          key={i}
                          className="sparkle-particle"
                          style={{
                            left: `${20 + i * 20}%`,
                            bottom: `${60 + i * 10}%`,
                            backgroundColor: color,
                          }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-20">
            <Trophy className="h-14 w-14 mx-auto mb-4" style={{ color: "rgba(251,191,36,0.4)" }} />
            <p className="font-medium text-lg" style={{ color: theme.textSecondary }}>Not enough players yet</p>
          </div>
        )}
      </div>

      {/* ===== PERIOD TABS ===== */}
      <div style={{ backgroundColor: isDark ? "#0c0a09" : "#f5f5f4", borderBottom: `1px solid ${isDark ? "#292524" : "#e7e5e4"}` }}>
        <div className="flex justify-center">
          <div className="flex">
            {PERIODS.map((p, idx) => (
              <button
                key={p.key}
                onClick={() => setPeriod(p.key)}
                className="px-6 py-3.5 text-sm font-medium transition-all duration-200 relative"
                style={{
                  color: period === p.key
                    ? (isDark ? "#ffffff" : "#1c1917")
                    : (isDark ? "#57534e" : "#a8a29e"),
                }}
              >
                {p.label}
                {period === p.key && (
                  <div className="absolute bottom-0 left-3 right-3 h-0.5 rounded-full"
                    style={{ background: "linear-gradient(to right, #fb7185, #fbbf24)" }}
                  />
                )}
                {idx < PERIODS.length - 1 && (
                  <span className="absolute right-0 top-1/2 -translate-y-1/2 text-xs"
                    style={{ color: isDark ? "#44403c" : "#d6d3d1" }}
                  >|</span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ===== MAIN CONTENT: List + Sidebar ===== */}
      {!isLoading && leaderboard && leaderboard.length > 0 && (
        <div
          className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-0 rounded-b-2xl overflow-hidden"
          style={{ backgroundColor: isDark ? "#0c0a09" : "#ffffff" }}
        >
          {/* Rankings List */}
          <div>
            {leaderboard.map((user, index) => {
              const rank = index + 1;
              const isMe = user.userId === session?.user?.id;
              const prevPoints = index > 0 ? leaderboard[index - 1].totalPoints : user.totalPoints;
              const gapToPrev = prevPoints - user.totalPoints;
              const progressPct = prevPoints > 0 ? Math.min(100, (user.totalPoints / prevPoints) * 100) : 100;

              return (
                <div
                  key={user.userId}
                  className="flex items-center gap-4 px-6 py-5 transition-all duration-200"
                  style={{
                    backgroundColor: isMe ? (isDark ? "rgba(251,113,133,0.08)" : "#fff1f2") : "transparent",
                    borderLeft: isMe ? "3px solid #f43f5e" : "3px solid transparent",
                    borderBottom: `1px solid ${isDark ? "rgba(68,64,60,0.6)" : "#e7e5e4"}`,
                  }}
                  onMouseEnter={e => { if (!isMe) e.currentTarget.style.backgroundColor = isDark ? "rgba(41,37,36,0.6)" : "#fafaf9"; }}
                  onMouseLeave={e => { if (!isMe) e.currentTarget.style.backgroundColor = "transparent"; }}
                >
                  {/* Rank Medal */}
                  <div className="w-10 text-center shrink-0">
                    {rank === 1 ? <span className="text-2xl">🥇</span> :
                     rank === 2 ? <span className="text-2xl">🥈</span> :
                     rank === 3 ? <span className="text-2xl">🥉</span> :
                     <span className="text-base font-bold" style={{ color: isDark ? "#57534e" : "#a8a29e" }}>#{rank}</span>}
                  </div>

                  {/* Avatar */}
                  <Avatar className="h-12 w-12 shrink-0" style={{ boxShadow: `0 0 0 2px ${isDark ? "#44403c" : "#e7e5e4"}` }}>
                    {(user.avatarUrl || user.image) ? (
                      <AvatarImage src={user.avatarUrl || user.image || ""} alt={user.name || ""} />
                    ) : null}
                    <AvatarFallback className={`text-base font-bold ${
                      rank <= 3
                        ? `bg-gradient-to-br ${PODIUM_META[rank - 1].gradient} text-white`
                        : ""
                    }`} style={rank > 3 ? { backgroundColor: isDark ? "#292524" : "#f5f5f4", color: isDark ? "#d6d3d1" : "#57534e" } : undefined}>
                      {user.name?.charAt(0) || "?"}
                    </AvatarFallback>
                  </Avatar>

                  {/* Name + Breakdown */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2.5">
                      <span className="font-semibold text-base truncate" style={{ color: isMe ? "#f43f5e" : (isDark ? "#e7e5e4" : "#292524") }}>
                        {user.name}
                        {isMe && <span className="text-sm font-normal ml-1.5" style={{ color: isDark ? "rgba(244,63,94,0.7)" : "#fb7185" }}>(You)</span>}
                      </span>
                      {user.streak >= 3 && (
                        <span className="text-xs font-medium flex items-center gap-0.5 shrink-0" style={{ color: isDark ? "#fb923c" : "#ea580c" }}>
                          <Flame className="h-3.5 w-3.5" />{user.streak}d
                        </span>
                      )}
                    </div>
                    <div className="flex gap-2 mt-1.5">
                      {user.reviewPoints > 0 && (
                        <span className="text-[10px] px-2.5 py-0.5 rounded-full font-semibold"
                          style={{ backgroundColor: isDark ? "rgba(59,130,246,0.2)" : "#dbeafe", color: isDark ? "#60a5fa" : "#2563eb", border: `1px solid ${isDark ? "rgba(59,130,246,0.2)" : "#bfdbfe"}` }}>
                          Review: {user.reviewPoints}
                        </span>
                      )}
                      {user.autoPoints > 0 && (
                        <span className="text-[10px] px-2.5 py-0.5 rounded-full font-semibold"
                          style={{ backgroundColor: isDark ? "rgba(16,185,129,0.2)" : "#d1fae5", color: isDark ? "#34d399" : "#059669", border: `1px solid ${isDark ? "rgba(16,185,129,0.2)" : "#a7f3d0"}` }}>
                          Auto: {user.autoPoints}
                        </span>
                      )}
                      {user.tempoBonus > 0 && (
                        <span className="text-[10px] px-2.5 py-0.5 rounded-full font-semibold"
                          style={{ backgroundColor: isDark ? "rgba(249,115,22,0.2)" : "#ffedd5", color: isDark ? "#fb923c" : "#ea580c", border: `1px solid ${isDark ? "rgba(249,115,22,0.2)" : "#fed7aa"}` }}>
                          Tempo: {user.tempoBonus}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Points + Progress */}
                  <div className="text-right shrink-0 space-y-1.5">
                    <div className="flex items-center gap-1.5 justify-end">
                      <span className="text-lg font-bold" style={{ color: isDark ? "#ffffff" : "#1c1917" }}>{user.totalPoints}</span>
                      <Zap className="h-4 w-4" style={{ color: isDark ? "#fbbf24" : "#f59e0b" }} />
                    </div>
                    {rank > 1 && gapToPrev > 0 && (
                      <div className="flex items-center gap-1.5">
                        <div className="w-20 h-2 rounded-full overflow-hidden" style={{ backgroundColor: isDark ? "#292524" : "#e7e5e4" }}>
                          <div className="h-full rounded-full transition-all duration-500"
                            style={{ width: `${progressPct}%`, background: "linear-gradient(to right, #fb7185, #fbbf24)" }}
                          />
                        </div>
                        <span className="text-[10px]" style={{ color: isDark ? "#57534e" : "#a8a29e" }}>-{gapToPrev}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* ===== SIDEBAR ===== */}
          <div className="p-6 space-y-6" style={{ borderLeft: `1px solid ${isDark ? "#292524" : "#e7e5e4"}` }}>
            {/* Your Stats */}
            <div className="rounded-xl p-5 space-y-4"
              style={{ backgroundColor: isDark ? "rgba(41,37,36,0.8)" : "#fafaf9", border: `1px solid ${isDark ? "#292524" : "#e7e5e4"}` }}>
              <h3 className="font-bold text-base flex items-center gap-2" style={{ color: isDark ? "#ffffff" : "#1c1917" }}>
                <TrendingUp className="h-5 w-5" style={{ color: isDark ? "#fb7185" : "#e11d48" }} />
                Your Stats
              </h3>

              {myStats ? (
                <>
                  <div className="flex justify-between items-center text-sm">
                    <span style={{ color: isDark ? "#a8a29e" : "#78716c" }}>Current rank:</span>
                    <span className="font-bold text-lg flex items-center gap-1" style={{ color: isDark ? "#ffffff" : "#1c1917" }}>
                      {myRankNum ? `#${myRankNum}` : "—"}
                      {myRankNum && myRankNum <= 3 && <ChevronUp className="h-4 w-4" style={{ color: "#10b981" }} />}
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-sm">
                    <span style={{ color: isDark ? "#a8a29e" : "#78716c" }}>Total points:</span>
                    <span className="font-bold text-lg" style={{ color: isDark ? "#ffffff" : "#1c1917" }}>{myStats.totalPoints}</span>
                  </div>

                  <div className="flex justify-between items-center text-sm">
                    <span style={{ color: isDark ? "#a8a29e" : "#78716c" }}>Current streak:</span>
                    <span className="font-bold text-base flex items-center gap-1" style={{ color: isDark ? "#ffffff" : "#1c1917" }}>
                      <Flame className="h-4 w-4" style={{ color: isDark ? "#fb923c" : "#ea580c" }} />
                      {myStats.streak} days
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-sm">
                    <span style={{ color: isDark ? "#a8a29e" : "#78716c" }}>Best streak:</span>
                    <span className="font-bold text-base" style={{ color: isDark ? "#ffffff" : "#1c1917" }}>{myStats.bestStreak} days</span>
                  </div>

                  {/* Mini Activity Chart */}
                  <div className="pt-3" style={{ borderTop: `1px solid ${isDark ? "#292524" : "#e7e5e4"}` }}>
                    <p className="text-[10px] uppercase tracking-wider mb-2 font-semibold" style={{ color: isDark ? "#57534e" : "#a8a29e" }}>7-Day Activity</p>
                    <div className="flex items-end gap-1.5 h-14">
                      {myStats.dailyActivity.map((d, i) => {
                        const maxActions = Math.max(1, ...myStats.dailyActivity.map(x => x.actions));
                        const heightPct = (d.actions / maxActions) * 100;
                        return (
                          <div key={i} className="flex-1 flex flex-col items-center gap-1">
                            <div
                              className="w-full rounded-sm transition-all duration-300"
                              style={{
                                height: `${Math.max(10, heightPct)}%`,
                                background: d.actions > 0
                                  ? "linear-gradient(to top, #f43f5e, #fbbf24)"
                                  : (isDark ? "#292524" : "#e7e5e4"),
                              }}
                              title={`${d.date}: ${d.actions} actions`}
                            />
                            <span className="text-[9px] font-medium" style={{ color: isDark ? "#57534e" : "#a8a29e" }}>{d.day.charAt(0)}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Motivational */}
                  {nextRankGap && nextRankGap > 0 && (
                    <div className="rounded-lg p-3.5 text-center"
                      style={{
                        background: isDark
                          ? "linear-gradient(to right, rgba(244,63,94,0.15), rgba(251,191,36,0.1))"
                          : "linear-gradient(to right, #fff1f2, #fffbeb)",
                        border: `1px solid ${isDark ? "rgba(244,63,94,0.2)" : "#fecdd3"}`,
                      }}>
                      <p className="text-sm font-medium" style={{ color: isDark ? "#fda4af" : "#e11d48" }}>
                        <Target className="h-4 w-4 inline mr-1" />
                        <strong>{nextRankGap}</strong> more points to reach <strong>#{myRankNum! - 1}</strong>!
                      </p>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center text-sm py-6" style={{ color: isDark ? "#57534e" : "#a8a29e" }}>
                  Start earning points!
                </div>
              )}
            </div>

            {/* How to Earn Points */}
            <div className="rounded-xl p-5"
              style={{ backgroundColor: isDark ? "rgba(41,37,36,0.8)" : "#fafaf9", border: `1px solid ${isDark ? "#292524" : "#e7e5e4"}` }}>
              <h4 className="text-xs uppercase tracking-wider mb-3 font-semibold" style={{ color: isDark ? "#a8a29e" : "#78716c" }}>How to Earn Points</h4>
              <div className="space-y-2.5 text-sm">
                {[
                  { icon: "✅", label: "Task done (early)", pts: "+15" },
                  { icon: "✅", label: "Task done (on time)", pts: "+10" },
                  { icon: "⏰", label: "Task done (late)", pts: "+5" },
                  { icon: "💬", label: "Comment", pts: "+1" },
                  { icon: "🔥", label: "Streak 3 days", pts: "+5" },
                  { icon: "🔥🔥", label: "Streak 7 days", pts: "+15" },
                ].map((item, i) => (
                  <div key={i} className="flex justify-between items-center">
                    <span style={{ color: isDark ? "#d6d3d1" : "#57534e" }}>{item.icon} {item.label}</span>
                    <span className="font-mono font-bold"
                      style={{ color: item.pts === "+5" ? (isDark ? "#78716c" : "#a8a29e") : (i <= 1 ? (isDark ? "#34d399" : "#059669") : (i === 3 ? (isDark ? "#60a5fa" : "#2563eb") : (isDark ? "#fb923c" : "#ea580c"))) }}>
                      {item.pts}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && (!leaderboard || leaderboard.length === 0) && (
        <div className="rounded-b-2xl text-center py-20" style={{ backgroundColor: isDark ? "#0c0a09" : "#ffffff" }}>
          <Trophy className="h-14 w-14 mx-auto mb-4" style={{ color: isDark ? "#44403c" : "#d6d3d1" }} />
          <p className="font-medium text-lg" style={{ color: isDark ? "#78716c" : "#57534e" }}>No scores yet this period</p>
          <p className="text-sm mt-1" style={{ color: isDark ? "#44403c" : "#a8a29e" }}>Complete tasks, leave comments, and stay active to earn points!</p>
        </div>
      )}
    </div>
  );
}
