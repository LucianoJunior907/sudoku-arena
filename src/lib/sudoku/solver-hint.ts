import type { Board, Notes } from "./types";
import { PEERS, BOX_INDEX } from "./types";

export interface SolverSuggestion {
  index: number;
  value: number;
  technique: "naked-single" | "hidden-single" | "naked-single-in-block" | "naked-pair" | "solver";
  reason: string;
}

/**
 * Analyze the current board + notes and suggest the next logical move.
 *
 * Priority:
 * 1. Naked Single — a cell with only one candidate.
 * 2. Hidden Single — a digit that can only go in one cell within a unit.
 * 3. Naked Pair — two cells in a unit with the same two candidates; eliminating
 *    those candidates from other cells in the unit may create a naked single.
 * 4. Fallback: solver-derived move (backtracking finds the next cell to fill).
 *
 * Returns null if the board is complete or unsolvable.
 */
export function suggestNextMove(board: Board, notes: Notes, solution: Board): SolverSuggestion | null {
  // 1. Check for naked singles (cells with exactly one candidate).
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

  // 2. Check for hidden singles in rows, columns, and boxes.
  const hidden = findHiddenSingle(board);
  if (hidden) return hidden;

  // 3. Check for naked pairs that create a naked single after elimination.
  const nakedPair = findNakedPairElimination(board);
  if (nakedPair) return nakedPair;

  // 4. Fallback: use the solution to suggest a move (least-revealing approach).
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

export function candidatesFor(board: Board, index: number): number[] {
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
  for (let row = 0; row < 9; row++) {
    const cells = Array.from({ length: 9 }, (_, c) => row * 9 + c);
    const result = checkUnitForHiddenSingle(board, cells, "row", row);
    if (result) return result;
  }
  for (let col = 0; col < 9; col++) {
    const cells = Array.from({ length: 9 }, (_, r) => r * 9 + col);
    const result = checkUnitForHiddenSingle(board, cells, "column", col);
    if (result) return result;
  }
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
  for (let digit = 1; digit <= 9; digit++) {
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

/**
 * Find a naked pair (two cells in a unit with the same exactly-two candidates)
 * that, when eliminated from peers, creates a naked single in the same unit.
 */
function findNakedPairElimination(board: Board): SolverSuggestion | null {
  const units: { cells: number[]; name: string }[] = [];
  for (let row = 0; row < 9; row++) {
    units.push({ cells: Array.from({ length: 9 }, (_, c) => row * 9 + c), name: `row ${row + 1}` });
  }
  for (let col = 0; col < 9; col++) {
    units.push({ cells: Array.from({ length: 9 }, (_, r) => r * 9 + col), name: `column ${col + 1}` });
  }
  for (let b = 0; b < 9; b++) {
    units.push({ cells: BOX_INDEX[b], name: `box ${b + 1}` });
  }

  for (const unit of units) {
    // Find cells with exactly 2 candidates in this unit
    const pairs: { idx: number; cands: number[] }[] = [];
    for (const c of unit.cells) {
      if (board[c] !== 0) continue;
      const cands = candidatesFor(board, c);
      if (cands.length === 2) pairs.push({ idx: c, cands });
    }

    // Check all pairs of pairs for matching candidates
    for (let i = 0; i < pairs.length; i++) {
      for (let j = i + 1; j < pairs.length; j++) {
        if (
          pairs[i].cands[0] === pairs[j].cands[0] &&
          pairs[i].cands[1] === pairs[j].cands[1]
        ) {
          // Found a naked pair! Check if eliminating these candidates from
          // other cells in the unit creates a naked single.
          const [d1, d2] = pairs[i].cands;
          for (const c of unit.cells) {
            if (c === pairs[i].idx || c === pairs[j].idx || board[c] !== 0) continue;
            const cands = candidatesFor(board, c);
            const filtered = cands.filter((x) => x !== d1 && x !== d2);
            if (filtered.length === 1) {
              // This cell becomes a naked single after elimination!
              return {
                index: c,
                value: filtered[0],
                technique: "naked-pair",
                reason: `Naked pair {${d1}, ${d2}} in ${unit.name} eliminates candidates ${d1} and ${d2} from this cell, leaving only ${filtered[0]} as a naked single.`,
              };
            }
          }
        }
      }
    }
  }
  return null;
}
