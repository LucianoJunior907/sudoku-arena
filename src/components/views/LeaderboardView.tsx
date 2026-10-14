"use client";

import { useI18n } from "@/lib/i18n/context";
import { useAppStore, localDivision } from "@/lib/store/app-store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { NeedsBackendBanner } from "@/components/common/ComingSoon";
import { BarChart3, Trophy, Crown, Medal, Award } from "lucide-react";
import { DIVISIONS } from "@/lib/progression/progression";
import { formatTime } from "@/lib/sudoku/saved-game";
import { cn } from "@/lib/utils";

const DIV_LABEL_KEYS = {
  bronze: "leaderboard.bronze",
  silver: "leaderboard.silver",
  gold: "leaderboard.gold",
  platinum: "leaderboard.platinum",
  diamond: "leaderboard.diamond",
  master: "leaderboard.master",
  grandmaster: "leaderboard.grandmaster",
} as const;

const DIV_ICONS = [Medal, Medal, Award, Award, Crown, Crown, Crown];

export function LeaderboardView() {
  const { t } = useI18n();
  const profile = useAppStore((s) => s.profile);
  const stats = useAppStore((s) => s.stats);
  const level = useAppStore((s) => s.level);

  const division = localDivision(profile.rating);
  const soloWins =
    stats.solo.easy.wins + stats.solo.medium.wins + stats.solo.hard.wins + stats.solo.expert.wins;
  const soloPlayed =
    stats.solo.easy.played + stats.solo.medium.played + stats.solo.hard.played + stats.solo.expert.played;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="flex items-center gap-2 text-2xl font-bold">
          <BarChart3 className="h-6 w-6 text-primary" />
          {t("leaderboard.title")}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("leaderboard.subtitle")}</p>
      </div>

      <NeedsBackendBanner noteKey="leaderboard.needsBackend" />

      {/* Your rank card (local only) */}
      <Card className="p-5">
        <p className="mb-1 text-sm font-medium">{t("leaderboard.yourRank")}</p>
        <p className="text-xs text-muted-foreground">{t("profile.localOnly")}</p>
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <LocalStat label={t("common.level")} value={String(level)} />
          <LocalStat label={t("common.xp")} value={String(profile.totalXp)} />
          <LocalStat label={t("profile.rating")} value={String(profile.rating)} />
          <LocalStat label={t("leaderboard.divisions")} value={t(DIV_LABEL_KEYS[division])} />
        </div>
      </Card>

      {/* Global leaderboard (empty / needs backend) */}
      <Card className="p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="flex items-center gap-2 font-semibold">
            <Trophy className="h-4 w-4 text-[var(--warning)]" />
            {t("leaderboard.title")}
          </h3>
          <span className="text-xs text-muted-foreground">{t("leaderboard.season")}: 1</span>
        </div>
        <div className="flex h-48 flex-col items-center justify-center rounded-lg border border-dashed border-border text-center">
          <Crown className="mb-2 h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm font-medium text-muted-foreground">{t("leaderboard.needsBackend")}</p>
          <p className="mt-1 max-w-sm text-xs text-muted-foreground/70">
            {t("app.localModeDesc")}
          </p>
        </div>
      </Card>

      {/* Divisions ladder */}
      <Card className="p-5">
        <h3 className="mb-4 font-semibold">{t("leaderboard.divisions")}</h3>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
          {DIVISIONS.map((d, i) => {
            const Icon = DIV_ICONS[i] ?? Medal;
            const isCurrent = d.id === division;
            const isPassed = profile.rating >= d.min;
            return (
              <div
                key={d.id}
                className={cn(
                  "flex flex-col items-center rounded-lg border p-3 text-center transition-colors",
                  isCurrent ? "border-primary bg-primary/5" : "border-border",
                  !isPassed && "opacity-60"
                )}
              >
                <Icon className="mb-1 h-5 w-5" style={{ color: isPassed ? d.color : "var(--muted-foreground)" }} />
                <p className="text-xs font-medium">{t(DIV_LABEL_KEYS[d.id])}</p>
                <p className="text-[10px] text-muted-foreground">{d.min}+</p>
                {isCurrent && (
                  <span className="mt-1 rounded-full bg-primary px-1.5 py-0.5 text-[9px] font-semibold text-primary-foreground">
                    ★
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {/* Local stats summary */}
      <Card className="p-5">
        <h3 className="mb-3 font-semibold">{t("profile.statistics")} — {t("profile.localOnly")}</h3>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-2xl font-bold text-primary">{soloPlayed}</p>
            <p className="text-xs text-muted-foreground">{t("profile.gamesPlayed")}</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-[var(--success)]">{soloWins}</p>
            <p className="text-xs text-muted-foreground">{t("profile.wins")}</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-[var(--warning)]">
              {soloPlayed ? Math.round((soloWins / soloPlayed) * 100) : 0}%
            </p>
            <p className="text-xs text-muted-foreground">{t("profile.winRate")}</p>
          </div>
        </div>
      </Card>
    </div>
  );
}

function LocalStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-bold">{value}</p>
    </div>
  );
}
