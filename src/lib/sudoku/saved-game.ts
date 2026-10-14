import { localPersistence } from "@/lib/persistence/local-storage";
import type { Board, Difficulty, Notes } from "./types";
import type { GameMode } from "@/lib/progression/progression";

/** Snapshot of an in-progress game, persisted to resume after reload. */
export interface SavedGame {
  mode: GameMode;
  puzzle: Board; // original givens (0 = empty)
  solution: Board;
  board: Board; // current state
  notes: Notes;
  difficulty: Difficulty;
  seed: string;
  elapsedSec: number;
  errors: number;
  hintsUsed: number;
  maxHints: number;
  maxErrors: number;
  startedAt: string;
  lastSavedAt: string;
  history: GameHistoryEntry[];
  redoStack: GameHistoryEntry[];
  completed: boolean;
  paused: boolean;
  /** For daily mode: the date string (YYYY-MM-DD). */
  dailyDate?: string;
}

export interface GameHistoryEntry {
  type: "set" | "erase" | "note-add" | "note-remove" | "note-clear" | "hint";
  index: number;
  prevValue: number;
  nextValue: number;
  prevNotes: number[];
  nextNotes: number[];
  prevMistakes?: number;
  nextMistakes?: number;
  prevHintsUsed?: number;
  nextHintsUsed?: number;
}

function keyFor(mode: GameMode) {
  return mode === "daily" ? "saved-game-daily" : "saved-game";
}

export function getSavedGame(mode: GameMode = "solo"): SavedGame | null {
  const g = localPersistence.get<SavedGame | null>(keyFor(mode), null);
  if (g && g.mode !== mode) return null;
  return g;
}

export function setSavedGame(mode: GameMode, game: SavedGame | null): void {
  const k = keyFor(mode);
  if (game === null) localPersistence.remove(k);
  else localPersistence.set(k, game);
}

export function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function getSavedGameSummary(
  mode: GameMode = "solo"
): {
  difficulty: Difficulty;
  progress: number;
  timeLabel: string;
  errors: number;
} | null {
  const g = getSavedGame(mode);
  if (!g || g.completed) return null;
  const filled = g.board.filter((v) => v !== 0).length;
  const total = g.puzzle.filter((v) => v === 0).length || 1;
  const progress = Math.round(((filled - g.puzzle.filter((v) => v !== 0).length) / total) * 100);
  return {
    difficulty: g.difficulty,
    progress: Math.max(0, Math.min(100, progress)),
    timeLabel: formatTime(g.elapsedSec),
    errors: g.errors,
  };
}
