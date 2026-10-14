"use client";

import { useEffect } from "react";
import { useAppStore } from "@/lib/store/app-store";
import { useI18n } from "@/lib/i18n/context";
import { Card } from "@/components/ui/card";
import { X, Sparkles } from "lucide-react";
import { ACHIEVEMENTS } from "@/lib/progression/achievements";

export function AchievementToast() {
  const toasts = useAppStore((s) => s.achievementToasts);
  const dismiss = useAppStore((s) => s.dismissAchievementToast);
  const { locale } = useI18n();

  const latest = toasts[toasts.length - 1];

  useEffect(() => {
    if (!latest) return;
    const timer = setTimeout(() => dismiss(latest.id), 8000);
    return () => clearTimeout(timer);
  }, [latest, dismiss]);

  if (!latest) return null;

  const ach = ACHIEVEMENTS.find((a) => a.id === latest.achievementId);
  if (!ach) return null;
  const Icon = ach.icon;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[100] flex justify-center px-4 animate-float-up">
      <Card className="pointer-events-auto relative w-full max-w-sm overflow-hidden border-[var(--warning)]/40 bg-card/95 shadow-2xl backdrop-blur">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[var(--warning)] via-primary to-[var(--warning)] shimmer" />
        <button
          onClick={() => dismiss(latest.id)}
          className="absolute right-2 top-2 rounded-md p-1 text-muted-foreground hover:bg-muted"
          aria-label="close"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="flex items-start gap-3 p-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--warning)]/15 animate-pop">
            <Icon className="h-6 w-6 text-[var(--warning)]" />
          </div>
          <div className="flex-1">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--warning)]">
              <Sparkles className="h-3 w-3" />
              {locale === "pt-BR" ? "Conquista desbloqueada" : "Achievement unlocked"}
            </p>
            <p className="text-base font-bold">{ach.name[locale]}</p>
            <p className="text-xs text-muted-foreground">{ach.desc[locale]}</p>
            <p className="mt-1 text-xs font-semibold text-primary">+{latest.xpReward} XP</p>
          </div>
        </div>
      </Card>
    </div>
  );
}
