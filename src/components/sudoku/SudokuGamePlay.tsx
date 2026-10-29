"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { useSudokuGame } from "@/hooks/use-sudoku-game";
import { useAppStore } from "@/lib/store/app-store";
import { useI18n } from "@/lib/i18n/context";
import { getBoardTheme } from "@/lib/progression/board-themes";
import { SudokuBoard } from "@/components/sudoku/SudokuBoard";
import { NumberPad } from "@/components/sudoku/NumberPad";
import { WinScreen } from "@/components/sudoku/WinScreen";
import { ShortcutHelpDialog } from "@/components/sudoku/ShortcutHelpDialog";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { formatTime } from "@/lib/sudoku/saved-game";
import { Clock, AlertTriangle, Pause, Play, RotateCcw, Plus, ChevronLeft, Wand2, SearchCheck, Keyboard, NotebookPen, Share2, Image as ImageIcon, Brain, Gauge } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Game = ReturnType<typeof useSudokuGame>;

export function SudokuGamePlay({
  game,
  onExit,
  onPlayAgain,
  onNewGame,
  onShare,
  onExport,
  onSolver,
  onDifficulty,
  backLabel,
  showNewGame = true,
}: {
  game: Game;
  onExit: () => void;
  onPlayAgain: () => void;
  onNewGame?: () => void;
  onShare?: () => void;
  onExport?: () => void;
  onSolver?: () => void;
  onDifficulty?: () => void;
  backLabel: string;
  showNewGame?: boolean;
}) {
  const { t } = useI18n();
  const settings = useAppStore((s) => s.settings);
  const { state } = game;
  const boardThemeVars = useMemo(() => getBoardTheme(settings.boardTheme).vars, [settings.boardTheme]);
  const [helpOpen, setHelpOpen] = useState(false);
  // Tracks the pending lock intent after pressing L (before the digit
  // arrives). Values: "none" | "value" | "note". Reset on any non-digit
  // key or after the digit is consumed.
  const lockIntentRef = useRef<"none" | "value" | "note">("none");

  // Keyboard support
  useEffect(() => {
    if (state.status === "idle" || state.status === "won") return;
    const moveSelection = (dx: number, dy: number) => {
      const idx = state.selectedIndex;
      if (idx < 0) {
        game.select(0);
        return;
      }
      const row = Math.floor(idx / 9) + dy;
      const col = (idx % 9) + dx;
      if (row < 0 || row > 8 || col < 0 || col > 8) return;
      game.select(row * 9 + col);
    };
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) return;
      // Lock mode: L + digit (value), Shift + L + digit (note).
      // CONTEXT-AWARE (user feedback): when the notes mode (N) is ON,
      // L + digit locks as a NOTE — dragging must produce notes, not
      // values, because that's what "estou no modo anotação" means.
      // "L" alone (without a following digit) or Escape clears the lock.
      if (e.key === "l" || e.key === "L") {
        e.preventDefault();
        // toggle: if a lock is already active, pressing L clears it.
        if (state.lockMode !== "none") {
          game.clearLock();
        }
        // Record intent for the next digit: Shift or notes-mode → note.
        lockIntentRef.current = (e.shiftKey || state.notesMode) ? "note" : "value";
        return;
      }
      if (e.key === "Escape") {
        if (state.lockMode !== "none") {
          e.preventDefault();
          game.clearLock();
          lockIntentRef.current = "none";
          return;
        }
        // fall through to pause/resume below
      }
      if (e.key >= "1" && e.key <= "9") {
        e.preventDefault();
        const n = Number(e.key);
        // If L was just pressed (or a lock is already active), digit
        // sets/switches the locked digit instead of normal placement.
        const hasLockIntent = lockIntentRef.current !== "none";
        const isLocked = state.lockMode !== "none";
        if (hasLockIntent || isLocked) {
          // Note lock when: explicit Shift+L intent, already note-locked,
          // OR notes mode (N) is active — the locked digit follows the
          // current input mode (feedback #2: dragging in notes mode
          // must annotate, never fill values).
          const wantsNote =
            lockIntentRef.current === "note" ||
            state.lockMode === "note" ||
            state.notesMode;
          if (wantsNote) game.lockNote(n);
          else game.lockValue(n);
          lockIntentRef.current = "none";
          return;
        }
        game.setValue(Number(e.key));
      }
      else if (e.key === "0" || e.key === "Backspace" || e.key === "Delete") { e.preventDefault(); game.erase(); }
      else if (e.key === "n" || e.key === "N") game.toggleNotesMode();
      else if (e.key === "h" || e.key === "H") {
        if (game.hintsLeft > 0) { game.hint(); toast.success(t("solo.hintApplied")); }
        else toast.error(t("solo.noMoreHints"));
      }
      else if (e.key === "p" || e.key === "P") {
        if (state.status === "playing") game.pause();
        else if (state.status === "paused") game.resume();
      }
      else if (e.key === "a" || e.key === "A") { game.autoNotes(); lockIntentRef.current = "none"; }
      else if (e.key === "c" || e.key === "C") { game.check(); lockIntentRef.current = "none"; }
      else if (e.key === "?" || (e.shiftKey && e.key === "/")) { e.preventDefault(); setHelpOpen(true); }
      else if ((e.key === "z" || e.key === "Z") && (e.ctrlKey || e.metaKey) && e.shiftKey) { e.preventDefault(); game.redo(); }
      else if ((e.key === "z" || e.key === "Z") && (e.ctrlKey || e.metaKey)) { e.preventDefault(); game.undo(); }
      else if (e.key === "ArrowUp") { e.preventDefault(); moveSelection(0, -1); lockIntentRef.current = "none"; }
      else if (e.key === "ArrowDown") { e.preventDefault(); moveSelection(0, 1); lockIntentRef.current = "none"; }
      else if (e.key === "ArrowLeft") { e.preventDefault(); moveSelection(-1, 0); lockIntentRef.current = "none"; }
      else if (e.key === "ArrowRight") { e.preventDefault(); moveSelection(1, 0); lockIntentRef.current = "none"; }
      else if (e.key !== "Shift" && e.key !== "Control" && e.key !== "Meta" && e.key !== "Alt") {
        // Any other key cancels a pending L-intent
        lockIntentRef.current = "none";
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [state.status, state.selectedIndex, state.lockMode, state.notesMode, game, t]);

  return (
    <div className="space-y-4">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-2">
        <Button variant="ghost" size="sm" onClick={onExit}>
          <ChevronLeft className="mr-1 h-4 w-4" />
          {backLabel}
        </Button>
        <div className="flex items-center gap-1.5">
          <Button variant="outline" size="sm" onClick={() => { if (window.confirm(t("solo.confirmRestart"))) game.restart(); }}>
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
            <span className="hidden sm:inline">{t("solo.restart")}</span>
          </Button>
          {showNewGame && onNewGame && (
            <Button variant="outline" size="sm" onClick={onNewGame}>
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              <span className="hidden sm:inline">{t("solo.newGame")}</span>
            </Button>
          )}
          {onShare && (
            <Button variant="outline" size="sm" onClick={onShare} aria-label={t("solo.share")}>
              <Share2 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{t("solo.share")}</span>
            </Button>
          )}
          {onExport && (
            <Button variant="outline" size="sm" onClick={onExport} aria-label={t("solo.exportImage")}>
              <ImageIcon className="h-3.5 w-3.5" />
              <span className="hidden lg:inline">{t("solo.exportImage")}</span>
            </Button>
          )}
          <Button
            variant={state.status === "paused" ? "default" : "outline"}
            size="sm"
            onClick={() => (state.status === "paused" ? game.resume() : game.pause())}
          >
            {state.status === "paused" ? <Play className="mr-1.5 h-3.5 w-3.5" /> : <Pause className="mr-1.5 h-3.5 w-3.5" />}
            <span className="hidden sm:inline">{state.status === "paused" ? t("solo.resume") : t("solo.pause")}</span>
          </Button>
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <Card className="flex items-center gap-2 p-3">
          <Clock className="h-4 w-4 text-primary" />
          <div>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{t("solo.timer")}</p>
            <p className="font-mono text-base font-bold tabular-nums">{settings.showTimer ? formatTime(state.elapsedSec) : "--:--"}</p>
          </div>
        </Card>
        <Card className="flex items-center gap-2 p-3">
          <AlertTriangle className={cn("h-4 w-4", game.errorsExceeded ? "text-[var(--destructive)]" : "text-muted-foreground")} />
          <div>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{t("solo.errors")}</p>
            <p className="font-mono text-base font-bold tabular-nums">
              {state.mistakes}
              {state.maxErrors > 0 && <span className="text-xs text-muted-foreground">/{state.maxErrors}</span>}
            </p>
          </div>
        </Card>
        <Card className="flex items-center gap-2 p-3">
          <div className="flex-1">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{t("solo.progress")}</p>
            <div className="flex items-center gap-2">
              <Progress value={game.progress} className="h-2" />
              <span className="text-xs font-semibold tabular-nums">{game.progress}%</span>
            </div>
          </div>
        </Card>
      </div>

      {game.errorsExceeded && (
        <div className="rounded-md border border-[var(--destructive)]/30 bg-[var(--destructive)]/10 px-3 py-2 text-center text-sm font-medium text-[var(--destructive)]">
          {t("solo.errorsExceeded")}
        </div>
      )}

      {/* Tools row */}
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={game.autoNotes} className="gap-1.5">
          <Wand2 className="h-3.5 w-3.5 text-primary" />
          <span className="hidden sm:inline">{t("solo.autoNotes")}</span>
        </Button>
        <Button variant="outline" size="sm" onClick={game.clearNotes} className="gap-1.5">
          <NotebookPen className="h-3.5 w-3.5 text-[var(--chart-4)]" />
          <span className="hidden sm:inline">{t("solo.clearNotes")}</span>
        </Button>
        <Button variant="outline" size="sm" onClick={game.check} className="gap-1.5">
          <SearchCheck className="h-3.5 w-3.5 text-[var(--warning)]" />
          <span className="hidden sm:inline">{t("solo.check")}</span>
        </Button>
        {onSolver && (
          <Button variant="outline" size="sm" onClick={onSolver} className="gap-1.5 border-[var(--chart-4)]/30">
            <Brain className="h-3.5 w-3.5 text-[var(--chart-4)]" />
            <span className="hidden lg:inline">{t("solo.solver")}</span>
          </Button>
        )}
        {onDifficulty && (
          <Button variant="outline" size="sm" onClick={onDifficulty} className="gap-1.5" aria-label={t("solo.estimateDifficulty")}>
            <Gauge className="h-3.5 w-3.5 text-[var(--chart-5)]" />
            <span className="hidden lg:inline">{t("solo.estimateDifficulty")}</span>
          </Button>
        )}
        <div className="ml-auto">
          <Button variant="ghost" size="sm" onClick={() => setHelpOpen(true)} aria-label={t("solo.shortcutHelp")}>
            <Keyboard className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <ShortcutHelpDialog open={helpOpen} onOpenChange={setHelpOpen} />

      {/* Board + pad */}
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="relative">
          <SudokuBoard
            board={state.board}
            notes={state.notes}
            given={state.given}
            hintCells={state.hintCells}
            conflicts={game.conflicts}
            wrongCells={game.wrongCells}
            selectedIndex={state.selectedIndex}
            highlightDigit={state.highlightDigit}
            lockMode={state.lockMode}
            lockedDigit={state.lockedDigit}
            onApplyLocked={game.applyLockedValueToCell}
            themeVars={boardThemeVars}
            settings={{
              highlightPeers: settings.highlightPeers,
              highlightSame: settings.highlightSame,
              autoCheck: settings.autoCheck,
              showCandidateCount: settings.showCandidateCount,
            }}
            onSelect={game.select}
          />

          {state.status === "paused" && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center rounded-lg bg-background/90 backdrop-blur-sm">
              <Pause className="mb-3 h-10 w-10 text-primary" />
              <p className="text-xl font-bold">{t("solo.paused")}</p>
              <p className="mt-1 max-w-xs text-center text-sm text-muted-foreground">{t("solo.pausedDesc")}</p>
              <Button className="mt-4" onClick={game.resume}>
                <Play className="mr-1.5 h-4 w-4" />
                {t("solo.resume")}
              </Button>
            </div>
          )}
        </div>

        <div className="space-y-3">
          <NumberPad
            valueCounts={game.valueCounts}
            notesMode={state.notesMode}
            onNumber={(n) => game.setValue(n)}
            onErase={game.erase}
            onToggleNotes={game.toggleNotesMode}
            onHint={() => {
              if (game.hintsLeft > 0) { game.hint(); toast.success(t("solo.hintApplied")); }
              else toast.error(t("solo.noMoreHints"));
            }}
            onUndo={game.undo}
            onRedo={game.redo}
            canUndo={game.canUndo}
            canRedo={game.canRedo}
            hintsLeft={game.hintsLeft}
            selectedValue={state.selectedIndex >= 0 ? state.board[state.selectedIndex] : 0}
            onHoverDigit={game.setHighlightDigit}
          />

          <Card className="p-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{t("solo.selectDifficulty")}</span>
              <span className="font-semibold capitalize">{t(("difficulty." + state.difficulty) as never)}</span>
            </div>
            <div className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <span className={cn("inline-flex items-center gap-1 rounded px-1.5 py-0.5", state.notesMode ? "bg-primary/10 text-primary" : "bg-muted")}>
                {state.notesMode ? t("solo.notesOn") : t("solo.notesOff")}
              </span>
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              {t("solo.shortcuts")}
            </p>
          </Card>
        </div>
      </div>

      {state.status === "won" && (
        <WinScreen
          difficulty={state.difficulty}
          elapsedSec={state.elapsedSec}
          mistakes={state.mistakes}
          hintsUsed={state.hintsUsed}
          xpResult={game.xpResult}
          onPlayAgain={onPlayAgain}
          onBack={onExit}
        />
      )}
    </div>
  );
}
