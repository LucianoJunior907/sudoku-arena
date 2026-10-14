"use client";

import { getBoardTheme, type BoardThemeId } from "@/lib/progression/board-themes";
import { cn } from "@/lib/utils";

/** Mini 3×3 board preview showing how a board theme colors the cells. */
export function BoardThemePreview({ themeId }: { themeId: BoardThemeId | string }) {
  const theme = getBoardTheme(themeId);
  return (
    <div
      className="grid h-12 w-12 grid-cols-3 grid-rows-3 overflow-hidden rounded-md border-2 gap-px"
      style={{
        background: "var(--cell-border-thick)",
        borderColor: "var(--cell-border-thick)",
        ...Object.fromEntries(
          Object.entries(theme.vars).map(([k, v]) => [k, v])
        ),
      } as React.CSSProperties}
    >
      {/* given */}
      <div className="bg-[var(--cell-bg-given)] flex items-center justify-center text-[8px] font-bold text-foreground">5</div>
      {/* peer */}
      <div className="bg-[var(--cell-bg-peer)]" />
      {/* selected */}
      <div className="bg-[var(--cell-bg-selected)] flex items-center justify-center text-[8px] font-bold text-primary">3</div>
      {/* same */}
      <div className="bg-[var(--cell-bg-same)] flex items-center justify-center text-[8px] font-bold text-primary">5</div>
      {/* empty */}
      <div className="bg-[var(--cell-bg)]" />
      {/* conflict */}
      <div className="bg-[var(--cell-bg-error)] flex items-center justify-center text-[8px] font-bold text-[var(--destructive)]">7</div>
      {/* given */}
      <div className="bg-[var(--cell-bg-given)] flex items-center justify-center text-[8px] font-bold text-foreground">1</div>
      {/* empty */}
      <div className="bg-[var(--cell-bg)]" />
      {/* hint */}
      <div className="bg-[var(--cell-bg-hint)] flex items-center justify-center text-[8px] font-bold text-[var(--warning)]">9</div>
    </div>
  );
}
