"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n/context";
import { useAppStore, localDivision } from "@/lib/store/app-store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/common/Avatar";
import { BarChart3, Trophy, Crown, Medal, Award, RefreshCw, Loader2, Wifi } from "lucide-react";
import { DIVISIONS } from "@/lib/progression/progression";
import { fetchGlobalLeaderboard, type LeaderboardEntry } from "@/lib/supabase/matches";
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
  const { t, locale } = useI18n();
  const profile = useAppStore((s) => s.profile);
  const stats = useAppStore((s) => s.stats);
  const level = useAppStore((s) => s.level);

  const division = localDivision(profile.rating);
  const soloWins =
    stats.solo.easy.wins + stats.solo.medium.wins + stats.solo.hard.wins + stats.solo.expert.wins;
  const soloPlayed =
    stats.solo.easy.played + stats.solo.medium.played + stats.solo.hard.played + stats.solo.expert.played;

  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadLeaderboard = async () => {
    setLoading(true);
    setError(null);
    const data = await fetchGlobalLeaderboard(50);
    setEntries(data);
    setLoading(false);
  };

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      const data = await fetchGlobalLeaderboard(50);
      if (!cancelled) {
        setEntries(data);
        setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="flex items-center gap-2 text-2xl font-bold">
          <BarChart3 className="h-6 w-6 text-primary" />
          {t("leaderboard.title")}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("leaderboard.subtitle")}</p>
      </div>

      {/* Online indicator */}
      <div className="flex items-center gap-2 rounded-lg border border-[var(--success)]/30 bg-[var(--success)]/5 p-3 text-sm">
        <Wifi className="h-4 w-4 text-[var(--success)]" />
        <span className="font-medium text-[var(--success)]">
          {locale === "pt-BR" ? "Ranking global online!" : "Global leaderboard online!"}
        </span>
      </div>

      {/* Your rank card (local) */}
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

      {/* Global leaderboard (from Supabase) */}
      <Card className="p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="flex items-center gap-2 font-semibold">
            <Trophy className="h-4 w-4 text-[var(--warning)]" />
            {t("leaderboard.title")}
          </h3>
          <Button variant="ghost" size="sm" onClick={loadLeaderboard} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </Button>
        </div>

        {loading ? (
          <div className="flex h-48 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : entries.length === 0 ? (
          <div className="flex h-48 flex-col items-center justify-center rounded-lg border border-dashed border-border text-center">
            <Crown className="mb-2 h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm font-medium text-muted-foreground">
              {locale === "pt-BR" ? "Nenhuma partida registrada ainda." : "No matches recorded yet."}
            </p>
            <p className="mt-1 text-xs text-muted-foreground/70">
              {locale === "pt-BR" ? "Entre e jogue para aparecer no ranking!" : "Sign in and play to appear on the leaderboard!"}
            </p>
          </div>
        ) : (
          <div className="scrollbar-thin max-h-96 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-card">
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="px-3 py-2">#</th>
                  <th className="px-3 py-2">{locale === "pt-BR" ? "Jogador" : "Player"}</th>
                  <th className="px-3 py-2 text-center">{locale === "pt-BR" ? "Nível" : "Level"}</th>
                  <th className="px-3 py-2 text-right">Rating</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry, i) => {
                  const div = localDivision(entry.rating);
                  const divInfo = DIVISIONS.find((d) => d.id === div);
                  return (
                    <tr key={i} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="px-3 py-2">
                        <span className={cn(
                          "flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold",
                          i === 0 ? "bg-[var(--warning)]/15 text-[var(--warning)]" :
                          i === 1 ? "bg-muted-foreground/15 text-muted-foreground" :
                          i === 2 ? "bg-[#cd7f32]/15 text-[#cd7f32]" :
                          "text-muted-foreground"
                        )}>
                          {i + 1}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <Avatar seed={entry.avatarSeed} size={28} className="rounded-md" />
                          <div>
                            <span className="font-medium">{entry.displayName}</span>
                            {entry.username && (
                              <span className="ml-1.5 text-xs text-muted-foreground">@{entry.username}</span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-center text-muted-foreground">
                        {entry.level}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <span className="font-mono font-semibold tabular-nums" style={divInfo ? { color: divInfo.color } : undefined}>
                          {entry.rating}
                        </span>
                        <span className="ml-1.5 text-xs" style={divInfo ? { color: divInfo.color } : undefined}>
                          {t(`leaderboard.${div}` as never)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
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
                <p className="text-xs font-medium">{t(DIV_LABEL_KEYS[d.id as keyof typeof DIV_LABEL_KEYS])}</p>
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
