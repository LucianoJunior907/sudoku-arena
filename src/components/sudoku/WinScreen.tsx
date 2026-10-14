"use client";

import { useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Trophy, Clock, AlertTriangle, Lightbulb, Sparkles, Star } from "lucide-react";
import type { XpResult } from "@/hooks/use-sudoku-game";
import { useI18n } from "@/lib/i18n/context";
import { useAppStore } from "@/lib/store/app-store";
import type { Difficulty } from "@/lib/sudoku/types";
import { formatTime } from "@/lib/sudoku/saved-game";
import { ACHIEVEMENTS } from "@/lib/progression/achievements";

export function WinScreen({
  difficulty,
  elapsedSec,
  mistakes,
  hintsUsed,
  xpResult,
  onPlayAgain,
  onBack,
}: {
  difficulty: Difficulty;
  elapsedSec: number;
  mistakes: number;
  hintsUsed: number;
  xpResult: XpResult | null;
  onPlayAgain: () => void;
  onBack: () => void;
}) {
  const { t, locale } = useI18n();
  const level = useAppStore((s) => s.level);
  const stats = useAppStore((s) => s.stats);

  const isRecord = xpResult?.isRecord ?? false;

  const confetti = useMemo(
    () =>
      Array.from({ length: 40 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 0.6,
        duration: 1.6 + Math.random() * 1.4,
        color: ["var(--primary)", "var(--warning)", "var(--chart-4)", "var(--chart-5)", "var(--success)"][i % 5],
        size: 6 + Math.random() * 6,
      })),
    []
  );

  useEffect(() => {
    // play a subtle celebration via DOM (no audio asset needed)
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
      {/* confetti */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {confetti.map((c) => (
          <span
            key={c.id}
            className="absolute top-0 block rounded-sm animate-confetti"
            style={{
              left: `${c.left}%`,
              width: c.size,
              height: c.size * 1.6,
              background: c.color,
              animationDelay: `${c.delay}s`,
              animationDuration: `${c.duration}s`,
            }}
          />
        ))}
      </div>

      <Card className="relative w-full max-w-md overflow-hidden border-primary/30 p-6 animate-float-up">
        <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-primary via-[var(--warning)] to-primary shimmer" />
        <div className="flex flex-col items-center text-center">
          <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--warning)]/15 animate-pop">
            <Trophy className="h-8 w-8 text-[var(--warning)]" />
          </div>
          <h2 className="text-2xl font-bold text-primary">{t("solo.win")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t("solo.winDesc")}</p>
          {isRecord && (
            <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-[var(--warning)]/15 px-3 py-1 text-xs font-semibold text-[var(--warning)]">
              <Star className="h-3.5 w-3.5" />
              {t("solo.newRecord")}
            </div>
          )}

          <div className="mt-5 grid w-full grid-cols-2 gap-3">
            <Stat icon={<Clock className="h-4 w-4 text-primary" />} label={t("solo.time")} value={formatTime(elapsedSec)} />
            <Stat
              icon={<AlertTriangle className="h-4 w-4 text-[var(--destructive)]" />}
              label={t("solo.errorsCount")}
              value={String(mistakes)}
            />
            <Stat
              icon={<Lightbulb className="h-4 w-4 text-[var(--warning)]" />}
              label={t("solo.hintsUsed")}
              value={String(hintsUsed)}
            />
            <Stat
              icon={<Sparkles className="h-4 w-4 text-[var(--chart-4)]" />}
              label={t("solo.xpEarned")}
              value={`+${xpResult?.xp ?? 0}${xpResult?.bonusXp ? ` +${xpResult.bonusXp}` : ""}`}
            />
          </div>

          {xpResult?.unlockedAchievements && xpResult.unlockedAchievements.length > 0 && (
            <div className="mt-4 w-full rounded-lg border border-[var(--warning)]/30 bg-[var(--warning)]/5 p-3 text-center">
              <p className="flex items-center justify-center gap-1.5 text-sm font-semibold text-[var(--warning)]">
                <Trophy className="h-4 w-4" />
                {t("achievements.unlocked")}
              </p>
              <div className="mt-2 space-y-1">
                {xpResult.unlockedAchievements.map((id) => {
                  const ach = ACHIEVEMENTS.find((a) => a.id === id);
                  if (!ach) return null;
                  const Icon = ach.icon;
                  return (
                    <div key={id} className="flex items-center justify-center gap-1.5 text-xs">
                      <Icon className="h-3.5 w-3.5 text-[var(--warning)]" />
                      <span className="font-medium">{ach.name[locale]}</span>
                      <span className="text-muted-foreground">+{ach.xpReward} XP</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {xpResult?.leveledUp && (
            <div className="mt-4 w-full rounded-lg border border-primary/30 bg-primary/5 p-3 text-center">
              <p className="text-sm font-semibold text-primary">{t("xp.levelUp")}</p>
              <p className="text-xs text-muted-foreground">
                {t("xp.nowLevel")} {xpResult.newLevel} · {t("common.level")} {level}
              </p>
            </div>
          )}

          {/* best time for this difficulty */}
          <p className="mt-4 text-xs text-muted-foreground">
            {t("difficulty." + difficulty)} · {t("profile.bestTime")}:{" "}
            {stats.solo[difficulty].bestTimeSec !== null
              ? formatTime(stats.solo[difficulty].bestTimeSec!)
              : "—"}
          </p>

          <div className="mt-5 flex w-full gap-2">
            <Button variant="outline" className="flex-1" onClick={onBack}>
              {t("solo.backToLobby")}
            </Button>
            <Button className="flex-1" onClick={onPlayAgain}>
              {t("solo.playAgain")}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon}
        {label}
      </div>
      <p className="mt-1 text-lg font-bold">{value}</p>
    </div>
  );
}
