"use client";

import { useAppStore } from "@/lib/store/app-store";
import { useI18n } from "@/lib/i18n/context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { levelFromXp } from "@/lib/progression/progression";
import { generatePuzzle } from "@/lib/sudoku/engine";
import {
  Sparkles,
  User,
  Users,
  Swords,
  GraduationCap,
  CalendarDays,
  Play,
  ArrowRight,
  Flame,
  Clock,
  Trophy,
  Wifi,
  Crown,
} from "lucide-react";
import type { Difficulty } from "@/lib/sudoku/types";
import { getSavedGameSummary } from "@/lib/sudoku/saved-game";

export function LobbyView() {
  const { t } = useI18n();
  const setRoute = useAppStore((s) => s.setRoute);
  const setPracticeBoard = useAppStore((s) => s.setPracticeBoard);
  const profile = useAppStore((s) => s.profile);
  const level = useAppStore((s) => s.level);
  const streak = useAppStore((s) => s.streak);
  const stats = useAppStore((s) => s.stats);

  const info = levelFromXp(profile.totalXp);
  const pct = Math.min(100, Math.round((info.intoLevel / info.neededForLevel) * 100));

  const savedSummary = getSavedGameSummary("solo");

  const totalPlayed =
    stats.solo.easy.played + stats.solo.medium.played + stats.solo.hard.played + stats.solo.expert.played;

  const modes = [
    { id: "solo" as const, icon: User, online: false },
    { id: "duo" as const, icon: Users, online: true },
    { id: "ranked" as const, icon: Swords, online: true },
  ];

  const difficulties: { id: Difficulty; key: string }[] = [
    { id: "easy", key: "difficulty.easy" },
    { id: "medium", key: "difficulty.medium" },
    { id: "hard", key: "difficulty.hard" },
    { id: "expert", key: "difficulty.expert" },
  ];

  return (
    <div className="space-y-6">
      {/* Hero */}
      <Card className="relative overflow-hidden border-primary/20">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-[var(--warning)]/10" />
        <div className="absolute inset-0 bg-arena-grid opacity-40" />
        <div className="absolute -right-8 -top-8 h-40 w-40 rounded-sm bg-primary/20 blur-3xl" />
        <div className="absolute -bottom-10 left-1/3 h-32 w-32 rounded-sm bg-[var(--warning)]/15 blur-3xl" />
        <div className="relative flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{t("lobby.welcome")},</p>
            <h2 className="text-3xl font-bold tracking-tight">{profile.displayName}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{t("lobby.subtitle")}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button onClick={() => setRoute("solo")} size="lg" className="shadow-md">
                <Play className="mr-1.5 h-4 w-4" />
                {t("lobby.quickPlay")}
              </Button>
              <Button variant="secondary" onClick={() => setRoute("daily")} size="lg">
                <Sparkles className="mr-1.5 h-4 w-4" />
                {t("lobby.dailyChallenge")}
              </Button>
              <Button variant="outline" onClick={() => setRoute("guide")} size="lg">
                <GraduationCap className="mr-1.5 h-4 w-4" />
                {t("lobby.learnTechniques")}
              </Button>
            </div>
          </div>

          {/* Level card */}
          <Card className="w-full max-w-xs border-primary/20 bg-card/80 p-4 backdrop-blur">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="relative flex h-11 w-11 items-center justify-center rounded-md bg-gradient-to-br from-primary to-[var(--chart-4)] text-primary-foreground font-bold shadow-md">
                  <span className="relative z-10">{level}</span>
                  <div className="absolute inset-0 rounded-md bg-white/10" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{t("lobby.level")}</p>
                  <p className="text-sm font-semibold">{info.level}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">{t("lobby.xp")}</p>
                <p className="text-sm font-semibold tabular-nums">{info.intoLevel}/{info.neededForLevel}</p>
              </div>
            </div>
            <Progress value={pct} className="mt-3 h-2" />
            <p className="mt-1.5 text-right text-[10px] text-muted-foreground">{pct}%</p>
          </Card>
        </div>
      </Card>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard
          icon={<Flame className="h-5 w-5 text-orange-500" />}
          label={t("lobby.streak")}
          value={`${streak.count} ${t("lobby.days")}`}
        />
        <StatCard
          icon={<Trophy className="h-5 w-5 text-[var(--warning)]" />}
          label={t("profile.gamesPlayed")}
          value={String(totalPlayed)}
        />
        <StatCard
          icon={<Clock className="h-5 w-5 text-primary" />}
          label={t("common.xp")}
          value={String(profile.totalXp)}
        />
        <StatCard
          icon={<Sparkles className="h-5 w-5 text-[var(--chart-4)]" />}
          label={t("profile.rating")}
          value={String(profile.rating)}
        />
      </div>

      {/* Continue game */}
      {savedSummary && (
        <Card className="border-primary/30 bg-primary/5 p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-sm bg-primary/10">
                <Clock className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium">{t("lobby.continueGame")}</p>
                <p className="text-xs text-muted-foreground">
                  {t(`difficulty.${savedSummary.difficulty}`)} · {savedSummary.progress}% · {savedSummary.timeLabel}
                </p>
              </div>
            </div>
            <Button size="sm" onClick={() => setRoute("solo")}>
              {t("solo.resume")}
              <ArrowRight className="ml-1.5 h-4 w-4" />
            </Button>
          </div>
        </Card>
      )}

      {/* Game modes */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-semibold">{t("lobby.modes")}</h3>
          <p className="text-sm text-muted-foreground">{t("lobby.modesDesc")}</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {modes.map((m) => {
            const Icon = m.icon;
            return (
              <Card
                key={m.id}
                className="group cursor-pointer p-5 transition-all hover:border-primary/40 hover:shadow-md"
                onClick={() => setRoute(m.id)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex h-11 w-11 items-center justify-center rounded-md bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                    <Icon className="h-5 w-5" />
                  </div>
                  {m.online && (
                    <span className="inline-flex items-center gap-1 rounded-sm bg-[var(--success)]/10 px-2 py-0.5 text-[10px] font-medium text-[var(--success)]">
                      <Wifi className="h-3 w-3" />
                      Online
                    </span>
                  )}
                </div>
                <p className="mt-3 font-semibold">{t(`nav.${m.id}`)}</p>
                <p className="mt-1 text-xs text-muted-foreground">{t(`${m.id}.subtitle`)}</p>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Daily featured + difficulty quick start */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="cursor-pointer p-5 transition-all hover:border-primary/40" onClick={() => setRoute("daily")}>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-md bg-[var(--warning)]/15 text-[var(--warning)]">
              <CalendarDays className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <p className="font-semibold">{t("lobby.featuredDaily")}</p>
              <p className="text-xs text-muted-foreground">{t("daily.subtitle")}</p>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
          </div>
        </Card>

        <Card className="p-5">
          <p className="mb-3 font-semibold">{t("solo.selectDifficulty")}</p>
          <div className="grid grid-cols-2 gap-2">
            {difficulties.map((d) => (
              <Button
                key={d.id}
                variant="outline"
                size="sm"
                className="justify-start"
                onClick={() => setRoute("solo")}
              >
                {t(d.key as never)}
              </Button>
            ))}
          </div>
        </Card>
      </div>

      {/* Puzzle of the Week */}
      <Card className="relative overflow-hidden border-[var(--chart-4)]/30 p-5">
        <div className="absolute inset-0 bg-gradient-to-r from-[var(--chart-4)]/10 via-transparent to-[var(--warning)]/10" />
        <div className="absolute -right-6 -top-6 h-32 w-32 rounded-sm bg-[var(--chart-4)]/15 blur-2xl" />
        <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-md bg-[var(--chart-4)]/15 text-[var(--chart-4)]">
              <Crown className="h-6 w-6" />
            </div>
            <div>
              <p className="font-semibold">{t("lobby.puzzleOfWeek")}</p>
              <p className="text-xs text-muted-foreground">{t("lobby.puzzleOfWeekDesc")}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => {
                // Deterministic seed from ISO week — same board for everyone on this version
                const now = new Date();
                const year = now.getFullYear();
                const onejan = new Date(year, 0, 1);
                const week = Math.ceil(((now.getTime() - onejan.getTime()) / 86400000 + onejan.getDay() + 1) / 7);
                const seed = `week-${year}-W${week}-v1`;
                const p = generatePuzzle("hard", seed);
                setPracticeBoard({
                  puzzle: p.puzzle,
                  solution: p.solution,
                  notes: Array.from({ length: 81 }, () => []),
                  difficulty: "hard" as Difficulty,
                  seed,
                });
                setRoute("solo");
              }}
              className="gap-1.5"
            >
              <Play className="h-4 w-4" />
              {t("lobby.playWeek")}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setRoute("archive")}>
              {t("lobby.viewArchive")}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Card className="group relative overflow-hidden p-4 transition-all hover:border-primary/30 hover:shadow-md">
      <div className="absolute -right-4 -top-4 h-16 w-16 rounded-sm bg-primary/5 opacity-0 transition-opacity group-hover:opacity-100" />
      <div className="relative flex items-center gap-2">
        <span className="transition-transform group-hover:scale-110">{icon}</span>
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <p className="relative mt-1.5 text-xl font-bold tabular-nums">{value}</p>
    </Card>
  );
}
