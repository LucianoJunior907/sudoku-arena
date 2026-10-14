"use client";

import { useMemo, useState } from "react";
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
import { useI18n } from "@/lib/i18n/context";
import { suggestNextMove, type SolverSuggestion } from "@/lib/sudoku/solver-hint";
import { isComplete } from "@/lib/sudoku/engine";
import type { Board, Notes } from "@/lib/sudoku/types";
import { indexToRc } from "@/lib/sudoku/types";
import { Brain, Lightbulb, Wand2, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface SolverDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  board: Board;
  notes: Notes;
  solution: Board;
  given: boolean[];
  hintCells: number[];
  onApply: (index: number, value: number) => void;
}

const TECHNIQUE_LABEL: Record<SolverSuggestion["technique"], { pt: string; en: string }> = {
  "naked-single": { pt: "Naked Single", en: "Naked Single" },
  "hidden-single": { pt: "Hidden Single", en: "Hidden Single" },
  "naked-single-in-block": { pt: "Naked Single (bloco)", en: "Naked Single (block)" },
  solver: { pt: "Solver", en: "Solver" },
};

const TECHNIQUE_COLOR: Record<SolverSuggestion["technique"], string> = {
  "naked-single": "border-primary/40 text-primary bg-primary/5",
  "hidden-single": "border-[var(--warning)]/40 text-[var(--warning)] bg-[var(--warning)]/5",
  "naked-single-in-block": "border-primary/40 text-primary bg-primary/5",
  solver: "border-[var(--chart-4)]/40 text-[var(--chart-4)] bg-[var(--chart-4)]/5",
};

export function SolverDialog({
  open,
  onOpenChange,
  board,
  notes,
  solution,
  given,
  hintCells,
  onApply,
}: SolverDialogProps) {
  const { t, locale } = useI18n();
  const [applied, setApplied] = useState(false);

  const suggestion = useMemo(() => {
    if (!open) return null;
    if (isComplete(board)) return null;
    return suggestNextMove(board, notes, solution);
  }, [open, board, notes, solution]);

  const handleApply = () => {
    if (!suggestion) return;
    onApply(suggestion.index, suggestion.value);
    setApplied(true);
    setTimeout(() => {
      setApplied(false);
      onOpenChange(false);
    }, 1000);
  };

  const isDone = isComplete(board);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--chart-4)]/10">
            <Brain className="h-6 w-6 text-[var(--chart-4)]" />
          </div>
          <DialogTitle className="text-center">{t("solo.solverTitle")}</DialogTitle>
          <DialogDescription className="text-center">{t("solo.solverDesc")}</DialogDescription>
        </DialogHeader>

        {isDone ? (
          <div className="py-6 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--success)]/15">
              <Check className="h-6 w-6 text-[var(--success)]" />
            </div>
            <p className="text-sm font-medium text-[var(--success)]">{t("solo.solverEmpty")}</p>
          </div>
        ) : !suggestion ? (
          <div className="py-6 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <X className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">{t("solo.solverNoMove")}</p>
          </div>
        ) : (
          <div className="space-y-3 py-2">
            {/* Suggested cell + value */}
            <div className="flex items-center justify-between rounded-lg border border-border bg-card p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-2xl font-bold text-primary">
                  {suggestion.value}
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    {t("board.cell")} {indexToRc(suggestion.index).row + 1}, {indexToRc(suggestion.index).col + 1}
                  </p>
                  <Badge
                    variant="outline"
                    className={cn("mt-1 gap-1", TECHNIQUE_COLOR[suggestion.technique])}
                  >
                    <Lightbulb className="h-3 w-3" />
                    {TECHNIQUE_LABEL[suggestion.technique][locale]}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Reasoning */}
            <div className="rounded-lg border border-border bg-muted/30 p-3">
              <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                <Wand2 className="h-3.5 w-3.5" />
                {t("solo.solverReason")}
              </p>
              <p className="text-sm leading-relaxed text-foreground/90">{suggestion.reason}</p>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.close")}
          </Button>
          {suggestion && !isDone && (
            <Button onClick={handleApply} className="gap-1.5" disabled={applied}>
              {applied ? <Check className="h-4 w-4 text-[var(--success)]" /> : <Lightbulb className="h-4 w-4" />}
              {applied ? t("solo.solverApplied") : t("solo.solverApply")}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
