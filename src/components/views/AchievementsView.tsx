"use client";

import { useI18n } from "@/lib/i18n/context";
import { useAppStore } from "@/lib/store/app-store";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ACHIEVEMENTS, totalAchievementXp } from "@/lib/progression/achievements";
import { Lock, Check, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const CAT_KEY: Record<string, "achievements.cat.solo" | "achievements.cat.daily" | "achievements.cat.level" | "achievements.cat.skill"> = {
  solo: "achievements.cat.solo",
  daily: "achievements.cat.daily",
  level: "achievements.cat.level",
  skill: "achievements.cat.skill",
};

const CAT_ORDER = ["solo", "skill", "daily", "level"] as const;

export function AchievementsView() {
  const { t, locale } = useI18n();
  const unlocked = useAppStore((s) => s.unlockedAchievements);
  const unlockedSet = new Set(unlocked);
  const unlockedCount = unlocked.length;
  const totalCount = ACHIEVEMENTS.length;
  const pct = totalCount ? Math.round((unlockedCount / totalCount) * 100) : 0;
  const earnedXp = ACHIEVEMENTS.filter((a) => unlockedSet.has(a.id)).reduce((s, a) => s + a.xpReward, 0);
  const totalXp = totalAchievementXp();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">{t("achievements.title")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("achievements.subtitle")}</p>
      </div>

      {/* Progress overview */}
      <Card className="relative overflow-hidden p-5">
        <div className="absolute inset-0 bg-gradient-to-br from-[var(--warning)]/10 via-transparent to-primary/10" />
        <div className="relative">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-sm text-muted-foreground">{t("achievements.progress")}</p>
              <p className="text-3xl font-bold">
                {unlockedCount}<span className="text-lg text-muted-foreground">/{totalCount}</span>
              </p>
            </div>
            <div className="text-right">
              <p className="flex items-center gap-1 text-sm text-[var(--warning)]">
                <Sparkles className="h-4 w-4" />
                {earnedXp} / {totalXp} {t("common.xp")}
              </p>
            </div>
          </div>
          <Progress value={pct} className="mt-3 h-2.5" />
          <p className="mt-2 text-xs text-muted-foreground">{pct}%</p>
        </div>
      </Card>

      {/* By category */}
      {CAT_ORDER.map((cat) => {
        const items = ACHIEVEMENTS.filter((a) => a.category === cat);
        if (items.length === 0) return null;
        return (
          <div key={cat}>
            <h3 className="mb-3 text-lg font-semibold">{t(CAT_KEY[cat])}</h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((a) => {
                const isUnlocked = unlockedSet.has(a.id);
                const Icon = a.icon;
                return (
                  <Card
                    key={a.id}
                    className={cn(
                      "relative overflow-hidden p-4 transition-all",
                      isUnlocked
                        ? "border-[var(--warning)]/40 bg-gradient-to-br from-[var(--warning)]/5 to-transparent"
                        : "opacity-70"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={cn(
                          "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
                          isUnlocked ? "bg-[var(--warning)]/15 text-[var(--warning)]" : "bg-muted text-muted-foreground"
                        )}
                      >
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold">{a.name[locale]}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">{a.desc[locale]}</p>
                        <p className="mt-1 text-xs font-semibold text-primary">+{a.xpReward} {t("common.xp")}</p>
                      </div>
                      {isUnlocked ? (
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--success)] text-[var(--success-foreground)]">
                          <Check className="h-3.5 w-3.5" />
                        </span>
                      ) : (
                        <Lock className="h-4 w-4 text-muted-foreground/60" />
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
