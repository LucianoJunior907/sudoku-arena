import type { Board, Notes } from "./types";
import { PEERS, BOX_INDEX } from "./types";

export interface SolverSuggestion {
  index: number;
  value: number;
  technique: "naked-single" | "hidden-single" | "naked-single-in-block" | "solver";
  reason: string;
}

/**
 * Analyze the current board + notes and suggest the next logical move.
 *
 * Priority:
 * 1. Naked Single — a cell with only one candidate.
 * 2. Hidden Single — a digit that can only go in one cell within a unit.
 * 3. Fallback: solver-derived move (backtracking finds the next cell to fill).
 *
 * Returns null if the board is complete or unsolvable.
 */
export function suggestNextMove(board: Board, notes: Notes, solution: Board): SolverSuggestion | null {
  // Check for naked singles (cells with exactly one candidate).
  for (let i = 0; i < 81; i++) {
    if (board[i] !== 0) continue;
    const cands = candidatesFor(board, i);
    if (cands.length === 1) {
      return {
        index: i,
        value: cands[0],
        technique: "naked-single",
        reason: `Cell has only one possible candidate: ${cands[0]}. All other digits 1-9 are already present in its row, column, or box.`,
      };
    }
  }

  // Check for hidden singles in rows, columns, and boxes.
  // For each unit, for each missing digit, count how many cells can take it.
  const hidden = findHiddenSingle(board);
  if (hidden) return hidden;

  // Fallback: use the solution to suggest a move (least-revealing approach).
  // Pick the empty cell with the fewest candidates (MRV) and suggest its solution value.
  let bestIdx = -1;
  let bestCands: number[] = [];
  let bestCount = 10;
  for (let i = 0; i < 81; i++) {
    if (board[i] !== 0) continue;
    const cands = candidatesFor(board, i);
    if (cands.length < bestCount) {
      bestCount = cands.length;
      bestIdx = i;
      bestCands = cands;
      if (bestCount === 0) break;
    }
  }
  if (bestIdx === -1) return null;
  return {
    index: bestIdx,
    value: solution[bestIdx],
    technique: "solver",
    reason: `No obvious single found. The solver suggests placing ${solution[bestIdx]} here (candidates: ${bestCands.join(", ") || "none"}).`,
  };
}

function candidatesFor(board: Board, index: number): number[] {
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

function findHiddenSingle(board: Board): SolverSuggestion | null {
  // Check rows
  for (let row = 0; row < 9; row++) {
    const cells = Array.from({ length: 9 }, (_, c) => row * 9 + c);
    const result = checkUnitForHiddenSingle(board, cells, "row", row);
    if (result) return result;
  }
  // Check columns
  for (let col = 0; col < 9; col++) {
    const cells = Array.from({ length: 9 }, (_, r) => r * 9 + col);
    const result = checkUnitForHiddenSingle(board, cells, "column", col);
    if (result) return result;
  }
  // Check boxes
  for (let b = 0; b < 9; b++) {
    const result = checkUnitForHiddenSingle(board, BOX_INDEX[b], "box", b);
    if (result) return result;
  }
  return null;
}

function checkUnitForHiddenSingle(
  board: Board,
  cells: number[],
  unitType: string,
  unitIdx: number
): SolverSuggestion | null {
  // For each digit 1-9, find which empty cells in this unit can take it.
  for (let digit = 1; digit <= 9; digit++) {
    // Is this digit already in the unit?
    const alreadyPresent = cells.some((c) => board[c] === digit);
    if (alreadyPresent) continue;

    const possibleCells: number[] = [];
    for (const c of cells) {
      if (board[c] !== 0) continue;
      const cands = candidatesFor(board, c);
      if (cands.includes(digit)) possibleCells.push(c);
    }

    if (possibleCells.length === 1) {
      const unitName = unitType === "box" ? `box ${unitIdx + 1}` : `${unitType} ${unitIdx + 1}`;
      return {
        index: possibleCells[0],
        value: digit,
        technique: "hidden-single",
        reason: `Digit ${digit} can only go in one cell within ${unitName} — it's a hidden single.`,
      };
    }
  }
  return null;
}
