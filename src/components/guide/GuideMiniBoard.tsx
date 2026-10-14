"use client";

import { useMemo } from "react";
import type { CellMark } from "@/lib/guide/content";
import { indexToRc } from "@/lib/sudoku/types";
import { cn } from "@/lib/utils";

export function GuideMiniBoard({ cells }: { cells: CellMark[] }) {
  const cellMap = useMemo(() => {
    const m = new Map<number, CellMark>();
    for (const c of cells) m.set(c.index, c);
    return m;
  }, [cells]);

  return (
    <div className="mx-auto aspect-square w-full max-w-[22rem]">
      <div className="grid h-full w-full grid-cols-9 grid-rows-9 overflow-hidden rounded-md border-2 border-[var(--cell-border-thick)] gap-px bg-[var(--cell-border-thick)]">
        {Array.from({ length: 81 }, (_, i) => {
          const mark = cellMap.get(i);
          const { row, col } = indexToRc(i);
          const borderClasses = cn(
            col % 3 === 2 && col !== 8 && "border-r-2 border-r-[var(--cell-border-thick)]",
            row % 3 === 2 && row !== 8 && "border-b-2 border-b-[var(--cell-border-thick)]"
          );
          return (
            <div
              key={i}
              className={cn(
                "relative flex aspect-square items-center justify-center border border-[var(--cell-border)] bg-[var(--cell-bg)] text-sm font-semibold sm:text-base",
                borderClasses,
                mark?.kind === "given" && "bg-[var(--cell-bg-given)] text-foreground",
                mark?.kind === "solved" && "bg-[var(--cell-bg-same)] text-primary",
                mark?.kind === "candidate" && "bg-[var(--cell-bg-peer)]",
                mark?.kind === "target" && "bg-[var(--cell-bg-selected)] text-primary text-glow ring-1 ring-primary",
                mark?.kind === "eliminate" && "bg-[var(--cell-bg-error)]"
              )}
            >
              {(mark?.kind === "given" || mark?.kind === "solved" || mark?.kind === "target") && mark.value !== 0 && (
                <span className={cn(mark?.kind === "target" && "animate-pop")}>{mark.value}</span>
              )}
              {mark?.kind === "candidate" && mark.notes && mark.notes.length > 0 && (
                <div className="grid h-full w-full grid-cols-3 grid-rows-3 p-0.5">
                  {Array.from({ length: 9 }, (_, k) => {
                    const n = k + 1;
                    const has = mark.notes!.includes(n);
                    return (
                      <span key={n} className={cn("flex items-center justify-center text-[8px] sm:text-[10px] text-muted-foreground", !has && "opacity-0")}>
                        {has ? n : ""}
                      </span>
                    );
                  })}
                </div>
              )}
              {mark?.kind === "eliminate" && mark.notes && mark.notes.length > 0 && (
                <div className="grid h-full w-full grid-cols-3 grid-rows-3 p-0.5">
                  {Array.from({ length: 9 }, (_, k) => {
                    const n = k + 1;
                    const has = mark.notes!.includes(n);
                    return (
                      <span key={n} className={cn("flex items-center justify-center text-[8px] sm:text-[10px] line-through opacity-60", !has && "opacity-0")}>
                        {has ? n : ""}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
