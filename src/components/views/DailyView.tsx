"use client";

import { useMemo } from "react";
import { useSudokuGame } from "@/hooks/use-sudoku-game";
import { useAppStore } from "@/lib/store/app-store";
import { useI18n } from "@/lib/i18n/context";
import { SudokuGamePlay } from "@/components/sudoku/SudokuGamePlay";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatTime } from "@/lib/sudoku/saved-game";
import type { Difficulty } from "@/lib/sudoku/types";
import { CalendarDays, Flame, Trophy, Clock, Play, Info, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const DIFFICULTIES: { id: Difficulty; key: string; accent: string }[] = [
  { id: "easy", key: "difficulty.easy", accent: "from-emerald-500/20 to-emerald-500/5" },
  { id: "medium", key: "difficulty.medium", accent: "from-teal-500/20 to-teal-500/5" },
  { id: "hard", key: "difficulty.hard", accent: "from-amber-500/20 to-amber-500/5" },
  { id: "expert", key: "difficulty.expert", accent: "from-rose-500/20 to-rose-500/5" },
];

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function tomorrowDate(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function DailyView() {
  const { t } = useI18n();
  const setRoute = useAppStore((s) => s.setRoute);
  const streak = useAppStore((s) => s.streak);
  const dailyRecords = useAppStore((s) => s.dailyRecords);
  const game = useSudokuGame("daily");
  const { state } = game;

  const today = todayKey();
  const tomorrow = tomorrowDate();
  const msUntilTomorrow = tomorrow.getTime() - Date.now();
  const hoursUntil = Math.floor(msUntilTomorrow / 3_600_000);
  const minsUntil = Math.floor((msUntilTomorrow % 3_600_000) / 60_000);

  const recordsByDiff = useMemo(() => {
    const map: Record<Difficulty, { completed: boolean; bestTime: number | null; bestScore: number; count: number }> = {
      easy: { completed: false, bestTime: null, bestScore: 0, count: 0 },
      medium: { completed: false, bestTime: null, bestScore: 0, count: 0 },
      hard: { completed: false, bestTime: null, bestScore: 0, count: 0 },
      expert: { completed: false, bestTime: null, bestScore: 0, count: 0 },
    };
    for (const r of dailyRecords) {
      const m = map[r.difficulty];
      m.count += 1;
      if (r.completed) {
        m.completed = true;
        if (m.bestTime === null || r.elapsedSec < m.bestTime) m.bestTime = r.elapsedSec;
        if (r.score > m.bestScore) m.bestScore = r.score;
      }
    }
    // today's status
    for (const d of DIFFICULTIES) {
      const todayRec = dailyRecords.find((r) => r.date === today && r.difficulty === d.id && r.completed);
      map[d.id].completed = !!todayRec;
    }
    return map;
  }, [dailyRecords, today]);

  // Active game
  if (state.status !== "idle") {
    return (
      <SudokuGamePlay
        game={game}
        backLabel={t("daily.title")}
        showNewGame={false}
        onExit={() => { game.exit(); }}
        onPlayAgain={() => game.exit()}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">{t("daily.title")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("daily.subtitle")}</p>
      </div>

      {/* Today + streak + next */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <CalendarDays className="h-4 w-4 text-primary" />
            <span className="text-xs">{t("daily.today")}</span>
          </div>
          <p className="mt-1 text-lg font-bold">
            {new Date().toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" })}
          </p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Flame className="h-4 w-4 text-orange-500" />
            <span className="text-xs">{t("daily.streak")}</span>
          </div>
          <p className="mt-1 text-lg font-bold">{streak.count} {t("lobby.days")}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Clock className="h-4 w-4 text-[var(--warning)]" />
            <span className="text-xs">{t("daily.tomorrow")}</span>
          </div>
          <p className="mt-1 text-lg font-bold tabular-nums">{hoursUntil}h {minsUntil}m</p>
        </Card>
      </div>

      {/* Limitation notice */}
      <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-muted-foreground">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
        <p>{t("daily.limitation")}</p>
      </div>

      {/* Difficulty starters */}
      <div>
        <h3 className="mb-3 text-lg font-semibold">{t("solo.selectDifficulty")}</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {DIFFICULTIES.map((d) => {
            const rec = recordsByDiff[d.id];
            const doneToday = rec.completed;
            return (
              <Card key={d.id} className={cn("relative overflow-hidden p-4")}>
                <div className={cn("absolute inset-0 bg-gradient-to-br opacity-50", d.accent)} />
                <div className="relative">
                  <p className="font-semibold">{t(d.key as never)}</p>
                  {doneToday ? (
                    <Badge variant="default" className="mt-2 gap-1 bg-[var(--success)] text-[var(--success-foreground)]">
                      <Sparkles className="h-3 w-3" />
                      {t("daily.completed")}
                    </Badge>
                  ) : (
                    <p className="mt-1 text-xs text-muted-foreground">{t("daily.notCompleted")}</p>
                  )}
                  <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                    <p className="flex items-center justify-between">
                      <span>{t("daily.bestTime")}</span>
                      <span className="font-mono">{rec.bestTime !== null ? formatTime(rec.bestTime) : "—"}</span>
                    </p>
                    <p className="flex items-center justify-between">
                      <span>{t("daily.score")}</span>
                      <span className="font-mono">{rec.bestScore || "—"}</span>
                    </p>
                  </div>
                  <Button
                    size="sm"
                    className="mt-3 w-full"
                    onClick={() => game.startDaily(today, d.id)}
                  >
                    <Play className="mr-1.5 h-3.5 w-3.5" />
                    {t("daily.startChallenge")}
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Records history */}
      <Card className="p-5">
        <h3 className="mb-3 flex items-center gap-2 font-semibold">
          <Trophy className="h-4 w-4 text-[var(--warning)]" />
          {t("daily.records")}
        </h3>
        {dailyRecords.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">{t("history.empty")}</p>
        ) : (
          <div className="scrollbar-thin max-h-72 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-card">
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="py-2 pr-3">{t("history.date")}</th>
                  <th className="py-2 pr-3">{t("history.difficulty")}</th>
                  <th className="py-2 pr-3">{t("history.time")}</th>
                  <th className="py-2 pr-3 text-right">{t("daily.score")}</th>
                </tr>
              </thead>
              <tbody>
                {dailyRecords.slice(0, 50).map((r, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="py-2 pr-3 text-xs">{new Date(r.date).toLocaleDateString()}</td>
                    <td className="py-2 pr-3">{t(`difficulty.${r.difficulty}` as never)}</td>
                    <td className="py-2 pr-3 font-mono">{r.completed ? formatTime(r.elapsedSec) : "—"}</td>
                    <td className="py-2 pr-3 text-right font-mono font-semibold">{r.score || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="flex justify-center">
        <Button variant="outline" onClick={() => setRoute("lobby")}>
          {t("common.back")}
        </Button>
      </div>
    </div>
  );
}
