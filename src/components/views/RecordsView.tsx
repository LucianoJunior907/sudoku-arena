"use client";

import { useMemo } from "react";
import { useAppStore } from "@/lib/store/app-store";
import { useI18n } from "@/lib/i18n/context";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatTime } from "@/lib/sudoku/saved-game";
import type { Difficulty } from "@/lib/sudoku/types";
import { Trophy, Clock, Target, TrendingUp, Medal, Award, Timer } from "lucide-react";
import { cn } from "@/lib/utils";

const DIFFS: Difficulty[] = ["easy", "medium", "hard", "expert"];

const DIFF_META: Record<Difficulty, { accent: string; ring: string; medal: string }> = {
  easy: {
    accent: "from-emerald-500/15 to-emerald-500/5",
    ring: "ring-emerald-500/30",
    medal: "🥇",
  },
  medium: {
    accent: "from-teal-500/15 to-teal-500/5",
    ring: "ring-teal-500/30",
    medal: "🥈",
  },
  hard: {
    accent: "from-amber-500/15 to-amber-500/5",
    ring: "ring-amber-500/30",
    medal: "🥉",
  },
  expert: {
    accent: "from-rose-500/15 to-rose-500/5",
    ring: "ring-rose-500/30",
    medal: "🏆",
  },
};

export function RecordsView() {
  const { t } = useI18n();
  const stats = useAppStore((s) => s.stats);
  const setRoute = useAppStore((s) => s.setRoute);

  const rows = useMemo(
    () =>
      DIFFS.map((d) => {
        const s = stats.solo[d];
        return {
          difficulty: d,
          played: s.played,
          wins: s.wins,
          bestTime: s.bestTimeSec,
          totalTime: s.totalTimeSec,
          avgTime: s.played ? Math.round(s.totalTimeSec / s.played) : null,
          winRate: s.played ? Math.round((s.wins / s.played) * 100) : 0,
        };
      }),
    [stats]
  );

  // Rank difficulties by best time (only those with a record). Lower time = better rank.
  const ranked = useMemo(() => {
    const withRecord = rows.filter((r) => r.bestTime !== null);
    withRecord.sort((a, b) => (a.bestTime! - b.bestTime!));
    const rankMap = new Map<Difficulty, number>();
    withRecord.forEach((r, i) => rankMap.set(r.difficulty, i + 1));
    return rankMap;
  }, [rows]);

  const totalWins = rows.reduce((s, r) => s + r.wins, 0);
  const totalPlayed = rows.reduce((s, r) => s + r.played, 0);
  const overallBest = rows.reduce<number | null>((best, r) => {
    if (r.bestTime === null) return best;
    return best === null ? r.bestTime : Math.min(best, r.bestTime);
  }, null);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="flex items-center gap-2 text-2xl font-bold">
          <Timer className="h-6 w-6 text-primary" />
          {t("records.title")}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("records.subtitle")}</p>
      </div>

      {/* Overall summary */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="p-4 text-center">
          <Trophy className="mx-auto mb-1 h-5 w-5 text-[var(--warning)]" />
          <p className="text-2xl font-bold tabular-nums">{overallBest !== null ? formatTime(overallBest) : "—"}</p>
          <p className="text-xs text-muted-foreground">{t("records.bestTime")}</p>
        </Card>
        <Card className="p-4 text-center">
          <Target className="mx-auto mb-1 h-5 w-5 text-[var(--success)]" />
          <p className="text-2xl font-bold tabular-nums">{totalWins}</p>
          <p className="text-xs text-muted-foreground">{t("records.wins")}</p>
        </Card>
        <Card className="p-4 text-center">
          <TrendingUp className="mx-auto mb-1 h-5 w-5 text-primary" />
          <p className="text-2xl font-bold tabular-nums">{totalPlayed ? Math.round((totalWins / totalPlayed) * 100) : 0}%</p>
          <p className="text-xs text-muted-foreground">{t("records.winRate")}</p>
        </Card>
      </div>

      {/* Per-difficulty record cards */}
      <div className="grid gap-4 sm:grid-cols-2">
        {rows.map((r) => {
          const meta = DIFF_META[r.difficulty];
          const rank = ranked.get(r.difficulty);
          const hasRecord = r.bestTime !== null;
          return (
            <Card
              key={r.difficulty}
              className={cn(
                "relative overflow-hidden p-5 ring-1 transition-all hover:shadow-md",
                meta.ring
              )}
            >
              <div className={cn("absolute inset-0 bg-gradient-to-br opacity-60", meta.accent)} />
              <div className="relative">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{meta.medal}</span>
                    <div>
                      <p className="text-lg font-bold">{t(`difficulty.${r.difficulty}` as never)}</p>
                      {rank && (
                        <p className="text-xs text-muted-foreground">
                          {t("records.rank")} #{rank}
                        </p>
                      )}
                    </div>
                  </div>
                  {hasRecord ? (
                    <Badge variant="outline" className="gap-1 border-primary/40 text-primary">
                      <Trophy className="h-3 w-3" />
                      {formatTime(r.bestTime!)}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-muted-foreground">
                      {t("records.noRecord")}
                    </Badge>
                  )}
                </div>

                <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <RecordStat icon={<Target className="h-3.5 w-3.5" />} label={t("records.gamesPlayed")} value={String(r.played)} />
                  <RecordStat icon={<Medal className="h-3.5 w-3.5" />} label={t("records.wins")} value={String(r.wins)} />
                  <RecordStat icon={<TrendingUp className="h-3.5 w-3.5" />} label={t("records.winRate")} value={`${r.winRate}%`} />
                  <RecordStat icon={<Clock className="h-3.5 w-3.5" />} label={t("records.avgTime")} value={r.avgTime !== null ? formatTime(r.avgTime) : "—"} />
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Podium for fastest record */}
      {ranked.size > 0 && (
        <Card className="p-5">
          <h3 className="mb-4 flex items-center gap-2 font-semibold">
            <Award className="h-4 w-4 text-[var(--warning)]" />
            {t("records.bestTime")} — {t("records.rank")}
          </h3>
          <div className="flex items-end justify-center gap-3">
            {Array.from(ranked.entries())
              .sort((a, b) => a[1] - b[1])
              .slice(0, 3)
              .map(([diff, rank]) => {
                const s = stats.solo[diff];
                const meta = DIFF_META[diff];
                const heights = ["h-24", "h-16", "h-12"];
                const medals = ["🥇", "🥈", "🥉"];
                return (
                  <div key={diff} className="flex flex-col items-center gap-1">
                    <span className="text-2xl">{medals[rank - 1]}</span>
                    <span className="text-xs font-medium">{t(`difficulty.${diff}` as never)}</span>
                    <span className="font-mono text-sm font-bold tabular-nums">{formatTime(s.bestTimeSec!)}</span>
                    <div
                      className={cn(
                        "w-16 rounded-t-lg bg-gradient-to-t from-primary/40 to-primary/80",
                        heights[rank - 1]
                      )}
                    />
                  </div>
                );
              })}
          </div>
        </Card>
      )}

      <p className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
        {t("records.localOnly")}
      </p>

      <div className="flex justify-center">
        <button
          onClick={() => setRoute("solo")}
          className="inline-flex items-center gap-1 rounded-lg border border-border px-4 py-2 text-sm font-medium transition-colors hover:border-primary/40 hover:text-primary"
        >
          {t("nav.solo")}
          <TrendingUp className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function RecordStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-muted-foreground">{icon}</span>
      <span className="text-xs text-muted-foreground">{label}:</span>
      <span className="ml-auto font-mono text-xs font-semibold tabular-nums">{value}</span>
    </div>
  );
}
