import type { Board } from "./types";
import { PEERS, BOX_INDEX } from "./types";
import { candidatesFor } from "./solver-hint";

export type DifficultyRating = "trivial" | "easy" | "medium" | "hard" | "expert" | "diabolical";

export interface DifficultyEstimate {
  rating: DifficultyRating;
  score: number; // 0-100
  techniquesUsed: string[];
  emptyCells: number;
  nakedSingles: number;
  hiddenSingles: number;
  nakedPairs: number;
  needsAdvanced: boolean;
}

/**
 * Estimate the difficulty of a Sudoku puzzle by analyzing which techniques
 * are needed to solve it progressively. Simulates a logical solve:
 * repeatedly applies naked singles, hidden singles, and naked pairs until
 * stuck, then estimates remaining difficulty.
 */
export function estimateDifficulty(puzzle: Board): DifficultyEstimate {
  const board = puzzle.slice();
  const techniquesUsed: string[] = [];
  let nakedSingles = 0;
  let hiddenSingles = 0;
  let nakedPairs = 0;
  let progress = true;
  let rounds = 0;
  const maxRounds = 100;

  while (progress && rounds < maxRounds) {
    progress = false;
    rounds++;

    // Try naked singles
    for (let i = 0; i < 81; i++) {
      if (board[i] !== 0) continue;
      const cands = candidatesFor(board, i);
      if (cands.length === 1) {
        board[i] = cands[0];
        nakedSingles++;
        progress = true;
        if (!techniquesUsed.includes("naked-single")) techniquesUsed.push("naked-single");
      }
    }

    if (progress) continue;

    // Try hidden singles
    const hidden = findAndApplyHiddenSingle(board);
    if (hidden) {
      hiddenSingles++;
      progress = true;
      if (!techniquesUsed.includes("hidden-single")) techniquesUsed.push("hidden-single");
      continue;
    }

    // Try naked pair eliminations
    const pair = findAndApplyNakedPair(board);
    if (pair) {
      nakedPairs++;
      progress = true;
      if (!techniquesUsed.includes("naked-pair")) techniquesUsed.push("naked-pair");
      continue;
    }
  }

  const emptyCells = board.filter((v) => v === 0).length;
  const needsAdvanced = emptyCells > 0;
  const hasNakedPairs = nakedPairs > 0;

  // Score: 0 = trivial (all naked singles), 100 = diabolical (needs advanced)
  let score = 0;
  if (hiddenSingles > 0) score = Math.max(score, 20);
  if (hasNakedPairs) score = Math.max(score, 45);
  if (needsAdvanced) {
    // More empty cells remaining = harder
    score = Math.min(100, 60 + Math.round((emptyCells / 50) * 40));
  }

  // Add partial credit for technique complexity
  if (techniquesUsed.length >= 3) score = Math.min(100, score + 10);

  const rating: DifficultyRating =
    score < 15 ? "trivial" :
    score < 35 ? "easy" :
    score < 55 ? "medium" :
    score < 75 ? "hard" :
    score < 90 ? "expert" : "diabolical";

  return {
    rating,
    score,
    techniquesUsed,
    emptyCells,
    nakedSingles,
    hiddenSingles,
    nakedPairs,
    needsAdvanced,
  };
}

function findAndApplyHiddenSingle(board: Board): boolean {
  for (let row = 0; row < 9; row++) {
    const cells = Array.from({ length: 9 }, (_, c) => row * 9 + c);
    if (applyHiddenInUnit(board, cells)) return true;
  }
  for (let col = 0; col < 9; col++) {
    const cells = Array.from({ length: 9 }, (_, r) => r * 9 + col);
    if (applyHiddenInUnit(board, cells)) return true;
  }
  for (let b = 0; b < 9; b++) {
    if (applyHiddenInUnit(board, BOX_INDEX[b])) return true;
  }
  return false;
}

function applyHiddenInUnit(board: Board, cells: number[]): boolean {
  for (let digit = 1; digit <= 9; digit++) {
    if (cells.some((c) => board[c] === digit)) continue;
    const possible: number[] = [];
    for (const c of cells) {
      if (board[c] !== 0) continue;
      if (candidatesFor(board, c).includes(digit)) possible.push(c);
    }
    if (possible.length === 1) {
      board[possible[0]] = digit;
      return true;
    }
  }
  return false;
}

function findAndApplyNakedPair(board: Board): boolean {
  const units: number[][] = [];
  for (let row = 0; row < 9; row++) units.push(Array.from({ length: 9 }, (_, c) => row * 9 + c));
  for (let col = 0; col < 9; col++) units.push(Array.from({ length: 9 }, (_, r) => r * 9 + col));
  for (let b = 0; b < 9; b++) units.push(BOX_INDEX[b]);

  for (const unit of units) {
    const pairs: { idx: number; cands: number[] }[] = [];
    for (const c of unit) {
      if (board[c] !== 0) continue;
      const cands = candidatesFor(board, c);
      if (cands.length === 2) pairs.push({ idx: c, cands });
    }
    for (let i = 0; i < pairs.length; i++) {
      for (let j = i + 1; j < pairs.length; j++) {
        if (pairs[i].cands[0] === pairs[j].cands[0] && pairs[i].cands[1] === pairs[j].cands[1]) {
          // Found naked pair — eliminate from other cells in unit
          const [d1, d2] = pairs[i].cands;
          let changed = false;
          for (const c of unit) {
            if (c === pairs[i].idx || c === pairs[j].idx || board[c] !== 0) continue;
            // We can't eliminate candidates from the board directly (they're
            // implied, not stored). But we can check if any cell becomes a
            // naked single after "elimination". For scoring purposes, we
            // just report that a naked pair was found.
            const cands = candidatesFor(board, c);
            const filtered = cands.filter((x) => x !== d1 && x !== d2);
            if (filtered.length === 1) {
              board[c] = filtered[0];
              changed = true;
              break;
            }
          }
          if (changed) return true;
        }
      }
    }
  }
  return false;
}
