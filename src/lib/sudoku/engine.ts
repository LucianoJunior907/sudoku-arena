import {
  BOX_INDEX,
  PEERS,
  cloneBoard,
  emptyBoard,
  type Board,
  type CellValue,
  type Difficulty,
  type GeneratedPuzzle,
} from "./types";

/* ------------------------------------------------------------------ */
/* Validation                                                          */
/* ------------------------------------------------------------------ */

/** Returns true if `board` (may be partial) has no row/col/box conflicts. */
export function isValid(board: Board): boolean {
  for (let i = 0; i < 81; i++) {
    const v = board[i];
    if (v === 0) continue;
    for (const p of PEERS[i]) {
      if (board[p] === v) return false;
    }
  }
  return true;
}

/** Returns the set of cell indices that conflict with another filled cell. */
export function findConflicts(board: Board): Set<number> {
  const conflicts = new Set<number>();
  for (let i = 0; i < 81; i++) {
    const v = board[i];
    if (v === 0) continue;
    for (const p of PEERS[i]) {
      if (board[p] === v) {
        conflicts.add(i);
        conflicts.add(p);
      }
    }
  }
  return conflicts;
}

/** Returns true if the board is fully and correctly filled. */
export function isComplete(board: Board): boolean {
  for (let i = 0; i < 81; i++) {
    if (board[i] === 0) return false;
  }
  return isValid(board);
}

/* ------------------------------------------------------------------ */
/* Solver — backtracking with MRV (minimum remaining values)          */
/* ------------------------------------------------------------------ */

/** Count solutions up to `limit`. Returns the count found (capped at limit). */
export function countSolutions(board: Board, limit = 2): number {
  const work = cloneBoard(board);
  let count = 0;

  function solve(): boolean {
    // find empty cell with fewest candidates (MRV)
    let bestIdx = -1;
    let bestCands: number[] = [];
    let bestCount = 10;
    for (let i = 0; i < 81; i++) {
      if (work[i] !== 0) continue;
      const cands = candidatesFor(work, i);
      if (cands.length < bestCount) {
        bestCount = cands.length;
        bestIdx = i;
        bestCands = cands;
        if (bestCount === 0) return false; // dead end
        if (bestCount === 1) break;
      }
    }
    if (bestIdx === -1) {
      // no empty cells → solution
      count++;
      return count >= limit;
    }
    for (const v of bestCands) {
      work[bestIdx] = v;
      if (solve()) return true;
      work[bestIdx] = 0;
    }
    return false;
  }

  solve();
  return count;
}

export function hasUniqueSolution(board: Board): boolean {
  return countSolutions(board, 2) === 1;
}

/** Returns one solution, or null if unsolvable. */
export function solve(board: Board): Board | null {
  const work = cloneBoard(board);
  if (!solveBacktrack(work)) return null;
  return work;
}

function solveBacktrack(work: Board): boolean {
  let bestIdx = -1;
  let bestCands: number[] = [];
  let bestCount = 10;
  for (let i = 0; i < 81; i++) {
    if (work[i] !== 0) continue;
    const cands = candidatesFor(work, i);
    if (cands.length < bestCount) {
      bestCount = cands.length;
      bestIdx = i;
      bestCands = cands;
      if (bestCount === 0) return false;
      if (bestCount === 1) break;
    }
  }
  if (bestIdx === -1) return true; // solved
  for (const v of bestCands) {
    work[bestIdx] = v;
    if (solveBacktrack(work)) return true;
    work[bestIdx] = 0;
  }
  return false;
}

function candidatesFor(board: Board, index: number): number[] {
  const v = board[index];
  if (v !== 0) return [];
  const used = new Set<number>();
  for (const p of PEERS[index]) {
    if (board[p] !== 0) used.add(board[p]);
  }
  const out: number[] = [];
  for (let n = 1; n <= 9; n++) {
    if (!used.has(n)) out.push(n);
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Seeded PRNG (mulberry32)                                            */
/* ------------------------------------------------------------------ */

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashStringToSeed(str: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function shuffle<T>(arr: T[], rng: () => number): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Full-board generator (random valid solved grid)                    */
/* ------------------------------------------------------------------ */

export function generateSolvedBoard(seed: string): Board {
  const rng = mulberry32(hashStringToSeed(seed));
  const board = emptyBoard();

  // Fill the three diagonal boxes first (they don't share rows/cols),
  // then solve the rest with backtracking using randomized digits.
  for (let b = 0; b < 9; b += 4) {
    const cells = BOX_INDEX[b];
    const digits = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9], rng);
    cells.forEach((cell, i) => {
      board[cell] = digits[i];
    });
  }
  // Fill remaining via backtracking
  fillBoard(board, rng);
  return board;
}

function fillBoard(board: Board, rng: () => number): boolean {
  let idx = -1;
  for (let i = 0; i < 81; i++) {
    if (board[i] === 0) {
      idx = i;
      break;
    }
  }
  if (idx === -1) return true;
  const digits = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9], rng);
  for (const d of digits) {
    if (canPlace(board, idx, d)) {
      board[idx] = d;
      if (fillBoard(board, rng)) return true;
      board[idx] = 0;
    }
  }
  return false;
}

function canPlace(board: Board, index: number, value: CellValue): boolean {
  for (const p of PEERS[index]) {
    if (board[p] === value) return false;
  }
  return true;
}

/* ------------------------------------------------------------------ */
/* Puzzle generator — produces unique-solution puzzles                */
/* ------------------------------------------------------------------ */

const DIFFICULTY_TARGETS: Record<string, { min: number; max: number; maxTries: number }> = {
  easy: { min: 36, max: 45, maxTries: 60 },
  medium: { min: 30, max: 35, maxTries: 80 },
  hard: { min: 26, max: 30, maxTries: 120 },
  expert: { min: 22, max: 26, maxTries: 200 },
};

export function generatePuzzle(difficulty: Difficulty, seed?: string): GeneratedPuzzle {
  const actualSeed = seed ?? `${difficulty}-${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
  const solved = generateSolvedBoard(actualSeed);
  const target = DIFFICULTY_TARGETS[difficulty];
  const rng = mulberry32(hashStringToSeed(actualSeed + ":dig"));

  // Remove cells symmetrically while keeping uniqueness.
  const puzzle = cloneBoard(solved);
  const order = shuffle(
    Array.from({ length: 81 }, (_, i) => i),
    rng
  );

  let remaining = 81;
  for (const idx of order) {
    if (remaining <= target.max) break;
    if (puzzle[idx] === 0) continue;
    const symIdx = 80 - idx;
    const backup1 = puzzle[idx];
    const backup2 = puzzle[symIdx];
    puzzle[idx] = 0;
    if (idx !== symIdx) puzzle[symIdx] = 0;

    if (!hasUniqueSolution(puzzle)) {
      puzzle[idx] = backup1;
      puzzle[symIdx] = backup2;
    } else {
      remaining -= idx === symIdx ? 1 : 2;
    }
  }

  // If we ended up too easy, try a few extra removals.
  let tries = 0;
  while (remaining > target.min && tries < target.maxTries) {
    tries++;
    const i = order[Math.floor(rng() * 81)];
    if (puzzle[i] === 0) continue;
    const sym = 80 - i;
    const b1 = puzzle[i];
    const b2 = puzzle[sym];
    puzzle[i] = 0;
    if (i !== sym) puzzle[sym] = 0;
    if (!hasUniqueSolution(puzzle)) {
      puzzle[i] = b1;
      puzzle[sym] = b2;
    } else {
      remaining -= i === sym ? 1 : 2;
    }
  }

  const emptyCells = puzzle.filter((v) => v === 0).length;

  return {
    puzzle,
    solution: solved,
    difficulty,
    emptyCells,
    seed: actualSeed,
  };
}
