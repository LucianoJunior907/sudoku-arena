"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import {
  emptyBoard,
  PEERS,
  type Board,
  type Difficulty,
  type Notes,
} from "@/lib/sudoku/types";
import { generatePuzzle } from "@/lib/sudoku/engine";
import { findConflicts, isComplete } from "@/lib/sudoku/engine";
import {
  getSavedGame,
  setSavedGame,
  type GameHistoryEntry,
  type SavedGame,
} from "@/lib/sudoku/saved-game";
import { useAppStore } from "@/lib/store/app-store";
import type { GameMode } from "@/lib/progression/progression";
import { computeDailyScore } from "@/lib/progression/progression";
import { playSound, setSoundEnabled, unlockAudio } from "@/lib/audio/sounds";
import { saveMatchToCloud, saveDailyToCloud } from "@/lib/supabase/matches";
import { supabase } from "@/lib/supabase/client";

export type GameStatus = "idle" | "playing" | "paused" | "won";

export interface GameState {
  status: GameStatus;
  mode: GameMode;
  puzzle: Board;
  solution: Board;
  board: Board;
  notes: Notes;
  given: boolean[];
  hintCells: number[];
  difficulty: Difficulty;
  seed: string;
  dailyDate: string | null;
  selectedIndex: number;
  notesMode: boolean;
  elapsedSec: number;
  mistakes: number;
  hintsUsed: number;
  maxHints: number;
  maxErrors: number;
  history: GameHistoryEntry[];
  redo: GameHistoryEntry[];
  startedAt: string;
  showMistakes: boolean;
  highlightDigit: number; // 0 = none; digit hovered on the number pad
  // Lock mode (L + digit / Shift + L + digit)
  lockMode: "none" | "value" | "note";
  lockedDigit: number; // 1..9 when lockMode !== "none"; 0 otherwise
}

type Action =
  | { type: "NEW"; mode: GameMode; puzzle: Board; solution: Board; difficulty: Difficulty; seed: string; maxHints: number; maxErrors: number; dailyDate: string | null }
  | { type: "LOAD"; saved: SavedGame }
  | { type: "SELECT"; index: number }
  | { type: "SET_VALUE"; index: number; value: number }
  | { type: "TOGGLE_NOTE"; index: number; value: number }
  | { type: "ERASE"; index: number }
  | { type: "UNDO" }
  | { type: "REDO" }
  | { type: "HINT"; index: number }
  | { type: "TOGGLE_NOTES_MODE" }
  | { type: "AUTO_NOTES" }
  | { type: "CLEAR_NOTES" }
  | { type: "CHECK" }
  | { type: "SET_HIGHLIGHT_DIGIT"; digit: number }
  | { type: "SET_NOTES"; index: number; notes: number[] }
  | { type: "PAUSE" }
  | { type: "RESUME" }
  | { type: "TICK" }
  | { type: "RESTART" }
  | { type: "CLEAR" }
  | { type: "LOCK_VALUE"; digit: number }
  | { type: "LOCK_NOTE"; digit: number }
  | { type: "LOCK_CLEAR" };

function makeGiven(puzzle: Board): boolean[] {
  return puzzle.map((v) => v !== 0);
}

function freshState(): GameState {
  return {
    status: "idle",
    mode: "solo",
    puzzle: emptyBoard(),
    solution: emptyBoard(),
    board: emptyBoard(),
    notes: Array.from({ length: 81 }, () => []),
    given: new Array(81).fill(false),
    hintCells: [],
    difficulty: "easy",
    seed: "",
    dailyDate: null,
    selectedIndex: -1,
    notesMode: false,
    elapsedSec: 0,
    mistakes: 0,
    hintsUsed: 0,
    maxHints: 3,
    maxErrors: 5,
    history: [],
    redo: [],
    startedAt: "",
    showMistakes: false,
    highlightDigit: 0,
    lockMode: "none",
    lockedDigit: 0,
  };
}

function applyEntry(board: Board, notes: Notes, e: GameHistoryEntry) {
  board[e.index] = e.nextValue;
  notes[e.index] = e.nextNotes.slice();
}

function revertEntry(board: Board, notes: Notes, e: GameHistoryEntry) {
  board[e.index] = e.prevValue;
  notes[e.index] = e.prevNotes.slice();
}

function reducer(state: GameState, action: Action): GameState {
  switch (action.type) {
    case "NEW": {
      const given = makeGiven(action.puzzle);
      return {
        ...freshState(),
        status: "playing",
        mode: action.mode,
        puzzle: action.puzzle.slice(),
        solution: action.solution.slice(),
        board: action.puzzle.slice(),
        notes: Array.from({ length: 81 }, () => []),
        given,
        difficulty: action.difficulty,
        seed: action.seed,
        dailyDate: action.dailyDate,
        maxHints: action.maxHints,
        maxErrors: action.maxErrors,
        startedAt: new Date().toISOString(),
      };
    }
    case "LOAD": {
      const given = makeGiven(action.saved.puzzle);
      return {
        ...freshState(),
        status: action.saved.paused ? "paused" : action.saved.completed ? "won" : "playing",
        mode: action.saved.mode ?? "solo",
        puzzle: action.saved.puzzle.slice(),
        solution: action.saved.solution.slice(),
        board: action.saved.board.slice(),
        notes: action.saved.notes.map((n) => n.slice()),
        given,
        hintCells: [],
        difficulty: action.saved.difficulty,
        seed: action.saved.seed,
        dailyDate: action.saved.dailyDate ?? null,
        elapsedSec: action.saved.elapsedSec,
        mistakes: action.saved.errors,
        hintsUsed: action.saved.hintsUsed,
        maxHints: action.saved.maxHints,
        maxErrors: action.saved.maxErrors,
        history: action.saved.history.map((h) => ({ ...h, prevNotes: h.prevNotes.slice(), nextNotes: h.nextNotes.slice() })),
        redo: action.saved.redoStack.map((h) => ({ ...h, prevNotes: h.prevNotes.slice(), nextNotes: h.nextNotes.slice() })),
        startedAt: action.saved.startedAt,
      };
    }
    case "SELECT":
      return { ...state, selectedIndex: action.index };
    case "TOGGLE_NOTES_MODE":
      return { ...state, notesMode: !state.notesMode };
    case "AUTO_NOTES": {
      if (state.status !== "playing") return state;
      const notes = state.notes.map((n) => n.slice());
      for (let i = 0; i < 81; i++) {
        if (state.given[i] || state.hintCells.includes(i) || state.board[i] !== 0) {
          continue;
        }
        const used = new Set<number>();
        for (const p of PEERS[i]) {
          if (state.board[p] !== 0) used.add(state.board[p]);
        }
        notes[i] = [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((n) => !used.has(n));
      }
      return { ...state, notes, showMistakes: false };
    }
    case "CLEAR_NOTES": {
      if (state.status !== "playing") return state;
      return {
        ...state,
        notes: Array.from({ length: 81 }, () => []),
        showMistakes: false,
      };
    }
    case "CHECK":
      if (state.status !== "playing") return state;
      return { ...state, showMistakes: true };
    case "SET_HIGHLIGHT_DIGIT":
      return { ...state, highlightDigit: action.digit };
    case "SET_NOTES": {
      if (state.status !== "playing") return state;
      const notes = state.notes.map((n) => n.slice());
      notes[action.index] = action.notes.slice();
      return { ...state, notes };
    }
    case "PAUSE":
      if (state.status !== "playing") return state;
      return { ...state, status: "paused" };
    case "RESUME":
      if (state.status !== "paused") return state;
      return { ...state, status: "playing" };
    case "TICK":
      if (state.status !== "playing") return state;
      return { ...state, elapsedSec: state.elapsedSec + 1 };
    case "CLEAR":
      return freshState();
    case "RESTART": {
      if (state.status === "idle") return state;
      return {
        ...state,
        status: "playing",
        board: state.puzzle.slice(),
        notes: Array.from({ length: 81 }, () => []),
        hintCells: [],
        selectedIndex: -1,
        notesMode: false,
        elapsedSec: 0,
        mistakes: 0,
        hintsUsed: 0,
        history: [],
        redo: [],
        startedAt: new Date().toISOString(),
      };
    }
    case "SET_VALUE": {
      if (state.status !== "playing") return state;
      const i = action.index;
      if (i < 0 || state.given[i] || state.hintCells.includes(i)) return state;
      const prevValue = state.board[i];
      const nextValue = action.value;
      if (nextValue === prevValue) {
        // tapping same value erases
        return reducer(state, { type: "ERASE", index: i });
      }
      const board = state.board.slice();
      const notes = state.notes.map((n) => n.slice());
      board[i] = nextValue;
      notes[i] = [];
      // clear notes in peers for this value
      for (const p of PEERS[i]) {
        if (notes[p].includes(nextValue)) {
          notes[p] = notes[p].filter((n) => n !== nextValue);
        }
      }
      const isWrong = nextValue !== 0 && nextValue !== state.solution[i];
      const wasAlreadyWrong = prevValue !== 0 && prevValue !== state.solution[i];
      // mistake increments only for a NEW wrong placement
      const mistakeDelta = isWrong && !wasAlreadyWrong ? 1 : 0;
      const nextMistakes = state.mistakes + mistakeDelta;
      const entry: GameHistoryEntry = {
        type: "set",
        index: i,
        prevValue,
        nextValue,
        prevNotes: state.notes[i].slice(),
        nextNotes: [],
        prevMistakes: state.mistakes,
        nextMistakes,
        prevHintsUsed: state.hintsUsed,
        nextHintsUsed: state.hintsUsed,
      };
      const won = isComplete(board);
      return {
        ...state,
        board,
        notes,
        mistakes: nextMistakes,
        history: [...state.history, entry],
        redo: [],
        status: won ? "won" : "playing",
        showMistakes: false,
      };
    }
    case "TOGGLE_NOTE": {
      if (state.status !== "playing") return state;
      const i = action.index;
      if (i < 0 || state.given[i] || state.hintCells.includes(i) || state.board[i] !== 0) return state;
      const prevNotes = state.notes[i].slice();
      const has = prevNotes.includes(action.value);
      const nextNotes = has
        ? prevNotes.filter((n) => n !== action.value)
        : [...prevNotes, action.value].sort();
      const notes = state.notes.map((n) => n.slice());
      notes[i] = nextNotes;
      const entry: GameHistoryEntry = {
        type: "note-add",
        index: i,
        prevValue: 0,
        nextValue: 0,
        prevNotes,
        nextNotes: nextNotes.slice(),
        prevMistakes: state.mistakes,
        nextMistakes: state.mistakes,
        prevHintsUsed: state.hintsUsed,
        nextHintsUsed: state.hintsUsed,
      };
      return {
        ...state,
        notes,
        history: [...state.history, entry],
        redo: [],
      };
    }
    case "ERASE": {
      if (state.status !== "playing") return state;
      const i = action.index;
      if (i < 0 || state.given[i] || state.hintCells.includes(i)) return state;
      const prevValue = state.board[i];
      const prevNotes = state.notes[i].slice();
      if (prevValue === 0 && prevNotes.length === 0) return state;
      const board = state.board.slice();
      const notes = state.notes.map((n) => n.slice());
      board[i] = 0;
      notes[i] = [];
      const wasAlreadyWrong = prevValue !== 0 && prevValue !== state.solution[i];
      // erasing a wrong cell relieves the mistake counter? No — mistakes are
      // cumulative (once made, counted). Keep cumulative. So no delta.
      const entry: GameHistoryEntry = {
        type: "erase",
        index: i,
        prevValue,
        nextValue: 0,
        prevNotes,
        nextNotes: [],
        prevMistakes: state.mistakes,
        nextMistakes: state.mistakes,
        prevHintsUsed: state.hintsUsed,
        nextHintsUsed: state.hintsUsed,
      };
      return {
        ...state,
        board,
        notes,
        history: [...state.history, entry],
        redo: [],
        showMistakes: false,
      };
    }
    case "HINT": {
      if (state.status !== "playing") return state;
      if (state.hintsUsed >= state.maxHints) return state;
      // choose the selected empty/wrong cell, or the first empty cell
      let target = -1;
      const candidates: number[] = [];
      for (let i = 0; i < 81; i++) {
        if (state.given[i] || state.hintCells.includes(i)) continue;
        if (state.board[i] !== state.solution[i]) candidates.push(i);
      }
      if (candidates.length === 0) return state;
      // prefer selected if it's a candidate
      if (state.selectedIndex >= 0 && candidates.includes(state.selectedIndex)) {
        target = state.selectedIndex;
      } else {
        target = candidates[Math.floor(Math.random() * candidates.length)];
      }
      const prevValue = state.board[target];
      const prevNotes = state.notes[target].slice();
      const nextValue = state.solution[target];
      const board = state.board.slice();
      const notes = state.notes.map((n) => n.slice());
      board[target] = nextValue;
      notes[target] = [];
      for (const p of PEERS[target]) {
        if (notes[p].includes(nextValue)) {
          notes[p] = notes[p].filter((n) => n !== nextValue);
        }
      }
      const nextHintsUsed = state.hintsUsed + 1;
      const entry: GameHistoryEntry = {
        type: "hint",
        index: target,
        prevValue,
        nextValue,
        prevNotes,
        nextNotes: [],
        prevMistakes: state.mistakes,
        nextMistakes: state.mistakes,
        prevHintsUsed: state.hintsUsed,
        nextHintsUsed,
      };
      const won = isComplete(board);
      return {
        ...state,
        board,
        notes,
        hintCells: [...state.hintCells, target],
        hintsUsed: nextHintsUsed,
        history: [...state.history, entry],
        redo: [],
        status: won ? "won" : "playing",
        showMistakes: false,
      };
    }
    case "UNDO": {
      if (state.history.length === 0) return state;
      const entry = state.history[state.history.length - 1];
      const board = state.board.slice();
      const notes = state.notes.map((n) => n.slice());
      revertEntry(board, notes, entry);
      const hintCells =
        entry.type === "hint" ? state.hintCells.filter((c) => c !== entry.index) : state.hintCells;
      return {
        ...state,
        board,
        notes,
        mistakes: entry.prevMistakes,
        hintsUsed: entry.prevHintsUsed,
        hintCells,
        history: state.history.slice(0, -1),
        redo: [entry, ...state.redo],
        status: state.status === "won" ? "playing" : state.status,
        showMistakes: false,
      };
    }
    case "REDO": {
      if (state.redo.length === 0) return state;
      const entry = state.redo[0];
      const board = state.board.slice();
      const notes = state.notes.map((n) => n.slice());
      applyEntry(board, notes, entry);
      const hintCells =
        entry.type === "hint" ? [...state.hintCells, entry.index] : state.hintCells;
      const won = isComplete(board);
      return {
        ...state,
        board,
        notes,
        mistakes: entry.nextMistakes,
        hintsUsed: entry.nextHintsUsed,
        hintCells,
        history: [...state.history, entry],
        redo: state.redo.slice(1),
        status: won ? "won" : state.status,
        showMistakes: false,
      };
    }
    case "LOCK_VALUE":
      if (action.digit < 1 || action.digit > 9) return state;
      return { ...state, lockMode: "value", lockedDigit: action.digit, highlightDigit: action.digit };
    case "LOCK_NOTE":
      if (action.digit < 1 || action.digit > 9) return state;
      return { ...state, lockMode: "note", lockedDigit: action.digit, highlightDigit: action.digit };
    case "LOCK_CLEAR":
      // Reset highlightDigit too: it was overridden by the lock. If the
      // mouse is still hovering a number-pad button, its onMouseEnter
      // will re-set it. This avoids a "phantom" highlight lingering
      // after the lock is dismissed.
      return { ...state, lockMode: "none", lockedDigit: 0, highlightDigit: 0 };
    default:
      return state;
  }
}

export interface XpResult {
  xp: number;
  leveledUp: boolean;
  newLevel: number;
  unlockedCosmeticIds: string[];
  isRecord: boolean;
  bonusXp?: number;
  unlockedAchievements?: string[];
}

export function useSudokuGame(mode: GameMode = "solo") {
  const settings = useAppStore((s) => s.settings);
  const [state, dispatch] = useReducer(reducer, undefined, freshState);
  const recordGame = useAppStore((s) => s.recordGame);
  const recordDaily = useAppStore((s) => s.recordDaily);
  const checkAchievements = useAppStore((s) => s.checkAchievements);
  const recordedRef = useRef(false);

  // Sync the sound-enabled flag with settings.
  useEffect(() => {
    setSoundEnabled(settings.soundEnabled);
  }, [settings.soundEnabled]);

  // Resume a saved game on first mount.
  const didInit = useRef(false);
  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;
    const saved = getSavedGame(mode);
    if (saved && !saved.completed && saved.mode === mode) {
      dispatch({ type: "LOAD", saved });
    }
  }, [mode]);

  // Timer
  useEffect(() => {
    if (state.status !== "playing") return;
    const id = setInterval(() => dispatch({ type: "TICK" }), 1000);
    return () => clearInterval(id);
  }, [state.status]);

  // Autosave (debounced) — persist whenever the in-progress game changes.
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (state.status === "idle") return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      persist(state, mode);
    }, 400);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [state, mode]);

  const lastXpResultRef = useRef<XpResult | null>(null);
  const [xpResult, setXpResult] = useState<XpResult | null>(null);

  // On win: record once, clear saved game
  useEffect(() => {
    if (state.status === "won" && !recordedRef.current) {
      recordedRef.current = true;
      playSound("win");
      const result = recordGame({
        mode: state.mode,
        difficulty: state.difficulty,
        elapsedSec: state.elapsedSec,
        errors: state.mistakes,
        hintsUsed: state.hintsUsed,
        completed: true,
      });
      if (state.mode === "daily" && state.dailyDate) {
        const score = computeDailyScore({
          difficulty: state.difficulty,
          elapsedSec: state.elapsedSec,
          errors: state.mistakes,
          hintsUsed: state.hintsUsed,
          completed: true,
        });
        recordDaily({
          mode: state.mode,
          difficulty: state.difficulty,
          elapsedSec: state.elapsedSec,
          errors: state.mistakes,
          hintsUsed: state.hintsUsed,
          completed: true,
          date: state.dailyDate,
          score,
        });
      }
      // Evaluate achievements (after stats + streak updated). Awards bonus XP.
      const ach = checkAchievements({
        mode: state.mode,
        difficulty: state.difficulty,
        elapsedSec: state.elapsedSec,
        errors: state.mistakes,
        hintsUsed: state.hintsUsed,
        completed: true,
      });
      setSavedGame(mode, null);
      const finalResult = { ...result, bonusXp: ach.bonusXp, unlockedAchievements: ach.newlyUnlocked };
      lastXpResultRef.current = finalResult;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot side effect on win transition
      setXpResult(finalResult);

      // Save to Supabase cloud if user is logged in (fire-and-forget, non-blocking).
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (!session?.user) return;
        const userId = session.user.id;
        // Save match
        saveMatchToCloud(userId, {
          mode: state.mode,
          difficulty: state.difficulty,
          elapsedSec: state.elapsedSec,
          errors: state.mistakes,
          hintsUsed: state.hintsUsed,
          completed: true,
          xpEarned: finalResult.xp + (finalResult.bonusXp ?? 0),
          score: state.mode === "daily" ? computeDailyScore({
            difficulty: state.difficulty,
            elapsedSec: state.elapsedSec,
            errors: state.mistakes,
            hintsUsed: state.hintsUsed,
            completed: true,
          }) : finalResult.xp,
          isRecord: finalResult.isRecord,
        });
        // Save daily record if daily mode
        if (state.mode === "daily" && state.dailyDate) {
          saveDailyToCloud(userId, {
            date: state.dailyDate,
            difficulty: state.difficulty,
            completed: true,
            elapsedSec: state.elapsedSec,
            errors: state.mistakes,
            score: computeDailyScore({
              difficulty: state.difficulty,
              elapsedSec: state.elapsedSec,
              errors: state.mistakes,
              hintsUsed: state.hintsUsed,
              completed: true,
            }),
          });
        }
      });
    }
  }, [state.status, state.mode, state.difficulty, state.elapsedSec, state.mistakes, state.hintsUsed, state.dailyDate, recordGame, recordDaily, checkAchievements, mode]);

  // Derived
  const conflicts = useMemo(() => findConflicts(state.board), [state.board]);
  const wrongCells = useMemo(() => {
    if (!state.showMistakes) return new Set<number>();
    const s = new Set<number>();
    for (let i = 0; i < 81; i++) {
      if (state.given[i] || state.hintCells.includes(i)) continue;
      const v = state.board[i];
      if (v !== 0 && v !== state.solution[i]) s.add(i);
    }
    return s;
  }, [state.showMistakes, state.board, state.solution, state.given, state.hintCells]);
  const filled = useMemo(() => state.board.filter((v) => v !== 0).length, [state.board]);
  const totalEmpty = useMemo(
    () => state.puzzle.filter((v) => v === 0).length,
    [state.puzzle]
  );
  const progress = totalEmpty === 0 ? 100 : Math.round(((filled - (81 - totalEmpty)) / totalEmpty) * 100);

  const valueCounts = useMemo(() => {
    const counts = new Array(10).fill(0);
    for (const v of state.board) if (v >= 1 && v <= 9) counts[v]++;
    return counts;
  }, [state.board]);

  // Actions
  const startNew = useCallback(
    (difficulty: Difficulty) => {
      const p = generatePuzzle(difficulty);
      dispatch({
        type: "NEW",
        mode,
        puzzle: p.puzzle,
        solution: p.solution,
        difficulty,
        seed: p.seed,
        maxHints: settings.maxHints,
        maxErrors: settings.maxErrors,
        dailyDate: null,
      });
      recordedRef.current = false;
      lastXpResultRef.current = null;
      setXpResult(null);
    },
    [mode, settings.maxHints, settings.maxErrors]
  );

  const startDaily = useCallback(
    (date: string, difficulty: Difficulty) => {
      const seed = `daily-${date}-${difficulty}-v1`;
      const p = generatePuzzle(difficulty, seed);
      dispatch({
        type: "NEW",
        mode: "daily",
        puzzle: p.puzzle,
        solution: p.solution,
        difficulty,
        seed: p.seed,
        maxHints: settings.maxHints,
        maxErrors: settings.maxErrors,
        dailyDate: date,
      });
      recordedRef.current = false;
      lastXpResultRef.current = null;
      setXpResult(null);
    },
    [settings.maxHints, settings.maxErrors]
  );

  /** Load a custom puzzle (e.g. a Guide technique illustration) into practice mode. */
  const startPractice = useCallback(
    (puzzle: Board, solution: Board, difficulty: Difficulty, seed: string, initialNotes?: Notes) => {
      dispatch({
        type: "NEW",
        mode: "guide",
        puzzle,
        solution,
        difficulty,
        seed,
        maxHints: settings.maxHints,
        maxErrors: 0, // practice: unlimited errors
        dailyDate: null,
      });
      // optionally seed notes from the technique illustration
      if (initialNotes) {
        for (let i = 0; i < 81; i++) {
          if (initialNotes[i].length > 0 && puzzle[i] === 0) {
            dispatch({ type: "SET_NOTES", index: i, notes: initialNotes[i] });
          }
        }
      }
      recordedRef.current = false;
      lastXpResultRef.current = null;
      setXpResult(null);
    },
    [settings.maxHints]
  );

  const select = useCallback((index: number) => { playSound("select"); dispatch({ type: "SELECT", index }); }, []);
  const setValue = useCallback(
    (value: number) => {
      if (state.notesMode) {
        playSound("note");
        dispatch({ type: "TOGGLE_NOTE", index: state.selectedIndex, value });
      } else {
        const prev = state.selectedIndex >= 0 ? state.board[state.selectedIndex] : 0;
        if (value === prev) {
          playSound("erase");
        } else if (state.selectedIndex >= 0 && value !== state.solution[state.selectedIndex]) {
          playSound("placeWrong");
        } else {
          playSound("place");
        }
        dispatch({ type: "SET_VALUE", index: state.selectedIndex, value });
      }
    },
    [state.notesMode, state.selectedIndex, state.board, state.solution]
  );
  const toggleNote = useCallback(
    (value: number) => { playSound("note"); dispatch({ type: "TOGGLE_NOTE", index: state.selectedIndex, value }); },
    [state.selectedIndex]
  );
  const erase = useCallback(() => { playSound("erase"); dispatch({ type: "ERASE", index: state.selectedIndex }); }, [state.selectedIndex]);
  const undo = useCallback(() => { playSound("undo"); dispatch({ type: "UNDO" }); }, []);
  const redo = useCallback(() => { playSound("redo"); dispatch({ type: "REDO" }); }, []);
  const hint = useCallback(() => { playSound("hint"); dispatch({ type: "HINT", index: state.selectedIndex }); }, [state.selectedIndex]);
  const toggleNotesMode = useCallback(() => dispatch({ type: "TOGGLE_NOTES_MODE" }), []);
  const autoNotes = useCallback(() => { playSound("note"); dispatch({ type: "AUTO_NOTES" }); }, []);
  const clearNotes = useCallback(() => { playSound("erase"); dispatch({ type: "CLEAR_NOTES" }); }, []);
  const check = useCallback(() => { playSound("select"); dispatch({ type: "CHECK" }); }, []);
  const setHighlightDigit = useCallback((digit: number) => dispatch({ type: "SET_HIGHLIGHT_DIGIT", digit }), []);
  const lockValue = useCallback((digit: number) => dispatch({ type: "LOCK_VALUE", digit }), []);
  const lockNote = useCallback((digit: number) => dispatch({ type: "LOCK_NOTE", digit }), []);
  const clearLock = useCallback(() => dispatch({ type: "LOCK_CLEAR" }), []);
  // Apply the currently locked value/note to a specific cell. Used by
  // click+drag on the board. Respects the same edit rules as normal
  // input: given/hint cells are skipped, and in value-mode cells that
  // already hold a different user value are NOT overwritten (matching
  // the spec "não sobrescreva ... números preexistentes que não possam
  // ser alterados"). For note mode, toggles the note on each dragged
  // cell — but to make drag intuitive we only ADD the note (idempotent
  // across a single drag), never remove it mid-drag.
  const applyLockedValueToCell = useCallback(
    (index: number, allowToggle = false) => {
      if (index < 0 || index > 80) return;
      if (state.lockMode === "value") {
        const v = state.lockedDigit;
        if (state.given[index] || state.hintCells.includes(index)) return;
        const prev = state.board[index];
        // Don't overwrite a different pre-existing user value.
        if (prev !== 0 && prev !== v) return;
        // Same value: erase ONLY on an explicit click (allowToggle).
        // During a drag-paint pass we skip — never erase mid-drag.
        // (When allowToggle is true, SET_VALUE with the same value
        // triggers the reducer's tap-same-erases path → toggle remove.)
        if (prev === v && !allowToggle) return;
        dispatch({ type: "SET_VALUE", index, value: v });
      } else if (state.lockMode === "note") {
        const v = state.lockedDigit;
        if (state.given[index] || state.hintCells.includes(index)) return;
        if (state.board[index] !== 0) return; // only empty cells get notes
        const current = state.notes[index];
        if (current.includes(v)) return; // idempotent for drag, preserves existing
        dispatch({ type: "TOGGLE_NOTE", index, value: v });
      }
    },
    [state.lockMode, state.lockedDigit, state.given, state.hintCells, state.board, state.notes]
  );
  const pause = useCallback(() => dispatch({ type: "PAUSE" }), []);
  const resume = useCallback(() => dispatch({ type: "RESUME" }), []);
  const restart = useCallback(() => {
    dispatch({ type: "RESTART" });
    recordedRef.current = false;
    lastXpResultRef.current = null;
    setXpResult(null);
  }, []);

  const exit = useCallback(() => {
    persist(state, mode);
    dispatch({ type: "CLEAR" });
  }, [state, mode]);

  return {
    state,
    conflicts,
    wrongCells,
    progress,
    valueCounts,
    xpResult,
    startNew,
    startDaily,
    startPractice,
    select,
    setValue,
    toggleNote,
    erase,
    undo,
    redo,
    hint,
    toggleNotesMode,
    autoNotes,
    clearNotes,
    check,
    setHighlightDigit,
    lockValue,
    lockNote,
    clearLock,
    applyLockedValueToCell,
    pause,
    resume,
    restart,
    exit,
    canUndo: state.history.length > 0,
    canRedo: state.redo.length > 0,
    hasActiveGame: state.status !== "idle",
    hintsLeft: Math.max(0, state.maxHints - state.hintsUsed),
    errorsExceeded: state.maxErrors > 0 && state.mistakes >= state.maxErrors,
  };
}

function persist(state: GameState, mode: GameMode = "solo") {
  if (state.status === "idle") return;
  const saved: SavedGame = {
    mode,
    puzzle: state.puzzle.slice(),
    solution: state.solution.slice(),
    board: state.board.slice(),
    notes: state.notes.map((n) => n.slice()),
    difficulty: state.difficulty,
    seed: state.seed,
    elapsedSec: state.elapsedSec,
    errors: state.mistakes,
    hintsUsed: state.hintsUsed,
    maxHints: state.maxHints,
    maxErrors: state.maxErrors,
    startedAt: state.startedAt,
    lastSavedAt: new Date().toISOString(),
    history: state.history.map((h) => ({ ...h, prevNotes: h.prevNotes.slice(), nextNotes: h.nextNotes.slice() })),
    redoStack: state.redo.map((h) => ({ ...h, prevNotes: h.prevNotes.slice(), nextNotes: h.nextNotes.slice() })),
    completed: state.status === "won",
    paused: state.status === "paused",
    dailyDate: state.dailyDate ?? undefined,
  };
  setSavedGame(mode, saved);
}
