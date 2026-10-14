"use client";

import { useEffect } from "react";
import { useAppStore } from "@/lib/store/app-store";
import { useT } from "@/lib/i18n/context";
import { Card } from "@/components/ui/card";
import { Sparkles, X, Star } from "lucide-react";
import { COSMETICS } from "@/lib/progression/progression";
import { cn } from "@/lib/utils";
import { playSound } from "@/lib/audio/sounds";

export function LevelUpToast() {
  const levelUps = useAppStore((s) => s.levelUps);
  const dismiss = useAppStore((s) => s.dismissLevelUp);
  const t = useT();

  const latest = levelUps[levelUps.length - 1];

  useEffect(() => {
    if (!latest) return;
    playSound("levelUp");
    const timer = setTimeout(() => dismiss(latest.id), 7000);
    return () => clearTimeout(timer);
  }, [latest, dismiss]);

  if (!latest) return null;

  const unlocked = COSMETICS.filter((c) => latest.unlockedCosmeticIds.includes(c.id));

  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-[100] flex justify-center px-4 animate-float-up">
      <Card className="pointer-events-auto relative w-full max-w-sm overflow-hidden border-primary/40 bg-card/95 shadow-2xl backdrop-blur">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary via-[var(--warning)] to-primary shimmer" />
        <button
          onClick={() => dismiss(latest.id)}
          className="absolute right-2 top-2 rounded-md p-1 text-muted-foreground hover:bg-muted"
          aria-label="close"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="flex items-start gap-3 p-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 animate-pop">
            <Sparkles className="h-6 w-6 text-primary" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-primary">{t("xp.levelUp")}</p>
            <p className="text-lg font-bold">
              {t("xp.nowLevel")} {latest.newLevel}
            </p>
            {unlocked.length > 0 && (
              <div className="mt-2 space-y-1">
                <p className="text-xs text-muted-foreground">{t("xp.unlocked")}</p>
                {unlocked.map((c) => (
                  <div key={c.id} className="flex items-center gap-1.5 text-xs">
                    <Star className="h-3 w-3 text-[var(--warning)]" />
                    <span>{c.name}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
