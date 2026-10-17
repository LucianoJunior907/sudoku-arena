"use client";

import { useMemo } from "react";
import type { Board, Notes } from "@/lib/sudoku/types";
import { indexToRc, PEERS } from "@/lib/sudoku/types";
import { candidatesFor as computeCandidates } from "@/lib/sudoku/solver-hint";
import { useT } from "@/lib/i18n/context";
import { cn } from "@/lib/utils";

export interface SudokuBoardProps {
  board: Board;
  notes: Notes;
  given: boolean[];
  hintCells: number[];
  conflicts: Set<number>;
  wrongCells: Set<number>;
  selectedIndex: number;
  highlightDigit: number;
  themeVars?: Record<string, string>;
  settings: {
    highlightPeers: boolean;
    highlightSame: boolean;
    autoCheck: boolean;
    showCandidateCount: boolean;
  };
  onSelect: (index: number) => void;
}

export function SudokuBoard({
  board,
  notes,
  given,
  hintCells,
  conflicts,
  wrongCells,
  selectedIndex,
  highlightDigit,
  themeVars,
  settings,
  onSelect,
}: SudokuBoardProps) {
  const t = useT();
  const selectedValue = selectedIndex >= 0 ? board[selectedIndex] : 0;

  const peerSet = useMemo(() => {
    if (!settings.highlightPeers || selectedIndex < 0) return new Set<number>();
    return new Set(PEERS[selectedIndex]);
  }, [selectedIndex, settings.highlightPeers]);

  const sameSet = useMemo(() => {
    const digit = highlightDigit || selectedValue;
    if (!settings.highlightSame || digit === 0) return new Set<number>();
    const s = new Set<number>();
    for (let i = 0; i < 81; i++) {
      if (board[i] === digit) s.add(i);
    }
    return s;
  }, [selectedValue, highlightDigit, board, settings.highlightSame]);

  // Cells that contain the highlight digit as a candidate note.
  const candidateSet = useMemo(() => {
    const digit = highlightDigit || 0;
    if (digit === 0) return new Set<number>();
    const s = new Set<number>();
    for (let i = 0; i < 81; i++) {
      if (board[i] === 0 && notes[i].includes(digit)) s.add(i);
    }
    return s;
  }, [highlightDigit, board, notes]);

  // Per-cell candidate counts (for the showCandidateCount display).
  const candidateCounts = useMemo(() => {
    if (!settings.showCandidateCount) return new Array(81).fill(0);
    return Array.from({ length: 81 }, (_, i) =>
      board[i] === 0 ? computeCandidates(board, i).length : 0
    );
  }, [board, settings.showCandidateCount]);

  return (
    <div
      className="relative mx-auto aspect-square w-full max-w-[min(92vw,30rem)] select-none touch-manipulation"
      role="grid"
      aria-label="Sudoku board"
      style={themeVars as React.CSSProperties | undefined}
    >
      <div className="grid h-full w-full grid-cols-9 grid-rows-9 overflow-hidden rounded-sm border-2 border-[var(--cell-border-thick)] bg-[var(--cell-border-thick)] gap-px shadow-lg">
        {board.map((value, i) => {
          const { row, col } = indexToRc(i);
          const isGiven = given[i];
          const isHint = hintCells.includes(i);
          const isSelected = selectedIndex === i;
          const isPeer = peerSet.has(i);
          const isSame = sameSet.has(i);
          const isConflict = settings.autoCheck && conflicts.has(i);
          const isWrong = wrongCells.has(i);
          const isCandidate = candidateSet.has(i);
          const highlightVal = highlightDigit || 0;

          // thick borders between 3x3 boxes
          const borderClasses = cn(
            "border-[var(--cell-border)]",
            col % 3 === 2 && col !== 8 && "border-r-2 border-r-[var(--cell-border-thick)]",
            row % 3 === 2 && row !== 8 && "border-b-2 border-b-[var(--cell-border-thick)]"
          );

          return (
            <Cell
              key={i}
              value={value}
              notes={notes[i]}
              isGiven={isGiven}
              isHint={isHint}
              isSelected={isSelected}
              isPeer={isPeer}
              isSame={isSame}
              isConflict={isConflict}
              isWrong={isWrong}
              isCandidate={isCandidate}
              highlightDigit={highlightVal}
              candidateCount={candidateCounts[i]}
              showCandidateCount={settings.showCandidateCount}
              borderClasses={borderClasses}
              onClick={() => onSelect(i)}
              ariaLabel={`${t("board.cell")} ${row + 1}, ${col + 1}${value ? `, ${t("board.value")} ${value}` : `, ${t("board.empty")}`}`}
            />
          );
        })}
      </div>
    </div>
  );
}

function Cell({
  value,
  notes,
  isGiven,
  isHint,
  isSelected,
  isPeer,
  isSame,
  isConflict,
  isWrong,
  isCandidate,
  highlightDigit,
  candidateCount,
  showCandidateCount,
  borderClasses,
  onClick,
  ariaLabel,
}: {
  value: number;
  notes: number[];
  isGiven: boolean;
  isHint: boolean;
  isSelected: boolean;
  isPeer: boolean;
  isSame: boolean;
  isConflict: boolean;
  isWrong: boolean;
  isCandidate: boolean;
  highlightDigit: number;
  candidateCount: number;
  showCandidateCount: boolean;
  borderClasses: string;
  onClick: () => void;
  ariaLabel: string;
}) {
  const bg = cn(
    "bg-[var(--cell-bg)] hover:bg-[var(--cell-bg-peer)]",
    isGiven && "bg-[var(--cell-bg-given)] hover:bg-[var(--cell-bg-given)]",
    isPeer && "bg-[var(--cell-bg-peer)]",
    isSame && !isSelected && "bg-[var(--cell-bg-same)]",
    isSelected && "bg-[var(--cell-bg-selected)] hover:bg-[var(--cell-bg-selected)]",
    isWrong && "bg-[var(--cell-bg-error)] hover:bg-[var(--cell-bg-error)]",
    isConflict && "bg-[var(--cell-bg-error)] hover:bg-[var(--cell-bg-error)]",
    isHint && !isConflict && !isWrong && "bg-[var(--cell-bg-hint)] hover:bg-[var(--cell-bg-hint)]",
    isCandidate && !isSame && "bg-[var(--cell-bg-peer)]"
  );

  const text = cn(
    "flex items-center justify-center font-semibold leading-none",
    "text-[clamp(1rem,5vw,1.6rem)]",
    isGiven
      ? "text-foreground"
      : isHint
      ? "text-[var(--warning)]"
      : isConflict || isWrong
      ? "text-[var(--destructive)]"
      : "text-primary",
    isSelected && "text-glow"
  );

  return (
    <button
      type="button"
      role="gridcell"
      aria-label={ariaLabel}
      onClick={onClick}
      className={cn(
        "relative flex aspect-square items-center justify-center border border-[var(--cell-border)] transition-colors duration-100 cursor-pointer",
        bg,
        borderClasses,
        isSelected && "z-10 animate-pulse-ring ring-2 ring-inset ring-[var(--cell-border-thick)]"
      )}
    >
      {value !== 0 ? (
        <span className={cn(text, "animate-pop")}>{value}</span>
      ) : notes.length > 0 ? (
        <NotesGrid notes={notes} highlightDigit={highlightDigit} />
      ) : showCandidateCount && candidateCount > 0 ? (
        <span className={cn(
          "text-[clamp(0.5rem,2vw,0.7rem)] font-medium tabular-nums",
          candidateCount === 1 ? "text-primary font-bold" : "text-muted-foreground/50"
        )}>
          {candidateCount}
        </span>
      ) : null}
    </button>
  );
}

function NotesGrid({ notes, highlightDigit }: { notes: number[]; highlightDigit: number }) {
  return (
    <div className="grid h-full w-full grid-cols-3 grid-rows-3 p-0.5">
      {Array.from({ length: 9 }, (_, k) => {
        const n = k + 1;
        const has = notes.includes(n);
        const isHi = highlightDigit === n && has;
        return (
          <span
            key={n}
            className={cn(
              "flex items-center justify-center rounded-sm text-[clamp(0.4rem,1.6vw,0.6rem)] font-medium transition-colors",
              !has && "opacity-0",
              has && !isHi && "text-muted-foreground opacity-80",
              isHi && "bg-primary/20 font-bold text-primary"
            )}
          >
            {has ? n : ""}
          </span>
        );
      })}
    </div>
  );
}
