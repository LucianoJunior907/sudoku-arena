"use client";

import type { Board, Notes } from "./types";
import { indexToRc } from "./types";

/**
 * Render a Sudoku board to a canvas and return a data URL (PNG).
 * Used by the "export as image" feature.
 */
export function boardToDataUrl(
  board: Board,
  notes: Notes,
  given: boolean[],
  options: {
    title?: string;
    subtitle?: string;
    cellSize?: number;
    padding?: number;
    theme?: "light" | "dark";
  } = {}
): string {
  const {
    title,
    subtitle,
    cellSize = 56,
    padding = 24,
    theme = "light",
  } = options;

  const gridSize = cellSize * 9;
  const titleH = title ? 48 : 0;
  const subtitleH = subtitle ? 24 : 0;
  const footerH = 20;
  const width = gridSize + padding * 2;
  const height = gridSize + padding * 2 + titleH + subtitleH + footerH;

  // Create canvas (works in browser only)
  if (typeof document === "undefined") return "";
  const canvas = document.createElement("canvas");
  const dpr = window.devicePixelRatio || 1;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  ctx.scale(dpr, dpr);

  // Colors
  const isDark = theme === "dark";
  const bg = isDark ? "#1a2120" : "#ffffff";
  const fg = isDark ? "#f0f4f3" : "#1a2520";
  const givenColor = isDark ? "#f0f4f3" : "#1a2520";
  const userColor = isDark ? "#5fc9a8" : "#0d9488";
  const noteColor = isDark ? "#94a3a0" : "#64748b";
  const borderThin = isDark ? "#2a3530" : "#e2e8f0";
  const borderThick = isDark ? "#5fc9a8" : "#0d9488";
  const accent = isDark ? "#5fc9a8" : "#0d9488";

  // Background
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  // Title
  let y = padding;
  if (title) {
    ctx.fillStyle = fg;
    ctx.font = "bold 22px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(title, width / 2, y + 16);
    y += titleH;
  }
  if (subtitle) {
    ctx.fillStyle = noteColor;
    ctx.font = "13px system-ui, sans-serif";
    ctx.fillText(subtitle, width / 2, y + 8);
    y += subtitleH;
  }

  const boardY = y;
  const boardX = padding;

  // Thick outer border
  ctx.strokeStyle = borderThick;
  ctx.lineWidth = 3;
  ctx.strokeRect(boardX, boardY, gridSize, gridSize);

  // Cells
  ctx.font = `bold ${Math.round(cellSize * 0.5)}px system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (let i = 0; i < 81; i++) {
    const { row, col } = indexToRc(i);
    const x = boardX + col * cellSize;
    const cy = boardY + row * cellSize;
    const value = board[i];
    const isGiven = given[i];

    // Thin cell border (skip where thick border goes)
    const isRightEdge = col === 8;
    const isBottomEdge = row === 8;
    const isBoxRight = (col + 1) % 3 === 0 && !isRightEdge;
    const isBoxBottom = (row + 1) % 3 === 0 && !isBottomEdge;

    ctx.strokeStyle = borderThin;
    ctx.lineWidth = 1;
    if (!isRightEdge) {
      ctx.beginPath();
      ctx.moveTo(x + cellSize, cy);
      ctx.lineTo(x + cellSize, cy + cellSize);
      ctx.stroke();
    }
    if (!isBottomEdge) {
      ctx.beginPath();
      ctx.moveTo(x, cy + cellSize);
      ctx.lineTo(x + cellSize, cy + cellSize);
      ctx.stroke();
    }
    // Thick box borders
    if (isBoxRight) {
      ctx.strokeStyle = borderThick;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x + cellSize, cy);
      ctx.lineTo(x + cellSize, cy + cellSize);
      ctx.stroke();
      ctx.strokeStyle = borderThin;
      ctx.lineWidth = 1;
    }
    if (isBoxBottom) {
      ctx.strokeStyle = borderThick;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, cy + cellSize);
      ctx.lineTo(x + cellSize, cy + cellSize);
      ctx.stroke();
      ctx.strokeStyle = borderThin;
      ctx.lineWidth = 1;
    }

    // Value or notes
    if (value !== 0) {
      ctx.fillStyle = isGiven ? givenColor : userColor;
      ctx.fillText(String(value), x + cellSize / 2, cy + cellSize / 2);
    } else if (notes[i].length > 0) {
      ctx.fillStyle = noteColor;
      ctx.font = `${Math.round(cellSize * 0.18)}px system-ui, sans-serif`;
      for (const n of notes[i]) {
        const nr = Math.floor((n - 1) / 3);
        const nc = (n - 1) % 3;
        ctx.fillText(
          String(n),
          x + (nc + 0.5) * (cellSize / 3),
          cy + (nr + 0.5) * (cellSize / 3)
        );
      }
      ctx.font = `bold ${Math.round(cellSize * 0.5)}px system-ui, sans-serif`;
    }
  }

  // Footer
  ctx.fillStyle = accent;
  ctx.font = "11px system-ui, sans-serif";
  ctx.textAlign = "right";
  ctx.fillText("Sudoku Arena", width - padding, height - 8);

  return canvas.toDataURL("image/png");
}

/** Trigger a download of the board image. */
export function downloadBoardImage(
  board: Board,
  notes: Notes,
  given: boolean[],
  options: {
    title?: string;
    subtitle?: string;
    theme?: "light" | "dark";
    filename?: string;
  } = {}
): void {
  const dataUrl = boardToDataUrl(board, notes, given, options);
  if (!dataUrl) return;
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = options.filename ?? `sudoku-${Date.now()}.png`;
  a.click();
}

/** Copy the board image to the clipboard (async). */
export async function copyBoardImage(
  board: Board,
  notes: Notes,
  given: boolean[],
  options: {
    title?: string;
    subtitle?: string;
    theme?: "light" | "dark";
  } = {}
): Promise<boolean> {
  const dataUrl = boardToDataUrl(board, notes, given, options);
  if (!dataUrl) return false;
  try {
    const blob = await (await fetch(dataUrl)).blob();
    await navigator.clipboard.write([
      new ClipboardItem({ "image/png": blob }),
    ]);
    return true;
  } catch {
    return false;
  }
}
