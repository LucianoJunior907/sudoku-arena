"use client";

import { useState } from "react";
import { useAppStore } from "@/lib/store/app-store";
import { useI18n } from "@/lib/i18n/context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Avatar } from "@/components/common/Avatar";
import {
  COSMETICS,
  levelFromXp,
  DIVISIONS,
  type Cosmetic,
  type GameMode,
} from "@/lib/progression/progression";
import { localDivision } from "@/lib/store/app-store";
import { formatTime } from "@/lib/sudoku/saved-game";
import type { Difficulty } from "@/lib/sudoku/types";
import { Pencil, Lock, Check, RefreshCw, Star, Trophy, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { TranslationKey } from "@/lib/i18n/translations";

const DIFFICULTIES: Difficulty[] = ["easy", "medium", "hard", "expert"];

export function ProfileView() {
  const { t, locale } = useI18n();
  const profile = useAppStore((s) => s.profile);
  const level = useAppStore((s) => s.level);
  const stats = useAppStore((s) => s.stats);
  const updateProfile = useAppStore((s) => s.updateProfile);

  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState(profile.displayName);
  const [editSeed, setEditSeed] = useState(profile.avatarSeed);

  const info = levelFromXp(profile.totalXp);
  const pct = Math.min(100, Math.round((info.intoLevel / info.neededForLevel) * 100));
  const division = localDivision(profile.rating);
  const divInfo = DIVISIONS.find((d) => d.id === division)!;

  const equippedFrame = COSMETICS.find((c) => c.id === profile.frameId) ?? COSMETICS[0];
  const equippedTitle = COSMETICS.find((c) => c.id === profile.titleId);
  const equippedEffect = COSMETICS.find((c) => c.id === profile.effectId);

  const cosmeticName = (c: Cosmetic) => (locale === "pt-BR" ? c.name : c.nameEn);

  const save = () => {
    updateProfile({
      displayName: editName.trim() || "Player",
      avatarSeed: editSeed,
    });
    setEditOpen(false);
    toast.success(t("common.save"));
  };

  // Aggregate stats per mode
  const modeAggregates = (mode: GameMode) => {
    const s = stats[mode];
    let played = 0, wins = 0, total = 0;
    let best: number | null = null;
    for (const d of DIFFICULTIES) {
      played += s[d].played;
      wins += s[d].wins;
      total += s[d].totalTimeSec;
      if (s[d].bestTimeSec !== null && (best === null || s[d].bestTimeSec! < best)) best = s[d].bestTimeSec;
    }
    return { played, wins, total, best, winRate: played ? Math.round((wins / played) * 100) : 0, avg: played ? Math.round(total / played) : 0 };
  };

  const soloAgg = modeAggregates("solo");
  const dailyAgg = modeAggregates("daily");

  return (
    <div className="space-y-6">
      {/* Header card */}
      <Card className="relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-20"
          style={{ background: `radial-gradient(circle at 20% 20%, ${divInfo.color}, transparent 60%)` }}
        />
        <div className="relative flex flex-col gap-4 p-6 sm:flex-row sm:items-center">
          <div className="relative">
            <Avatar seed={profile.avatarSeed} size={88} className={cn("ring-4", equippedFrame.preview)} />
            <Button
              size="icon"
              variant="secondary"
              className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full"
              onClick={() => setEditOpen(true)}
              aria-label={t("profile.editProfile")}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          </div>

          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-bold">{profile.displayName}</h2>
              {equippedTitle && (
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                  {cosmeticName(equippedTitle)}
                </span>
              )}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Star className="h-3.5 w-3.5" /> {t("common.level")} {level}
              </span>
              <span className="flex items-center gap-1" style={{ color: divInfo.color }}>
                <Trophy className="h-3.5 w-3.5" /> {t(`leaderboard.${division}` as never)}
              </span>
              <span className="flex items-center gap-1">
                {t("profile.rating")}: {profile.rating}
              </span>
            </div>
            <div className="mt-3 flex items-center gap-3">
              <Progress value={pct} className="h-2 max-w-xs" />
              <span className="text-xs text-muted-foreground">
                {info.intoLevel}/{info.neededForLevel} {t("common.xp")} · {profile.totalXp} total
              </span>
            </div>
          </div>

          <Dialog open={editOpen} onOpenChange={setEditOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("profile.editProfile")}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="flex justify-center">
                  <Avatar seed={editSeed} size={80} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="name">{t("profile.displayName")}</Label>
                  <Input
                    id="name"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    maxLength={20}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("profile.avatar")}</Label>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEditSeed("arena-" + Math.random().toString(36).slice(2, 10))}
                  >
                    <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                    {locale === "pt-BR" ? "Gerar novo" : "Generate new"}
                  </Button>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setEditOpen(false)}>
                  {t("common.cancel")}
                </Button>
                <Button onClick={save}>{t("common.save")}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </Card>

      <p className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
        {t("profile.localOnly")}
      </p>

      {/* Statistics by mode */}
      <div>
        <h3 className="mb-3 text-lg font-semibold">{t("profile.statistics")}</h3>
        <div className="grid gap-4 lg:grid-cols-2">
          <ModeStatsCard title={t("nav.solo")} agg={soloAgg} t={t} />
          <ModeStatsCard title={t("nav.daily")} agg={dailyAgg} t={t} />
        </div>

        {/* Per-difficulty breakdown for solo */}
        <Card className="mt-4 p-5">
          <p className="mb-3 text-sm font-medium">{t("profile.byMode")} — {t("nav.solo")}</p>
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="py-2 pr-4">{t("history.difficulty")}</th>
                  <th className="py-2 pr-4">{t("profile.gamesPlayed")}</th>
                  <th className="py-2 pr-4">{t("profile.wins")}</th>
                  <th className="py-2 pr-4">{t("profile.winRate")}</th>
                  <th className="py-2 pr-4">{t("profile.bestTime")}</th>
                </tr>
              </thead>
              <tbody>
                {DIFFICULTIES.map((d) => {
                  const s = stats.solo[d];
                  return (
                    <tr key={d} className="border-b last:border-0">
                      <td className="py-2 pr-4 font-medium">{t(`difficulty.${d}` as never)}</td>
                      <td className="py-2 pr-4">{s.played}</td>
                      <td className="py-2 pr-4">{s.wins}</td>
                      <td className="py-2 pr-4">{s.played ? Math.round((s.wins / s.played) * 100) : 0}%</td>
                      <td className="py-2 pr-4">{s.bestTimeSec !== null ? formatTime(s.bestTimeSec) : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* Cosmetics */}
      <div>
        <h3 className="mb-3 text-lg font-semibold">{t("profile.cosmetics")}</h3>
        <div className="space-y-4">
          <CosmeticSection
            type="frame"
            titleKey="profile.frames"
            equippedId={profile.frameId}
            level={level}
            onEquip={(id) => updateProfile({ frameId: id })}
            cosmeticName={cosmeticName}
          />
          <CosmeticSection
            type="title"
            titleKey="profile.titles"
            equippedId={profile.titleId ?? ""}
            level={level}
            onEquip={(id) => updateProfile({ titleId: id })}
            cosmeticName={cosmeticName}
          />
          <CosmeticSection
            type="effect"
            titleKey="profile.effects"
            equippedId={profile.effectId}
            level={level}
            onEquip={(id) => updateProfile({ effectId: id })}
            cosmeticName={cosmeticName}
          />
        </div>
      </div>
    </div>
  );
}

function ModeStatsCard({
  title,
  agg,
  t,
}: {
  title: string;
  agg: { played: number; wins: number; winRate: number; best: number | null; avg: number };
  t: (k: TranslationKey) => string;
}) {
  return (
    <Card className="p-5">
      <p className="mb-3 font-semibold">{title}</p>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <Stat label={t("profile.gamesPlayed")} value={String(agg.played)} />
        <Stat label={t("profile.wins")} value={String(agg.wins)} />
        <Stat label={t("profile.winRate")} value={`${agg.winRate}%`} />
        <Stat label={t("profile.bestTime")} value={agg.best !== null ? formatTime(agg.best) : "—"} icon={<Clock className="h-3 w-3" />} />
      </div>
    </Card>
  );
}

function Stat({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <p className="flex items-center gap-1 text-xs text-muted-foreground">{icon}{label}</p>
      <p className="mt-1 text-lg font-bold">{value}</p>
    </div>
  );
}

function CosmeticSection({
  type,
  titleKey,
  equippedId,
  level,
  onEquip,
  cosmeticName,
}: {
  type: "frame" | "title" | "effect";
  titleKey: TranslationKey;
  equippedId: string;
  level: number;
  onEquip: (id: string) => void;
  cosmeticName: (c: Cosmetic) => string;
}) {
  const { t } = useI18n();
  const items = COSMETICS.filter((c) => c.type === type);

  return (
    <Card className="p-5">
      <p className="mb-3 text-sm font-medium">{t(titleKey)}</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {items.map((c) => {
          const unlocked = level >= c.unlockLevel;
          const equipped = equippedId === c.id;
          return (
            <button
              key={c.id}
              disabled={!unlocked}
              onClick={() => onEquip(c.id)}
              className={cn(
                "relative flex flex-col items-center gap-2 rounded-lg border p-3 text-center transition-colors",
                equipped
                  ? "border-primary bg-primary/5"
                  : unlocked
                  ? "border-border hover:border-primary/40"
                  : "border-border opacity-60"
              )}
            >
              {type === "frame" && (
                <div className={cn("h-8 w-8 rounded-full bg-muted", c.preview)} />
              )}
              {type === "title" && (
                <span className="text-xs font-semibold text-primary">{cosmeticName(c)}</span>
              )}
              {type === "effect" && (
                <div className={cn("h-8 w-8 rounded-full bg-gradient-to-br from-primary/30 to-[var(--warning)]/30", c.preview)} />
              )}
              <span className="text-xs">{cosmeticName(c)}</span>
              <span className="text-[10px] text-muted-foreground">
                {t("common.level")} {c.unlockLevel}
              </span>
              {equipped ? (
                <span className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Check className="h-2.5 w-2.5" />
                </span>
              ) : !unlocked ? (
                <span className="absolute right-1.5 top-1.5 text-muted-foreground">
                  <Lock className="h-3 w-3" />
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </Card>
  );
}
