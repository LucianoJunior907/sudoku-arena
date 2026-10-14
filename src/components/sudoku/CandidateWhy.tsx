"use client";

import { useMemo } from "react";
import { useI18n } from "@/lib/i18n/context";
import { candidatesFor } from "@/lib/sudoku/solver-hint";
import type { Board, Notes } from "@/lib/sudoku/types";
import { PEERS, BOX_INDEX, indexToRc } from "@/lib/sudoku/types";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Info } from "lucide-react";

interface CandidateWhyProps {
  board: Board;
  notes: Notes;
  given: boolean[];
  selectedIndex: number;
  children: React.ReactNode;
}

interface EliminationReason {
  digit: number;
  reason: string;
  unit: string;
}

/**
 * Wraps a cell with a tooltip that explains why each non-candidate digit
 * is eliminated (which peer — row, column, or box — blocks it).
 */
export function CandidateWhy({ board, notes, given, selectedIndex, children }: CandidateWhyProps) {
  const { t } = useI18n();

  const tooltipText = useMemo(() => {
    if (selectedIndex < 0) return "";
    if (board[selectedIndex] !== 0) return "";
    if (given[selectedIndex]) return "";

    const cands = candidatesFor(board, selectedIndex);
    const all = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    const eliminated = all.filter((d) => !cands.includes(d));
    if (eliminated.length === 0) return "";

    const reasons: EliminationReason[] = [];
    for (const digit of eliminated) {
      const reason = findEliminationReason(board, selectedIndex, digit);
      if (reason) reasons.push(reason);
    }

    if (reasons.length === 0) return "";
    const lines = reasons.map(
      (r) => `${r.digit} — ${r.reason}`
    );
    return lines.join("\n");
  }, [board, given, selectedIndex]);

  if (!tooltipText) return <>{children}</>;

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs whitespace-pre-line text-xs">
          <div className="flex items-start gap-1.5">
            <Info className="h-3 w-3 mt-0.5 shrink-0 text-muted-foreground" />
            <span>{tooltipText}</span>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function findEliminationReason(board: Board, index: number, digit: number): EliminationReason | null {
  const { row, col } = indexToRc(index);
  const boxIdx = Math.floor(row / 3) * 3 + Math.floor(col / 3);

  // Check row
  for (let c = 0; c < 9; c++) {
    const peer = row * 9 + c;
    if (peer !== index && board[peer] === digit) {
      return { digit, reason: `blocked by row (cell R${row + 1}C${c + 1})`, unit: "row" };
    }
  }
  // Check column
  for (let r = 0; r < 9; r++) {
    const peer = r * 9 + col;
    if (peer !== index && board[peer] === digit) {
      return { digit, reason: `blocked by column (cell R${r + 1}C${col + 1})`, unit: "column" };
    }
  }
  // Check box
  for (const peer of BOX_INDEX[boxIdx]) {
    if (peer !== index && board[peer] === digit) {
      const pr = Math.floor(peer / 9) + 1;
      const pc = (peer % 9) + 1;
      return { digit, reason: `blocked by box (cell R${pr}C${pc})`, unit: "box" };
    }
  }
  return null;
}
