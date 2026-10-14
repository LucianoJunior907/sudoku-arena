import type { Difficulty } from "@/lib/sudoku/types";
import type { GameMode } from "./progression";
import type { StatsByMode } from "@/lib/store/app-store";
import type { LucideIcon } from "lucide-react";
import {
  Trophy,
  ShieldCheck,
  Lightbulb,
  Gauge,
  Flame,
  Star,
  Crown,
  Target,
  Brain,
  Medal,
} from "lucide-react";

export interface Achievement {
  id: string;
  name: { "pt-BR": string; en: string };
  desc: { "pt-BR": string; en: string };
  icon: LucideIcon;
  xpReward: number;
  /** category for grouping */
  category: "solo" | "daily" | "level" | "skill";
  check: (ctx: AchievementContext) => boolean;
}

export interface AchievementContext {
  stats: StatsByMode;
  level: number;
  streakCount: number;
  lastGame: {
    mode: GameMode;
    difficulty: Difficulty;
    elapsedSec: number;
    errors: number;
    hintsUsed: number;
    completed: boolean;
  } | null;
}

export const ACHIEVEMENTS: Achievement[] = [
  {
    id: "first_win",
    name: { "pt-BR": "Primeira Vitória", en: "First Victory" },
    desc: { "pt-BR": "Vença sua primeira partida Solo.", en: "Win your first Solo game." },
    icon: Trophy,
    xpReward: 50,
    category: "solo",
    check: (c) => soloWins(c) >= 1,
  },
  {
    id: "wins_10",
    name: { "pt-BR": "Dezena", en: "Decathlon" },
    desc: { "pt-BR": "Vença 10 partidas Solo.", en: "Win 10 Solo games." },
    icon: Medal,
    xpReward: 100,
    category: "solo",
    check: (c) => soloWins(c) >= 10,
  },
  {
    id: "wins_50",
    name: { "pt-BR": "Meio Centenário", en: "Half Century" },
    desc: { "pt-BR": "Vença 50 partidas Solo.", en: "Win 50 Solo games." },
    icon: Medal,
    xpReward: 250,
    category: "solo",
    check: (c) => soloWins(c) >= 50,
  },
  {
    id: "flawless",
    name: { "pt-BR": "Impecável", en: "Flawless" },
    desc: { "pt-BR": "Vença uma partida sem erros.", en: "Win a game with 0 mistakes." },
    icon: ShieldCheck,
    xpReward: 150,
    category: "skill",
    check: (c) => !!c.lastGame?.completed && c.lastGame.errors === 0,
  },
  {
    id: "no_hints",
    name: { "pt-BR": "Autossuficiente", en: "Self-Made" },
    desc: { "pt-BR": "Vença sem usar dicas.", en: "Win without using hints." },
    icon: Lightbulb,
    xpReward: 100,
    category: "skill",
    check: (c) => !!c.lastGame?.completed && c.lastGame.hintsUsed === 0,
  },
  {
    id: "speed_easy",
    name: { "pt-BR": "Velocista", en: "Sprinter" },
    desc: { "pt-BR": "Vença um Fácil em menos de 5 min.", en: "Win an Easy game under 5 min." },
    icon: Gauge,
    xpReward: 100,
    category: "skill",
    check: (c) =>
      !!c.lastGame?.completed &&
      c.lastGame.difficulty === "easy" &&
      c.lastGame.elapsedSec < 300,
  },
  {
    id: "speed_medium",
    name: { "pt-BR": "Rápido Pensador", en: "Quick Thinker" },
    desc: { "pt-BR": "Vença um Médio em menos de 10 min.", en: "Win a Medium game under 10 min." },
    icon: Gauge,
    xpReward: 150,
    category: "skill",
    check: (c) =>
      !!c.lastGame?.completed &&
      c.lastGame.difficulty === "medium" &&
      c.lastGame.elapsedSec < 600,
  },
  {
    id: "expert_win",
    name: { "pt-BR": "Mente Mestra", en: "Mastermind" },
    desc: { "pt-BR": "Vença um jogo Especialista.", en: "Win an Expert game." },
    icon: Brain,
    xpReward: 200,
    category: "solo",
    check: (c) => c.stats.solo.expert.wins >= 1,
  },
  {
    id: "all_difficulties",
    name: { "pt-BR": "Versátil", en: "All-Rounder" },
    desc: { "pt-BR": "Vença nas 4 dificuldades.", en: "Win on all 4 difficulties." },
    icon: Target,
    xpReward: 200,
    category: "solo",
    check: (c) =>
      c.stats.solo.easy.wins >= 1 &&
      c.stats.solo.medium.wins >= 1 &&
      c.stats.solo.hard.wins >= 1 &&
      c.stats.solo.expert.wins >= 1,
  },
  {
    id: "daily_streak_3",
    name: { "pt-BR": "Hábito Formando", en: "Habit Forming" },
    desc: { "pt-BR": "Sequência diária de 3 dias.", en: "3-day daily streak." },
    icon: Flame,
    xpReward: 75,
    category: "daily",
    check: (c) => c.streakCount >= 3,
  },
  {
    id: "daily_streak_7",
    name: { "pt-BR": "Guerreiro Semanal", en: "Weekly Warrior" },
    desc: { "pt-BR": "Sequência diária de 7 dias.", en: "7-day daily streak." },
    icon: Flame,
    xpReward: 150,
    category: "daily",
    check: (c) => c.streakCount >= 7,
  },
  {
    id: "daily_streak_30",
    name: { "pt-BR": "Devoção Mensal", en: "Monthly Devotion" },
    desc: { "pt-BR": "Sequência diária de 30 dias.", en: "30-day daily streak." },
    icon: Flame,
    xpReward: 400,
    category: "daily",
    check: (c) => c.streakCount >= 30,
  },
  {
    id: "level_5",
    name: { "pt-BR": "Estrela em Ascensão", en: "Rising Star" },
    desc: { "pt-BR": "Alcance o nível 5.", en: "Reach level 5." },
    icon: Star,
    xpReward: 100,
    category: "level",
    check: (c) => c.level >= 5,
  },
  {
    id: "level_10",
    name: { "pt-BR": "Dedicado", en: "Dedicated" },
    desc: { "pt-BR": "Alcance o nível 10.", en: "Reach level 10." },
    icon: Star,
    xpReward: 200,
    category: "level",
    check: (c) => c.level >= 10,
  },
  {
    id: "level_20",
    name: { "pt-BR": "Lenda do Sudoku", en: "Sudoku Legend" },
    desc: { "pt-BR": "Alcance o nível 20.", en: "Reach level 20." },
    icon: Crown,
    xpReward: 500,
    category: "level",
    check: (c) => c.level >= 20,
  },
];

function soloWins(c: AchievementContext): number {
  return (
    c.stats.solo.easy.wins +
    c.stats.solo.medium.wins +
    c.stats.solo.hard.wins +
    c.stats.solo.expert.wins
  );
}

/** Returns the ids of achievements that are now satisfied, given the set
 *  of already-unlocked ids. Pure function. */
export function evaluateAchievements(
  ctx: AchievementContext,
  alreadyUnlocked: string[]
): string[] {
  const set = new Set(alreadyUnlocked);
  const newly: string[] = [];
  for (const a of ACHIEVEMENTS) {
    if (set.has(a.id)) continue;
    try {
      if (a.check(ctx)) newly.push(a.id);
    } catch {
      // ignore failing conditions
    }
  }
  return newly;
}

export function totalAchievementXp(): number {
  return ACHIEVEMENTS.reduce((sum, a) => sum + a.xpReward, 0);
}
