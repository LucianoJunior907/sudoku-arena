"use client";

import { useMemo } from "react";
import type { Board, Notes } from "@/lib/sudoku/types";
import { indexToRc, PEERS } from "@/lib/sudoku/types";
import { useT } from "@/lib/i18n/context";
import { cn } from "@/lib/utils";

export interface SudokuBoardProps {
  board: Board;
  notes: Notes;
  given: boolean[];
  hintCells: number[];
  conflicts: Set<number>;
  selectedIndex: number;
  settings: {
    highlightPeers: boolean;
    highlightSame: boolean;
    autoCheck: boolean;
  };
  onSelect: (index: number) => void;
}

export function SudokuBoard({
  board,
  notes,
  given,
  hintCells,
  conflicts,
  selectedIndex,
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
    if (!settings.highlightSame || selectedValue === 0) return new Set<number>();
    const s = new Set<number>();
    for (let i = 0; i < 81; i++) {
      if (board[i] === selectedValue) s.add(i);
    }
    return s;
  }, [selectedValue, board, settings.highlightSame]);

  return (
    <div
      className="relative mx-auto aspect-square w-full max-w-[min(92vw,30rem)] select-none touch-manipulation"
      role="grid"
      aria-label="Sudoku board"
    >
      <div className="grid h-full w-full grid-cols-9 grid-rows-9 overflow-hidden rounded-lg border-2 border-[var(--cell-border-thick)] bg-[var(--cell-border-thick)] gap-px shadow-lg">
        {board.map((value, i) => {
          const { row, col } = indexToRc(i);
          const isGiven = given[i];
          const isHint = hintCells.includes(i);
          const isSelected = selectedIndex === i;
          const isPeer = peerSet.has(i);
          const isSame = sameSet.has(i);
          const isConflict = settings.autoCheck && conflicts.has(i);

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
  borderClasses: string;
  onClick: () => void;
  ariaLabel: string;
}) {
  const bg = cn(
    "bg-[var(--cell-bg)]",
    isGiven && "bg-[var(--cell-bg-given)]",
    isPeer && "bg-[var(--cell-bg-peer)]",
    isSame && !isSelected && "bg-[var(--cell-bg-same)]",
    isSelected && "bg-[var(--cell-bg-selected)]",
    isConflict && "bg-[var(--cell-bg-error)]",
    isHint && !isConflict && "bg-[var(--cell-bg-hint)]"
  );

  const text = cn(
    "flex items-center justify-center font-semibold leading-none",
    "text-[clamp(1rem,5vw,1.6rem)]",
    isGiven
      ? "text-foreground"
      : isHint
      ? "text-[var(--warning)]"
      : isConflict
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
        "relative flex aspect-square items-center justify-center border border-[var(--cell-border)] transition-colors duration-100",
        bg,
        borderClasses,
        isSelected && "z-10 animate-pulse-ring"
      )}
    >
      {value !== 0 ? (
        <span className={cn(text, "animate-pop")}>{value}</span>
      ) : notes.length > 0 ? (
        <NotesGrid notes={notes} />
      ) : null}
    </button>
  );
}

function NotesGrid({ notes }: { notes: number[] }) {
  return (
    <div className="grid h-full w-full grid-cols-3 grid-rows-3 p-0.5">
      {Array.from({ length: 9 }, (_, k) => {
        const n = k + 1;
        const has = notes.includes(n);
        return (
          <span
            key={n}
            className={cn(
              "flex items-center justify-center text-[clamp(0.4rem,1.6vw,0.6rem)] font-medium",
              has ? "text-muted-foreground opacity-80" : "opacity-0"
            )}
          >
            {has ? n : ""}
          </span>
        );
      })}
    </div>
  );
}
