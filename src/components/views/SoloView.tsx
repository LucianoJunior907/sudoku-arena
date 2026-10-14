"use client";

import { useSudokuGame } from "@/hooks/use-sudoku-game";
import { useAppStore } from "@/lib/store/app-store";
import { useI18n } from "@/lib/i18n/context";
import { SudokuGamePlay } from "@/components/sudoku/SudokuGamePlay";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { Difficulty } from "@/lib/sudoku/types";
import { Play } from "lucide-react";
import { cn } from "@/lib/utils";

const DIFFICULTIES: { id: Difficulty; key: string; descKey: string; accent: string }[] = [
  { id: "easy", key: "difficulty.easy", descKey: "difficulty.easy.desc", accent: "from-emerald-500/20 to-emerald-500/5" },
  { id: "medium", key: "difficulty.medium", descKey: "difficulty.medium.desc", accent: "from-teal-500/20 to-teal-500/5" },
  { id: "hard", key: "difficulty.hard", descKey: "difficulty.hard.desc", accent: "from-amber-500/20 to-amber-500/5" },
  { id: "expert", key: "difficulty.expert", descKey: "difficulty.expert.desc", accent: "from-rose-500/20 to-rose-500/5" },
];

export function SoloView() {
  const { t } = useI18n();
  const setRoute = useAppStore((s) => s.setRoute);
  const game = useSudokuGame("solo");
  const { state } = game;

  if (state.status === "idle") {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold">{t("solo.title")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t("solo.subtitle")}</p>
        </div>
        <div>
          <h3 className="mb-3 text-lg font-semibold">{t("solo.selectDifficulty")}</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            {DIFFICULTIES.map((d) => (
              <Card
                key={d.id}
                className="group relative cursor-pointer overflow-hidden p-5 transition-all hover:border-primary/40 hover:shadow-md"
                onClick={() => game.startNew(d.id)}
              >
                <div className={cn("absolute inset-0 bg-gradient-to-br opacity-60", d.accent)} />
                <div className="relative">
                  <p className="text-lg font-bold">{t(d.key as never)}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{t(d.descKey as never)}</p>
                  <Button size="sm" className="mt-4" onClick={(e) => { e.stopPropagation(); game.startNew(d.id); }}>
                    <Play className="mr-1.5 h-3.5 w-3.5" />
                    {t("solo.start")}
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <SudokuGamePlay
      game={game}
      backLabel={t("solo.backToLobby")}
      onExit={() => { game.exit(); setRoute("lobby"); }}
      onPlayAgain={() => game.startNew(state.difficulty)}
      onNewGame={() => game.startNew(state.difficulty)}
    />
  );
}
