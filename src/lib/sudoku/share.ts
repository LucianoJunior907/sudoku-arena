"use client";

import type { Board, Difficulty } from "@/lib/sudoku/types";

/**
 * Share-code format for Sudoku boards.
 *
 * Encodes a puzzle (81 cells, 0-9) + difficulty into a compact, URL-safe
 * string. Each digit (0-9) is one base-10 char, so the board is 81 chars.
 * A prefix `SA1:` (Sudoku Arena v1) + difficulty char + board = 86 chars.
 *
 * This is a LOCAL sharing mechanism — no server. Two players on the same
 * app version can exchange codes and play the same puzzle.
 */

const PREFIX = "SA1";
const DIFF_CHAR: Record<Difficulty, string> = {
  easy: "E",
  medium: "M",
  hard: "H",
  expert: "X",
};
const DIFF_FROM_CHAR: Record<string, Difficulty> = {
  E: "easy",
  M: "medium",
  H: "hard",
  X: "expert",
};

/** Encode a puzzle board + difficulty into a share code. */
export function encodeBoard(puzzle: Board, difficulty: Difficulty): string {
  const body = puzzle.map((v) => String(v)).join("");
  return `${PREFIX}${DIFF_CHAR[difficulty]}${body}`;
}

/** Decode a share code back into { puzzle, difficulty }. Returns null if invalid. */
export function decodeBoard(code: string): { puzzle: Board; difficulty: Difficulty } | null {
  const trimmed = code.trim().toUpperCase();
  if (!trimmed.startsWith(PREFIX)) return null;
  const rest = trimmed.slice(PREFIX.length);
  if (rest.length < 82) return null;
  const diffChar = rest[0];
  const difficulty = DIFF_FROM_CHAR[diffChar];
  if (!difficulty) return null;
  const body = rest.slice(1, 82);
  const puzzle: Board = [];
  for (let i = 0; i < 81; i++) {
    const c = body[i];
    if (c === undefined) return null;
    const d = Number(c);
    if (Number.isNaN(d) || d < 0 || d > 9) return null;
    puzzle.push(d);
  }
  return { puzzle, difficulty };
}

/** Build a shareable URL containing the code (uses hash fragment, no server needed). */
export function buildShareUrl(code: string): string {
  if (typeof window === "undefined") return "";
  const base = window.location.origin + window.location.pathname;
  return `${base}#s=${code}`;
}

/** Read a share code from the current URL hash, if present. */
export function readShareFromUrl(): string | null {
  if (typeof window === "undefined") return null;
  const hash = window.location.hash;
  const match = hash.match(/[#&]s=([^&]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

/** Clear the share param from the URL hash. */
export function clearShareFromUrl(): void {
  if (typeof window === "undefined") return;
  if (window.location.hash.includes("s=")) {
    history.replaceState(null, "", window.location.pathname + window.location.search);
  }
}
