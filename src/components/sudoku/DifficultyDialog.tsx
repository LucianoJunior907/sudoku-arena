"use client";

import { useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useI18n } from "@/lib/i18n/context";
import { estimateDifficulty, type DifficultyRating } from "@/lib/sudoku/difficulty-estimator";
import type { Board } from "@/lib/sudoku/types";
import { Gauge, Check, AlertTriangle, Layers } from "lucide-react";
import { cn } from "@/lib/utils";

interface DifficultyDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  puzzle: Board;
}

const RATING_COLOR: Record<DifficultyRating, string> = {
  trivial: "text-[var(--success)]",
  easy: "text-[var(--success)]",
  medium: "text-primary",
  hard: "text-[var(--warning)]",
  expert: "text-[var(--chart-5)]",
  diabolical: "text-[var(--destructive)]",
};

const RATING_BG: Record<DifficultyRating, string> = {
  trivial: "bg-[var(--success)]/15",
  easy: "bg-[var(--success)]/15",
  medium: "bg-primary/15",
  hard: "bg-[var(--warning)]/15",
  expert: "bg-[var(--chart-5)]/15",
  diabolical: "bg-[var(--destructive)]/15",
};

export function DifficultyDialog({ open, onOpenChange, puzzle }: DifficultyDialogProps) {
  const { t } = useI18n();

  const estimate = useMemo(() => {
    if (!open) return null;
    return estimateDifficulty(puzzle);
  }, [open, puzzle]);

  if (!estimate) return null;

  const ratingColor = RATING_COLOR[estimate.rating];
  const ratingBg = RATING_BG[estimate.rating];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className={cn("mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-md", ratingBg)}>
            <Gauge className={cn("h-6 w-6", ratingColor)} />
          </div>
          <DialogTitle className="text-center">{t("solo.difficulty")}</DialogTitle>
          <DialogDescription className="text-center">{t("solo.difficultyDesc")}</DialogDescription>
        </DialogHeader>

        {/* Rating + score */}
        <div className="flex flex-col items-center gap-3 py-2">
          <p className={cn("text-3xl font-bold", ratingColor)}>
            {t(`difficulty.${estimate.rating}` as never)}
          </p>
          <div className="w-full max-w-xs">
            <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
              <span>{t("difficulty.score")}</span>
              <span className="font-mono font-semibold tabular-nums">{estimate.score}/100</span>
            </div>
            <Progress value={estimate.score} className="h-2" />
          </div>
        </div>

        {/* Technique breakdown */}
        <div className="space-y-2 rounded-sm border border-border bg-muted/30 p-3">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
            <Layers className="h-3.5 w-3.5" />
            {t("difficulty.techniquesUsed")}
          </p>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <TechniqueStat label={t("difficulty.nakedSingles")} value={estimate.nakedSingles} />
            <TechniqueStat label={t("difficulty.hiddenSingles")} value={estimate.hiddenSingles} />
            <TechniqueStat label={t("difficulty.nakedPairs")} value={estimate.nakedPairs} />
            <TechniqueStat label={t("difficulty.cellsRemaining")} value={estimate.emptyCells} />
          </div>
          {estimate.needsAdvanced && (
            <div className="mt-2 flex items-center gap-1.5 rounded-md bg-[var(--destructive)]/10 px-2 py-1.5 text-xs text-[var(--destructive)]">
              <AlertTriangle className="h-3.5 w-3.5" />
              {t("difficulty.needsAdvanced")}
            </div>
          )}
          {!estimate.needsAdvanced && estimate.emptyCells === 0 && (
            <div className="mt-2 flex items-center gap-1.5 rounded-md bg-[var(--success)]/10 px-2 py-1.5 text-xs text-[var(--success)]">
              <Check className="h-3.5 w-3.5" />
              {t("solo.boardComplete")}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.close")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TechniqueStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn(
        "font-mono font-semibold tabular-nums",
        value > 0 ? "text-foreground" : "text-muted-foreground/50"
      )}>
        {value}
      </span>
    </div>
  );
}
