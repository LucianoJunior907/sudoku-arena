"use client";

import { useMemo } from "react";
import {
  ResponsiveContainer,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Tooltip,
} from "recharts";
import { useAppStore } from "@/lib/store/app-store";
import { useI18n } from "@/lib/i18n/context";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Avatar } from "@/components/common/Avatar";
import { formatTime } from "@/lib/sudoku/saved-game";
import { ACHIEVEMENTS } from "@/lib/progression/achievements";
import { localDivision } from "@/lib/store/app-store";
import { DIVISIONS } from "@/lib/progression/progression";
import type { Difficulty } from "@/lib/sudoku/types";
import {
  Trophy,
  Clock,
  Flame,
  Star,
  Award,
  Target,
  Zap,
  TrendingUp,
  Calendar,
  Sparkles,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

const DIFFS: Difficulty[] = ["easy", "medium", "hard", "expert"];

export function OverviewView() {
  const { t, locale } = useI18n();
  const profile = useAppStore((s) => s.profile);
  const level = useAppStore((s) => s.level);
  const stats = useAppStore((s) => s.stats);
  const history = useAppStore((s) => s.history);
  const streak = useAppStore((s) => s.streak);
  const dailyRecords = useAppStore((s) => s.dailyRecords);
  const unlockedAchievements = useAppStore((s) => s.unlockedAchievements);
  const setRoute = useAppStore((s) => s.setRoute);

  const soloPlayed = DIFFS.reduce((s, d) => s + stats.solo[d].played, 0);
  const soloWins = DIFFS.reduce((s, d) => s + stats.solo[d].wins, 0);
  const soloTotalTime = DIFFS.reduce((s, d) => s + stats.solo[d].totalTimeSec, 0);
  const soloBestTime = DIFFS.reduce<number | null>((best, d) => {
    const b = stats.solo[d].bestTimeSec;
    if (b === null) return best;
    return best === null ? b : Math.min(best, b);
  }, null);
  const dailyCompleted = dailyRecords.filter((r) => r.completed).length;

  const division = localDivision(profile.rating);
  const divInfo = DIVISIONS.find((d) => d.id === division)!;
  const achievementCount = unlockedAchievements.length;
  const achievementPct = Math.round((achievementCount / ACHIEVEMENTS.length) * 100);
  const achievementXp = ACHIEVEMENTS.filter((a) => unlockedAchievements.includes(a.id)).reduce(
    (s, a) => s + a.xpReward,
    0
  );

  // radar chart data: wins per difficulty
  const radarData = useMemo(
    () =>
      DIFFS.map((d) => ({
        difficulty: t(`difficulty.${d}` as never),
        wins: stats.solo[d].wins,
      })),
    [stats, t, locale]
  );

  const quickStats = [
    {
      icon: <Trophy className="h-5 w-5 text-[var(--warning)]" />,
      label: t("profile.gamesPlayed"),
      value: String(soloPlayed),
      accent: "from-amber-500/10",
    },
    {
      icon: <Star className="h-5 w-5 text-[var(--success)]" />,
      label: t("profile.wins"),
      value: String(soloWins),
      accent: "from-emerald-500/10",
    },
    {
      icon: <Flame className="h-5 w-5 text-orange-500" />,
      label: t("overview.bestStreak"),
      value: String(streak.count),
      accent: "from-orange-500/10",
    },
    {
      icon: <Clock className="h-5 w-5 text-primary" />,
      label: t("overview.totalTime"),
      value: formatTime(soloTotalTime),
      accent: "from-primary/10",
    },
    {
      icon: <Zap className="h-5 w-5 text-[var(--chart-4)]" />,
      label: t("overview.avgTime"),
      value: soloPlayed ? formatTime(Math.round(soloTotalTime / soloPlayed)) : "—",
      accent: "from-purple-500/10",
    },
    {
      icon: <Target className="h-5 w-5 text-[var(--chart-5)]" />,
      label: t("profile.bestTime"),
      value: soloBestTime !== null ? formatTime(soloBestTime) : "—",
      accent: "from-rose-500/10",
    },
    {
      icon: <Calendar className="h-5 w-5 text-teal-500" />,
      label: t("daily.completed"),
      value: String(dailyCompleted),
      accent: "from-teal-500/10",
    },
    {
      icon: <Award className="h-5 w-5 text-[var(--warning)]" />,
      label: t("overview.achievementsProgress"),
      value: `${achievementCount}/${ACHIEVEMENTS.length}`,
      accent: "from-amber-500/10",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">{t("overview.title")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("overview.subtitle")}</p>
      </div>

      {/* Profile summary card */}
      <Card className="relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-20"
          style={{ background: `radial-gradient(circle at 15% 20%, ${divInfo.color}, transparent 65%)` }}
        />
        <div className="absolute inset-0 bg-arena-grid opacity-30" />
        <div className="relative flex flex-col gap-4 p-6 sm:flex-row sm:items-center">
          <Avatar seed={profile.avatarSeed} size={72} className="ring-4 ring-primary/20" />
          <div className="flex-1">
            <h3 className="text-xl font-bold">{profile.displayName}</h3>
            <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Star className="h-3.5 w-3.5 text-primary" /> {t("common.level")} {level}
              </span>
              <span className="flex items-center gap-1" style={{ color: divInfo.color }}>
                <Trophy className="h-3.5 w-3.5" /> {t(`leaderboard.${division}` as never)}
              </span>
              <span className="flex items-center gap-1">
                <Sparkles className="h-3.5 w-3.5 text-[var(--warning)]" />
                {profile.totalXp} {t("common.xp")}
              </span>
            </div>
            <div className="mt-2">
              <p className="text-xs text-muted-foreground">
                {t("overview.achievementsProgress")}: {achievementCount}/{ACHIEVEMENTS.length} · +{achievementXp} {t("common.xp")}
              </p>
              <Progress value={achievementPct} className="mt-1 h-1.5 max-w-xs" />
            </div>
          </div>
          <button
            onClick={() => setRoute("profile")}
            className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
          >
            {t("profile.title")}
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </Card>

      {/* Quick stats grid */}
      <div>
        <h3 className="mb-3 text-lg font-semibold">{t("overview.quickStats")}</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {quickStats.map((s, i) => (
            <Card key={i} className={cn("group relative overflow-hidden p-4 transition-all hover:border-primary/30 hover:shadow-md")}>
              <div className={cn("absolute inset-0 bg-gradient-to-br to-transparent opacity-50", s.accent)} />
              <div className="relative">
                <div className="mb-2 transition-transform group-hover:scale-110">{s.icon}</div>
                <p className="text-2xl font-bold tabular-nums">{s.value}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{s.label}</p>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* Radar + recent activity */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Wins radar */}
        <Card className="p-5">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold">
            <TrendingUp className="h-4 w-4 text-primary" />
            {t("profile.wins")} · {t("nav.solo")}
          </h3>
          {soloWins === 0 ? (
            <div className="flex h-[220px] items-center justify-center text-xs text-muted-foreground">
              {t("overview.noActivity")}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <RadarChart data={radarData} margin={{ top: 8, right: 24, bottom: 8, left: 24 }}>
                <PolarGrid className="stroke-border" />
                <PolarAngleAxis dataKey="difficulty" tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                <PolarRadiusAxis tick={{ fontSize: 9 }} className="fill-muted-foreground" />
                <Tooltip
                  contentStyle={{
                    background: "var(--popover)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  formatter={(v: number) => [v, t("profile.wins")]}
                />
                <Radar dataKey="wins" stroke="var(--primary)" fill="var(--primary)" fillOpacity={0.35} strokeWidth={2} />
              </RadarChart>
            </ResponsiveContainer>
          )}
        </Card>

        {/* Recent activity */}
        <Card className="p-5">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold">
            <Clock className="h-4 w-4 text-primary" />
            {t("overview.recentGames")}
          </h3>
          {history.length === 0 ? (
            <div className="flex h-[220px] items-center justify-center text-center text-xs text-muted-foreground">
              {t("overview.noActivity")}
            </div>
          ) : (
            <div className="scrollbar-thin max-h-[220px] space-y-1.5 overflow-y-auto">
              {history.slice(0, 10).map((h) => (
                <div
                  key={h.id}
                  className="flex items-center justify-between rounded-md border border-border/60 px-3 py-2 text-xs hover:bg-muted/30"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "flex h-6 w-6 items-center justify-center rounded-full",
                        h.completed ? "bg-[var(--success)]/15 text-[var(--success)]" : "bg-muted text-muted-foreground"
                      )}
                    >
                      {h.completed ? <Trophy className="h-3 w-3" /> : <X className="h-3 w-3" />}
                    </span>
                    <div>
                      <p className="font-medium">{t(`nav.${h.mode}` as never)} · {t(`difficulty.${h.difficulty}` as never)}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {new Date(h.date).toLocaleDateString()} · {formatTime(h.elapsedSec)}
                      </p>
                    </div>
                  </div>
                  <span className="font-mono font-semibold text-primary">+{h.xp}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Daily streak summary */}
      <Card className="p-5">
        <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold">
          <Flame className="h-4 w-4 text-orange-500" />
          {t("daily.streak")}
        </h3>
        <div className="flex flex-wrap items-center gap-6">
          <div className="text-center">
            <p className="text-4xl font-bold text-orange-500">{streak.count}</p>
            <p className="text-xs text-muted-foreground">{t("lobby.days")}</p>
          </div>
          <div className="h-12 w-px bg-border" />
          <div className="text-center">
            <p className="text-2xl font-bold">{dailyCompleted}</p>
            <p className="text-xs text-muted-foreground">{t("daily.completed")}</p>
          </div>
          <div className="h-12 w-px bg-border" />
          <button
            onClick={() => setRoute("daily")}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium transition-colors hover:border-primary/40 hover:text-primary"
          >
            {t("nav.daily")}
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </Card>

      {/* Achievements summary */}
      <Card className="p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <Award className="h-4 w-4 text-[var(--warning)]" />
            {t("overview.achievementsProgress")}
          </h3>
          <button
            onClick={() => setRoute("achievements")}
            className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-primary"
          >
            {t("achievements.title")}
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
        <Progress value={achievementPct} className="h-2" />
        <div className="mt-4 grid grid-cols-4 gap-2 sm:grid-cols-8">
          {ACHIEVEMENTS.map((a) => {
            const unlocked = unlockedAchievements.includes(a.id);
            const Icon = a.icon;
            return (
              <div
                key={a.id}
                title={`${a.name[locale]}${unlocked ? "" : " 🔒"}`}
                className={cn(
                  "flex aspect-square items-center justify-center rounded-lg border transition-all",
                  unlocked
                    ? "border-[var(--warning)]/40 bg-[var(--warning)]/5 text-[var(--warning)]"
                    : "border-border text-muted-foreground/40"
                )}
              >
                <Icon className="h-5 w-5" />
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

function X({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}
