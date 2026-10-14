"use client";

import { useEffect, useRef, useState } from "react";
import { useSudokuGame } from "@/hooks/use-sudoku-game";
import { useAppStore } from "@/lib/store/app-store";
import { useI18n } from "@/lib/i18n/context";
import { SudokuGamePlay } from "@/components/sudoku/SudokuGamePlay";
import { ShareBoardDialog, LoadSharedBoardDialog } from "@/components/sudoku/ShareDialogs";
import { ExportImageDialog } from "@/components/sudoku/ExportImageDialog";
import { SolverDialog } from "@/components/sudoku/SolverDialog";
import { DifficultyDialog } from "@/components/sudoku/DifficultyDialog";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Board, Difficulty } from "@/lib/sudoku/types";
import { readShareFromUrl, clearShareFromUrl } from "@/lib/sudoku/share";
import { solve } from "@/lib/sudoku/engine";
import { Play, GraduationCap, Share2, ClipboardPaste } from "lucide-react";
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
  const practiceBoard = useAppStore((s) => s.practiceBoard);
  const setPracticeBoard = useAppStore((s) => s.setPracticeBoard);
  const game = useSudokuGame("solo");
  const { state } = game;

  const [shareOpen, setShareOpen] = useState(false);
  const [loadOpen, setLoadOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [solverOpen, setSolverOpen] = useState(false);
  const [difficultyOpen, setDifficultyOpen] = useState(false);

  // If a practice board was set (from Guide), load it once on mount.
  const consumedPractice = useRef(false);
  useEffect(() => {
    if (consumedPractice.current) return;
    if (practiceBoard && state.status === "idle") {
      consumedPractice.current = true;
      game.startPractice(
        practiceBoard.puzzle,
        practiceBoard.solution,
        practiceBoard.difficulty,
        practiceBoard.seed,
        practiceBoard.notes
      );
      setPracticeBoard(null);
    }
  }, [practiceBoard, state.status, game, setPracticeBoard]);

  // Detect a shared board in the URL on mount.
  const consumedShared = useRef(false);
  useEffect(() => {
    if (consumedShared.current) return;
    consumedShared.current = true;
    const code = readShareFromUrl();
    if (code && state.status === "idle") {
      // decode + solve lazily
      import("@/lib/sudoku/share").then(({ decodeBoard }) => {
        const decoded = decodeBoard(code);
        if (!decoded) return;
        const solution = solve(decoded.puzzle);
        if (!solution) return;
        game.startPractice(decoded.puzzle, solution, decoded.difficulty, `shared-${code.slice(0, 16)}`);
        clearShareFromUrl();
      });
    }
  }, [state.status, game]);

  const handleLoadShared = (puzzle: Board, solution: Board, difficulty: Difficulty) => {
    game.startPractice(puzzle, solution, difficulty, `shared-manual`);
  };

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

        {/* Share / Load shared board */}
        <Card className="flex items-center gap-3 border-primary/30 bg-primary/5 p-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Share2 className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium">{t("solo.shareTitle")}</p>
            <p className="text-xs text-muted-foreground">{t("solo.shareDesc")}</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setLoadOpen(true)} className="gap-1.5">
            <ClipboardPaste className="h-3.5 w-3.5" />
            {t("solo.loadShared")}
          </Button>
        </Card>

        {/* Guide practice shortcut */}
        <Card className="flex items-center gap-3 border-primary/20 p-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <GraduationCap className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium">{t("guide.practice")}</p>
            <p className="text-xs text-muted-foreground">{t("guide.subtitle")}</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setRoute("guide")}>
            {t("nav.guide")}
          </Button>
        </Card>

        <LoadSharedBoardDialog open={loadOpen} onOpenChange={setLoadOpen} onLoad={handleLoadShared} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {state.mode === "guide" && (
        <Badge variant="secondary" className="gap-1">
          <GraduationCap className="h-3 w-3" />
          {t("guide.practice")}
        </Badge>
      )}
      <div className="space-y-4">
        <SudokuGamePlay
          game={game}
          backLabel={t("solo.backToLobby")}
          onExit={() => { game.exit(); setRoute("lobby"); }}
          onPlayAgain={() => game.startNew(state.difficulty)}
          onNewGame={() => game.startNew(state.difficulty)}
          onShare={() => setShareOpen(true)}
          onExport={() => setExportOpen(true)}
          onSolver={() => setSolverOpen(true)}
          onDifficulty={() => setDifficultyOpen(true)}
        />
      </div>
      <ShareBoardDialog
        open={shareOpen}
        onOpenChange={setShareOpen}
        puzzle={state.puzzle}
        difficulty={state.difficulty}
      />
      <ExportImageDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        board={state.board}
        notes={state.notes}
        given={state.given}
        title="Sudoku Arena"
        subtitle={`${t("difficulty." + state.difficulty)} · ${t("nav.solo")}`}
      />
      <SolverDialog
        open={solverOpen}
        onOpenChange={setSolverOpen}
        board={state.board}
        notes={state.notes}
        solution={state.solution}
        given={state.given}
        hintCells={state.hintCells}
        onApply={(index, value) => {
          game.select(index);
          game.setValue(value);
        }}
      />
      <DifficultyDialog
        open={difficultyOpen}
        onOpenChange={setDifficultyOpen}
        puzzle={state.board}
      />
    </div>
  );
}
