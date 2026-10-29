"use client";

import { useMemo, useRef, useState, useEffect } from "react";
import type { Board, Notes } from "@/lib/sudoku/types";
import { indexToRc, PEERS, BOX_INDEX } from "@/lib/sudoku/types";
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
  lockMode: "none" | "value" | "note";
  lockedDigit: number;
  themeVars?: Record<string, string>;
  settings: {
    highlightPeers: boolean;
    highlightSame: boolean;
    autoCheck: boolean;
    showCandidateCount: boolean;
  };
  onSelect: (index: number) => void;
  /**
   * Apply the locked value/note to a cell.
   * @param allowToggle when true (single click), clicking a cell that
   *   already holds the locked value REMOVES it (toggle). When false
   *   (drag paint), same-value cells are skipped — never erased mid-drag.
   */
  onApplyLocked: (index: number, allowToggle?: boolean) => void;
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
  lockMode,
  lockedDigit,
  themeVars,
  settings,
  onSelect,
  onApplyLocked,
}: SudokuBoardProps) {
  const t = useT();
  const selectedValue = selectedIndex >= 0 ? board[selectedIndex] : 0;

  // The digit used for "same value" highlights: when a lock is active,
  // the locked digit takes priority; otherwise fall back to the hovered
  // number-pad digit or the selected cell's value.
  const effectiveHighlightDigit = lockMode !== "none" ? lockedDigit : (highlightDigit || selectedValue);

  const peerSet = useMemo(() => {
    if (!settings.highlightPeers || selectedIndex < 0) return new Set<number>();
    return new Set(PEERS[selectedIndex]);
  }, [selectedIndex, settings.highlightPeers]);

  const sameSet = useMemo(() => {
    const digit = effectiveHighlightDigit;
    if (!settings.highlightSame && lockMode === "none") {
      // Even if highlightSame is off, when a lock is active we still
      // highlight same-digit cells (spec requirement).
      if (lockMode === "none") return new Set<number>();
    }
    if (digit === 0) return new Set<number>();
    const s = new Set<number>();
    for (let i = 0; i < 81; i++) {
      if (board[i] === digit) s.add(i);
    }
    return s;
  }, [effectiveHighlightDigit, board, settings.highlightSame, lockMode]);

  // NOTE (#1 feedback): cells containing the highlight digit as a note
  // do NOT get a background highlight anymore — the circle around the
  // note digit itself (NotesGrid) is the only highlight for notes.

  // Per-cell candidate counts (for the showCandidateCount display).
  const candidateCounts = useMemo(() => {
    if (!settings.showCandidateCount) return new Array(81).fill(0);
    return Array.from({ length: 81 }, (_, i) =>
      board[i] === 0 ? computeCandidates(board, i).length : 0
    );
  }, [board, settings.showCandidateCount]);

  // ---- Click + drag to paint cells with the locked digit ----
  // Approach: on pointerdown in a cell, start a drag session, apply to
  // the cell, and IMMEDIATELY attach global pointermove/pointerup
  // listeners (not via useEffect — that runs too late for fast drags).
  // Global listeners with elementFromPoint work for mouse + touch
  // because on touch the pointerdown element captures subsequent
  // events, so container-level onPointerMove would never fire.
  const dragStateRef = useRef<{
    active: boolean;
    indices: Set<number>;
    cleanup: (() => void) | null;
  }>({
    active: false,
    indices: new Set(),
    cleanup: null,
  });
  const [, forceRender] = useState(0);

  const applyToCell = (i: number) => {
    if (dragStateRef.current.indices.has(i)) return;
    dragStateRef.current.indices.add(i);
    onApplyLocked(i);
  };

  const stopDrag = () => {
    if (dragStateRef.current.active) {
      dragStateRef.current = { active: false, indices: new Set(), cleanup: null };
      forceRender((n) => n + 1);
    }
  };

  const startDrag = (startIndex: number) => {
    // Tear down any previous session (safety).
    if (dragStateRef.current.cleanup) dragStateRef.current.cleanup();
    dragStateRef.current = {
      active: true,
      indices: new Set([startIndex]),
      cleanup: null,
    };

    const onMove = (e: PointerEvent) => {
      if (!dragStateRef.current.active) return;
      if (e.buttons !== 1) {
        stopDrag();
        return;
      }
      const el = document.elementFromPoint(e.clientX, e.clientY);
      if (!el) return;
      const cell = (el as HTMLElement).closest('[role="gridcell"]') as HTMLElement | null;
      if (!cell) return;
      const idx = Number(cell.getAttribute("data-cell-index"));
      if (Number.isNaN(idx) || idx < 0 || idx > 80) return;
      applyToCell(idx);
    };
    const onUp = () => stopDrag();
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    dragStateRef.current.cleanup = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  };

  // Cleanup on unmount.
  useEffect(() => {
    return () => {
      if (dragStateRef.current.cleanup) dragStateRef.current.cleanup();
    };
  }, []);

  const handleCellPointerDown = (i: number) => {
    if (lockMode !== "none") {
      // Lock active: select the cell (so row/col/box highlights follow),
      // apply the locked value (allowToggle = click-to-remove behavior:
      // clicking a cell that already holds the locked value erases it),
      // and start a drag-paint session for subsequent cells.
      onSelect(i);
      onApplyLocked(i, true);
      startDrag(i);
      forceRender((n) => n + 1);
    } else {
      // No lock: just select. pointerdown is enough (no onClick needed,
      // avoids a double select + double sound).
      onSelect(i);
    }
  };

  return (
    <div
      className="relative mx-auto aspect-square w-full max-w-[min(92vw,30rem)] select-none touch-manipulation"
      role="grid"
      aria-label="Sudoku board"
      style={themeVars as React.CSSProperties | undefined}
    >
      {/* Lock badge */}
      {lockMode !== "none" && (
        <div
          className={cn(
            "absolute -top-3 left-1/2 z-30 -translate-x-1/2 rounded-full border px-3 py-0.5 text-xs font-bold shadow-md",
            lockMode === "value"
              ? "border-primary/40 bg-primary text-primary-foreground"
              : "border-[var(--chart-4)]/40 bg-[var(--chart-4)] text-white"
          )}
          role="status"
          aria-live="polite"
        >
          {lockMode === "value" ? t("board.lockValue") : t("board.lockNote")}: {lockedDigit}
          <span className="ml-1.5 font-normal opacity-80">(L/Esc)</span>
        </div>
      )}

      <div
        className="grid h-full w-full grid-cols-9 grid-rows-9 overflow-hidden rounded-lg border-[3px] border-[var(--cell-border-thick)] bg-[var(--cell-border-thick)] gap-px shadow-lg">
        {board.map((value, i) => {
          const { row, col } = indexToRc(i);
          const isGiven = given[i];
          const isHint = hintCells.includes(i);
          const isSelected = selectedIndex === i;
          const isPeer = peerSet.has(i);
          const isSame = sameSet.has(i);
          const isConflict = settings.autoCheck && conflicts.has(i);
          const isWrong = wrongCells.has(i);
          const highlightVal = effectiveHighlightDigit;

          // Thick borders between 3x3 boxes — enhanced for clarity.
          // Internal cell borders stay thin (gap-px + border).
          const borderClasses = cn(
            col % 3 === 2 && col !== 8 && "border-r-2 border-r-[var(--cell-border-thick)]",
            row % 3 === 2 && row !== 8 && "border-b-2 border-b-[var(--cell-border-thick)]"
          );

          return (
            <Cell
              key={i}
              cellIndex={i}
              value={value}
              notes={notes[i]}
              isGiven={isGiven}
              isHint={isHint}
              isSelected={isSelected}
              isPeer={isPeer}
              isSame={isSame}
              isConflict={isConflict}
              isWrong={isWrong}
              highlightDigit={highlightVal}
              candidateCount={candidateCounts[i]}
              showCandidateCount={settings.showCandidateCount}
              borderClasses={borderClasses}
              isLockedDrag={lockMode !== "none"}
              onPointerDown={() => handleCellPointerDown(i)}
              ariaLabel={`${t("board.cell")} ${row + 1}, ${col + 1}${value ? `, ${t("board.value")} ${value}` : `, ${t("board.empty")}`}`}
            />
          );
        })}
      </div>
    </div>
  );
}

function Cell({
  cellIndex,
  value,
  notes,
  isGiven,
  isHint,
  isSelected,
  isPeer,
  isSame,
  isConflict,
  isWrong,
  highlightDigit,
  candidateCount,
  showCandidateCount,
  borderClasses,
  isLockedDrag,
  onPointerDown,
  ariaLabel,
}: {
  cellIndex: number;
  value: number;
  notes: number[];
  isGiven: boolean;
  isHint: boolean;
  isSelected: boolean;
  isPeer: boolean;
  isSame: boolean;
  isConflict: boolean;
  isWrong: boolean;
  highlightDigit: number;
  candidateCount: number;
  showCandidateCount: boolean;
  borderClasses: string;
  isLockedDrag: boolean;
  onPointerDown: () => void;
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
    isHint && !isConflict && !isWrong && "bg-[var(--cell-bg-hint)] hover:bg-[var(--cell-bg-hint)]"
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
      data-cell-index={cellIndex}
      aria-label={ariaLabel}
      onPointerDown={onPointerDown}
      // When in lock mode, use crosshair cursor to hint at drag-paint.
      // touchAction:none prevents scroll-stealing during drag on touch.
      style={{ cursor: isLockedDrag ? "crosshair" : "pointer", touchAction: "none" }}
      className={cn(
        "relative flex aspect-square items-center justify-center border border-[var(--cell-border)] transition-colors duration-100",
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
              "flex items-center justify-center text-[clamp(0.4rem,1.6vw,0.6rem)] font-medium transition-colors",
              !has && "opacity-0",
              has && !isHi && "text-muted-foreground opacity-80",
              isHi && "font-bold text-primary rounded-full ring-1 ring-primary/50 bg-primary/15"
            )}
          >
            {has ? n : ""}
          </span>
        );
      })}
    </div>
  );
}
