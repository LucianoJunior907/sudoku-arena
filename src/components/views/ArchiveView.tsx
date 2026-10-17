"use client";

import { useMemo } from "react";
import { useAppStore } from "@/lib/store/app-store";
import { useI18n } from "@/lib/i18n/context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { generatePuzzle } from "@/lib/sudoku/engine";
import type { Difficulty } from "@/lib/sudoku/types";
import { Archive, Crown, Play, ChevronLeft, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";

interface WeekEntry {
  year: number;
  week: number;
  seed: string;
  label: string;
  dateRange: string;
  isCurrent: boolean;
}

function getISOWeek(date: Date): { year: number; week: number } {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return { year: d.getUTCFullYear(), week };
}

function weekDateRange(year: number, week: number): string {
  const simple = new Date(Date.UTC(year, 0, 1 + (week - 1) * 7));
  const day = simple.getUTCDay() || 7;
  const monday = new Date(simple);
  monday.setUTCDate(simple.getUTCDate() - day + 1);
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  const fmt = (d: Date) =>
    d.toLocaleDateString(undefined, { day: "2-digit", month: "short" });
  return `${fmt(monday)} – ${fmt(sunday)}`;
}

export function ArchiveView() {
  const { t } = useI18n();
  const setRoute = useAppStore((s) => s.setRoute);
  const setPracticeBoard = useAppStore((s) => s.setPracticeBoard);

  // Generate the last 12 weeks (including current)
  const weeks = useMemo<WeekEntry[]>(() => {
    const now = new Date();
    const current = getISOWeek(now);
    const out: WeekEntry[] = [];
    for (let i = 0; i < 12; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() - i * 7);
      const { year, week } = getISOWeek(d);
      const seed = `week-${year}-W${week}-v1`;
      out.push({
        year,
        week,
        seed,
        label: `${t("archive.week")} ${week}/${year}`,
        dateRange: weekDateRange(year, week),
        isCurrent: year === current.year && week === current.week,
      });
    }
    return out;
  }, [t]);

  const playWeek = (entry: WeekEntry) => {
    const p = generatePuzzle("hard" as Difficulty, entry.seed);
    setPracticeBoard({
      puzzle: p.puzzle,
      solution: p.solution,
      notes: Array.from({ length: 81 }, () => []),
      difficulty: "hard" as Difficulty,
      seed: entry.seed,
    });
    setRoute("solo");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-bold">
            <Archive className="h-6 w-6 text-primary" />
            {t("archive.title")}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{t("archive.subtitle")}</p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setRoute("lobby")}>
          <ChevronLeft className="mr-1 h-4 w-4" />
          {t("solo.backToLobby")}
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {weeks.map((entry) => (
          <Card
            key={entry.seed}
            className={cn(
              "group relative overflow-hidden p-5 transition-all hover:border-primary/40 hover:shadow-md",
              entry.isCurrent && "border-[var(--chart-4)]/40 ring-1 ring-[var(--chart-4)]/20"
            )}
          >
            {entry.isCurrent && (
              <div className="absolute -right-6 -top-6 h-24 w-24 rounded-sm bg-[var(--chart-4)]/10 blur-2xl" />
            )}
            <div className="relative flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-sm",
                    entry.isCurrent
                      ? "bg-[var(--chart-4)]/15 text-[var(--chart-4)]"
                      : "bg-primary/10 text-primary"
                  )}
                >
                  <Crown className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-semibold">{entry.label}</p>
                  <p className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    {entry.dateRange}
                  </p>
                </div>
              </div>
              {entry.isCurrent && (
                <Badge variant="outline" className="border-[var(--chart-4)]/40 text-[var(--chart-4)]">
                  {t("archive.current")}
                </Badge>
              )}
            </div>
            <div className="relative mt-4 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                {t("archive.difficulty")}
              </span>
              <Button
                size="sm"
                onClick={() => playWeek(entry)}
                className="gap-1.5"
              >
                <Play className="h-3.5 w-3.5" />
                {t("archive.play")}
              </Button>
            </div>
          </Card>
        ))}
      </div>

      <p className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
        {t("lobby.puzzleOfWeekDesc")}
      </p>
    </div>
  );
}
