import type { Difficulty } from "@/lib/sudoku/types";

/* ------------------------------------------------------------------ */
/* XP & Levels                                                         */
/* ------------------------------------------------------------------ */

/** XP required to go from `level` to `level+1`. */
export function xpForLevel(level: number): number {
  return 100 + level * 50;
}

/** Returns { level, intoLevel, neededForLevel } from total XP. */
export function levelFromXp(totalXp: number): {
  level: number;
  intoLevel: number;
  neededForLevel: number;
} {
  let remaining = totalXp;
  let level = 1;
  while (remaining >= xpForLevel(level)) {
    remaining -= xpForLevel(level);
    level++;
  }
  return { level, intoLevel: remaining, neededForLevel: xpForLevel(level) };
}

/** Difficulty XP multipliers. Competitive modes (duo/ranked) will reward
 *  more once online — this is the relative weighting described in spec §8. */
export const DIFFICULTY_XP_MULTIPLIER: Record<Difficulty, number> = {
  easy: 1,
  medium: 1.5,
  hard: 2,
  expert: 2.8,
};

export const MODE_XP_MULTIPLIER: Record<GameMode, number> = {
  solo: 1,
  daily: 1.2,
  guide: 0.3, // practice from guide gives a small reward
  duo: 1.8, // higher relative reward (spec §8)
  ranked: 2.2,
};

export type GameMode = "solo" | "daily" | "duo" | "ranked" | "guide";

export interface XpInput {
  mode: GameMode;
  difficulty: Difficulty;
  elapsedSec: number;
  errors: number;
  hintsUsed: number;
  completed: boolean;
}

/** Compute the XP earned for a finished game. Pure function. */
export function computeXp(input: XpInput): number {
  if (!input.completed) return 5; // participation XP
  const base = 60;
  const diffMult = DIFFICULTY_XP_MULTIPLIER[input.difficulty];
  const modeMult = MODE_XP_MULTIPLIER[input.mode];
  // Time bonus: faster = more, decays gently. Reference time scales with difficulty.
  const referenceSec = { easy: 6 * 60, medium: 12 * 60, hard: 20 * 60, expert: 30 * 60 }[input.difficulty];
  const timeFactor = Math.max(0.5, Math.min(2, referenceSec / Math.max(input.elapsedSec, 30)));
  const errorPenalty = input.errors * 8;
  const hintPenalty = input.hintsUsed * 10;
  const raw = base * diffMult * modeMult * timeFactor - errorPenalty - hintPenalty;
  return Math.max(15, Math.round(raw));
}

/* ------------------------------------------------------------------ */
/* Daily challenge scoring                                             */
/* ------------------------------------------------------------------ */

export function computeDailyScore(input: Omit<XpInput, "mode">): number {
  const xp = computeXp({ ...input, mode: "daily" });
  // Score is a scaled, friendlier number for the leaderboard illusion.
  return Math.round(xp * 8 + (input.completed ? 500 : 0));
}

/* ------------------------------------------------------------------ */
/* Cosmetics                                                           */
/* ------------------------------------------------------------------ */

export interface Cosmetic {
  id: string;
  type: "frame" | "title" | "effect";
  name: string;
  nameEn: string;
  unlockLevel: number;
  /** Tailwind gradient classes for preview. */
  preview: string;
}

export const COSMETICS: Cosmetic[] = [
  // Frames
  { id: "frame-default", type: "frame", name: "Padrão", nameEn: "Default", unlockLevel: 1, preview: "ring-2 ring-border" },
  { id: "frame-emerald", type: "frame", name: "Esmeralda", nameEn: "Emerald", unlockLevel: 2, preview: "ring-2 ring-primary" },
  { id: "frame-amber", type: "frame", name: "Âmbar", nameEn: "Amber", unlockLevel: 4, preview: "ring-2 ring-[var(--warning)]" },
  { id: "frame-rose", type: "frame", name: "Rosa", nameEn: "Rose", unlockLevel: 6, preview: "ring-2 ring-[var(--destructive)]" },
  { id: "frame-aurora", type: "frame", name: "Aurora", nameEn: "Aurora", unlockLevel: 9, preview: "ring-2 ring-primary via-[var(--chart-4)]" },
  { id: "frame-gold", type: "frame", name: "Ouro Mestre", nameEn: "Master Gold", unlockLevel: 15, preview: "ring-4 ring-[var(--warning)]" },
  // Titles
  { id: "title-novice", type: "title", name: "Novato", nameEn: "Novice", unlockLevel: 1, preview: "" },
  { id: "title-explorer", type: "title", name: "Explorador", nameEn: "Explorer", unlockLevel: 3, preview: "" },
  { id: "title-strategist", type: "title", name: "Estrategista", nameEn: "Strategist", unlockLevel: 5, preview: "" },
  { id: "title-tactician", type: "title", name: "Tático", nameEn: "Tactician", unlockLevel: 8, preview: "" },
  { id: "title-master", type: "title", name: "Mestre", nameEn: "Master", unlockLevel: 12, preview: "" },
  { id: "title-grandmaster", type: "title", name: "Grão-Mestre", nameEn: "Grandmaster", unlockLevel: 18, preview: "" },
  // Effects
  { id: "effect-none", type: "effect", name: "Nenhum", nameEn: "None", unlockLevel: 1, preview: "" },
  { id: "effect-glow", type: "effect", name: "Brilho", nameEn: "Glow", unlockLevel: 4, preview: "text-glow" },
  { id: "effect-confetti", type: "effect", name: "Confete", nameEn: "Confetti", unlockLevel: 7, preview: "" },
  { id: "effect-aurora", type: "effect", name: "Aurora", nameEn: "Aurora", unlockLevel: 10, preview: "text-glow" },
];

export function unlockedCosmeticsForLevel(level: number): Cosmetic[] {
  return COSMETICS.filter((c) => c.unlockLevel <= level);
}

export function isCosmeticUnlocked(c: Cosmetic, level: number): boolean {
  return level >= c.unlockLevel;
}

/* ------------------------------------------------------------------ */
/* Divisions (Ranked) — local preview only                            */
/* ------------------------------------------------------------------ */

export const DIVISIONS = [
  { id: "bronze", min: 0, color: "oklch(0.62 0.06 60)" },
  { id: "silver", min: 800, color: "oklch(0.7 0.02 270)" },
  { id: "gold", min: 1600, color: "oklch(0.78 0.14 85)" },
  { id: "platinum", min: 2400, color: "oklch(0.72 0.1 195)" },
  { id: "diamond", min: 3200, color: "oklch(0.72 0.14 300)" },
  { id: "master", min: 4000, color: "oklch(0.6 0.14 168)" },
  { id: "grandmaster", min: 5000, color: "oklch(0.55 0.22 25)" },
] as const;

export type DivisionId = (typeof DIVISIONS)[number]["id"];

export function divisionForRating(rating: number): (typeof DIVISIONS)[number] {
  let current = DIVISIONS[0];
  for (const d of DIVISIONS) {
    if (rating >= d.min) current = d;
  }
  return current;
}
