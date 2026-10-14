"use client";

import { useI18n } from "@/lib/i18n/context";
import { useAppStore, localDivision } from "@/lib/store/app-store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { NeedsBackendBanner, RulesList, DisabledButton } from "@/components/common/ComingSoon";
import { Swords, Trophy, Clock, AlertTriangle, Calendar } from "lucide-react";
import { DIVISIONS } from "@/lib/progression/progression";
import { cn } from "@/lib/utils";

const RANKED_RULES = [
  "ranked.rules.1",
  "ranked.rules.2",
  "ranked.rules.3",
  "ranked.rules.4",
  "ranked.rules.5",
  "ranked.rules.6",
  "ranked.rules.7",
] as const;

const DIV_LABEL_KEYS: Record<string, "leaderboard.bronze" | "leaderboard.silver" | "leaderboard.gold" | "leaderboard.platinum" | "leaderboard.diamond" | "leaderboard.master" | "leaderboard.grandmaster"> = {
  bronze: "leaderboard.bronze",
  silver: "leaderboard.silver",
  gold: "leaderboard.gold",
  platinum: "leaderboard.platinum",
  diamond: "leaderboard.diamond",
  master: "leaderboard.master",
  grandmaster: "leaderboard.grandmaster",
};

export function RankedView() {
  const { t } = useI18n();
  const profile = useAppStore((s) => s.profile);
  const stats = useAppStore((s) => s.stats);

  const rating = profile.rating;
  const division = localDivision(rating);
  const divIndex = DIVISIONS.findIndex((d) => d.id === division);
  const currentDiv = DIVISIONS[divIndex];
  const nextDiv = DIVISIONS[divIndex + 1];
  const progressInDiv = nextDiv
    ? Math.round(((rating - currentDiv.min) / (nextDiv.min - currentDiv.min)) * 100)
    : 100;

  const rankedPlayed =
    stats.ranked.easy.played + stats.ranked.medium.played + stats.ranked.hard.played + stats.ranked.expert.played;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="flex items-center gap-2 text-2xl font-bold">
          <Swords className="h-6 w-6 text-primary" />
          {t("ranked.title")}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("ranked.subtitle")}</p>
      </div>

      <NeedsBackendBanner noteKey="ranked.needsBackend" />

      {/* Your rating + division */}
      <Card className="relative overflow-hidden p-5">
        <div
          className="absolute inset-0 opacity-15"
          style={{ background: `radial-gradient(circle at 30% 20%, ${currentDiv.color}, transparent 65%)` }}
        />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center">
          <div
            className="flex h-16 w-16 items-center justify-center rounded-2xl text-2xl font-bold"
            style={{ background: `color-mix(in oklch, ${currentDiv.color} 20%, transparent)`, color: currentDiv.color }}
          >
            <Trophy className="h-8 w-8" />
          </div>
          <div className="flex-1">
            <p className="text-xs text-muted-foreground">{t("ranked.yourDivision")}</p>
            <p className="text-xl font-bold" style={{ color: currentDiv.color }}>
              {t(DIV_LABEL_KEYS[division])}
            </p>
            <p className="text-sm text-muted-foreground">
              {t("ranked.yourRating")}: <span className="font-mono font-semibold text-foreground">{rating}</span>
              {nextDiv && (
                <span className="ml-2 text-xs">
                  ({nextDiv.min - rating} {t("ranked.yourRating").toLowerCase()} → {t(DIV_LABEL_KEYS[nextDiv.id as keyof typeof DIV_LABEL_KEYS])})
                </span>
              )}
            </p>
            <Progress value={progressInDiv} className="mt-2 h-1.5 max-w-xs" />
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground">{t("profile.gamesPlayed")}</p>
            <p className="text-2xl font-bold">{rankedPlayed}</p>
          </div>
        </div>
        <p className="relative mt-3 text-center text-xs text-muted-foreground">
          {t("ranked.needsBackend")}
        </p>
      </Card>

      {/* Queue (disabled) */}
      <Card className="p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium">{t("ranked.queue")}</p>
            <p className="text-xs text-muted-foreground">{t("ranked.estimated")}: —</p>
          </div>
          <DisabledButton label={t("ranked.queue")} />
        </div>
      </Card>

      <RulesList rules={[...RANKED_RULES]} />

      {/* Divisions ladder */}
      <Card className="p-5">
        <h3 className="mb-4 flex items-center gap-2 font-semibold">
          <Trophy className="h-4 w-4 text-[var(--warning)]" />
          {t("leaderboard.divisions")}
        </h3>
        <div className="space-y-2">
          {DIVISIONS.map((d, i) => {
            const isCurrent = d.id === division;
            const isPassed = rating >= d.min;
            const labelKey = DIV_LABEL_KEYS[d.id];
            return (
              <div
                key={d.id}
                className={cn(
                  "flex items-center gap-3 rounded-lg border p-3 transition-colors",
                  isCurrent ? "border-primary bg-primary/5" : "border-border"
                )}
              >
                <div
                  className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold"
                  style={{
                    background: isPassed ? `color-mix(in oklch, ${d.color} 25%, transparent)` : "var(--muted)",
                    color: isPassed ? d.color : "var(--muted-foreground)",
                  }}
                >
                  {i + 1}
                </div>
                <div className="flex-1">
                  <p className={cn("font-medium", !isPassed && "text-muted-foreground")} style={isPassed ? { color: d.color } : undefined}>
                    {t(labelKey)}
                  </p>
                  <p className="text-xs text-muted-foreground">{d.min}+ {t("ranked.yourRating").toLowerCase()}</p>
                </div>
                {isCurrent && (
                  <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">
                    {t("profile.equipped").toLowerCase()}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {/* Seasons */}
      <Card className="p-5">
        <h3 className="mb-2 flex items-center gap-2 font-semibold">
          <Calendar className="h-4 w-4 text-primary" />
          {t("leaderboard.season")}
        </h3>
        <p className="text-sm text-muted-foreground">{t("ranked.seasons")}</p>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
          <div className="rounded-lg border p-2">
            <Clock className="mx-auto mb-1 h-4 w-4 text-muted-foreground" />
            <p className="font-medium">2-3 {t("lobby.days").replace("dias", "meses").replace("days", "months")}</p>
          </div>
          <div className="rounded-lg border p-2">
            <Trophy className="mx-auto mb-1 h-4 w-4 text-[var(--warning)]" />
            <p className="font-medium">{t("leaderboard.season")}</p>
          </div>
          <div className="rounded-lg border p-2">
            <AlertTriangle className="mx-auto mb-1 h-4 w-4 text-[var(--destructive)]" />
            <p className="font-medium">3 {t("solo.errors").toLowerCase()}</p>
          </div>
        </div>
      </Card>
    </div>
  );
}
