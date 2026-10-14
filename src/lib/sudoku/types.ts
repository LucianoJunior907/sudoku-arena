export type Difficulty = "easy" | "medium" | "hard" | "expert";

export type CellValue = number; // 0 = empty, 1..9 = value

/** A flat 81-length representation of the board, 0 for empty. */
export type Board = CellValue[]; // length 81

export type Notes = number[][]; // length 81, each inner array is a list of candidate digits (1..9)

export interface GeneratedPuzzle {
  /** The puzzle with givens, 0 for empty cells. */
  puzzle: Board;
  /** The full solution. */
  solution: Board;
  /** Difficulty that was targeted. */
  difficulty: Difficulty;
  /** Number of empty cells. */
  emptyCells: number;
  /** Stable seed used to generate this puzzle. */
  seed: string;
}

export interface CellCoord {
  row: number; // 0..8
  col: number; // 0..8
}

export const BOX_INDEX: number[][] = (() => {
  const out: number[][] = Array.from({ length: 9 }, () => []);
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const b = Math.floor(r / 3) * 3 + Math.floor(c / 3);
      out[b].push(r * 9 + c);
    }
  }
  return out;
})();

export const PEERS: number[][] = (() => {
  const out: number[][] = Array.from({ length: 81 }, () => []);
  for (let i = 0; i < 81; i++) {
    const r = Math.floor(i / 9);
    const c = i % 9;
    const b = Math.floor(r / 3) * 3 + Math.floor(c / 3);
    const set = new Set<number>();
    for (let k = 0; k < 9; k++) {
      set.add(r * 9 + k); // row
      set.add(k * 9 + c); // col
      set.add(BOX_INDEX[b][k]); // box
    }
    set.delete(i);
    out[i] = Array.from(set);
  }
  return out;
})();

export function rcToIndex(row: number, col: number): number {
  return row * 9 + col;
}

export function indexToRc(index: number): CellCoord {
  return { row: Math.floor(index / 9), col: index % 9 };
}

export function emptyBoard(): Board {
  return new Array(81).fill(0);
}

export function cloneBoard(board: Board): Board {
  return board.slice();
}

export function cloneNotes(notes: Notes): Notes {
  return notes.map((n) => n.slice());
}
