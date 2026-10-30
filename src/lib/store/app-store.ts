"use client";

import { create } from "zustand";
import { localPersistence } from "@/lib/persistence/local-storage";
import type { Locale } from "@/lib/i18n/translations";
import type { Difficulty } from "@/lib/sudoku/types";
import {
  COSMETICS,
  levelFromXp,
  unlockedCosmeticsForLevel,
  computeXp,
  type GameMode,
} from "@/lib/progression/progression";
import { ACHIEVEMENTS, evaluateAchievements, type AchievementContext } from "@/lib/progression/achievements";
import type { Division } from "@/lib/contracts/persistence";
import { toast as sonnerToast } from "sonner";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export type RouteId =
  | "lobby"
  | "solo"
  | "duo"
  | "ranked"
  | "guide"
  | "daily"
  | "profile"
  | "friends"
  | "history"
  | "leaderboard"
  | "achievements"
  | "overview"
  | "records"
  | "archive"
  | "settings";

export type ThemePref = "light" | "dark" | "system";

export interface AppSettings {
  locale: Locale;
  theme: ThemePref;
  autoCheck: boolean;
  highlightPeers: boolean;
  highlightSame: boolean;
  showTimer: boolean;
  showCandidateCount: boolean;
  maxErrors: number; // 0 = unlimited
  maxHints: number;
  soundEnabled: boolean;
  boardTheme: string; // BoardThemeId
}

export interface LocalProfile {
  displayName: string;
  avatarSeed: string;
  titleId: string | null;
  frameId: string;
  effectId: string;
  totalXp: number;
  // local-only rating preview (not official)
  rating: number;
  createdAt: string;
  streakFreezes: number; // consumable: protects daily streak on a missed day
}

export interface ModeStat {
  played: number;
  wins: number;
  bestTimeSec: number | null;
  totalTimeSec: number;
}

export type StatsByDifficulty = Record<Difficulty, ModeStat>;

export interface StatsByMode {
  solo: StatsByDifficulty;
  daily: StatsByDifficulty;
  duo: StatsByDifficulty;
  ranked: StatsByDifficulty;
  guide: StatsByDifficulty;
}

export interface HistoryEntry {
  id: string;
  mode: GameMode;
  difficulty: Difficulty;
  elapsedSec: number;
  errors: number;
  hintsUsed: number;
  completed: boolean;
  xp: number;
  date: string; // ISO
  isRecord: boolean;
}

export interface DailyRecord {
  date: string; // YYYY-MM-DD
  difficulty: Difficulty;
  completed: boolean;
  elapsedSec: number;
  errors: number;
  score: number;
  xp: number;
}

export interface LevelUpEvent {
  id: string;
  newLevel: number;
  unlockedCosmeticIds: string[];
  streakFreezesEarned?: number;
  createdAt: number;
}

export interface OnboardingState {
  completed: boolean;
  tourSeen: boolean;
}

/* ------------------------------------------------------------------ */
/* Defaults                                                            */
/* ------------------------------------------------------------------ */

const DEFAULT_SETTINGS: AppSettings = {
  locale: "pt-BR",
  theme: "system",
  autoCheck: true,
  highlightPeers: true,
  highlightSame: true,
  showTimer: true,
  showCandidateCount: false,
  maxErrors: 5,
  maxHints: 3,
  soundEnabled: true,
  boardTheme: "emerald",
};

function emptyDifficultyStats(): ModeStat {
  return { played: 0, wins: 0, bestTimeSec: null, totalTimeSec: 0 };
}

function emptyStatsByDifficulty(): StatsByDifficulty {
  return {
    easy: emptyDifficultyStats(),
    medium: emptyDifficultyStats(),
    hard: emptyDifficultyStats(),
    expert: emptyDifficultyStats(),
  };
}

function emptyStats(): StatsByMode {
  return {
    solo: emptyStatsByDifficulty(),
    daily: emptyStatsByDifficulty(),
    duo: emptyStatsByDifficulty(),
    ranked: emptyStatsByDifficulty(),
    guide: emptyStatsByDifficulty(),
  };
}

function defaultProfile(): LocalProfile {
  return {
    displayName: "",
    avatarSeed: "arena-" + Math.random().toString(36).slice(2, 8),
    titleId: null,
    frameId: "frame-default",
    effectId: "effect-none",
    totalXp: 0,
    rating: 0,
    createdAt: new Date().toISOString(),
    streakFreezes: 0,
  };
}

/* ------------------------------------------------------------------ */
/* Store                                                               */
/* ------------------------------------------------------------------ */

const KEYS = {
  settings: "settings",
  profile: "profile",
  stats: "stats",
  history: "history",
  daily: "daily-records",
  onboarding: "onboarding",
  savedGame: "saved-game",
  streak: "streak",
  achievements: "achievements",
};

export interface AchievementToast {
  id: string;
  achievementId: string;
  xpReward: number;
  createdAt: number;
}

export interface PracticeBoard {
  puzzle: number[];
  solution: number[];
  notes: number[][];
  difficulty: Difficulty;
  seed: string;
}

interface AppState {
  // navigation
  route: RouteId;
  setRoute: (r: RouteId) => void;
  // Active ranked match — when set, AppShell intercepts navigation
  activeRankedMatchId: string | null;
  setActiveRankedMatch: (id: string | null) => void;

  // settings
  settings: AppSettings;
  hydrated: boolean;
  setSettings: (patch: Partial<AppSettings>) => void;

  // onboarding
  onboarding: OnboardingState;
  completeOnboarding: (locale: Locale) => void;
  completeTour: () => void;
  resetTour: () => void;

  // profile
  profile: LocalProfile;
  updateProfile: (patch: Partial<LocalProfile>) => void;

  // stats
  stats: StatsByMode;

  // history
  history: HistoryEntry[];

  // daily
  dailyRecords: DailyRecord[];

  // streak
  streak: { count: number; lastDate: string | null };

  // level up events (transient queue)
  levelUps: LevelUpEvent[];
  dismissLevelUp: (id: string) => void;

  // achievements
  unlockedAchievements: string[];
  achievementToasts: AchievementToast[];
  dismissAchievementToast: (id: string) => void;
  checkAchievements: (lastGame: RecordGameInput) => { newlyUnlocked: string[]; bonusXp: number };

  // practice board (transient — set by Guide, consumed by Solo on mount)
  practiceBoard: PracticeBoard | null;
  setPracticeBoard: (b: PracticeBoard | null) => void;

  // derived
  level: number;

  // actions
  hydrate: () => void;
  recordGame: (input: RecordGameInput) => RecordGameResult;
  recordDaily: (input: RecordDailyInput) => void;
  clearAllData: () => void;
  exportData: () => string;
  importData: (json: string) => boolean;
  getSavedGame: <T = unknown>() => T | null;
  setSavedGame: <T = unknown>(game: T | null) => void;
}

export interface RecordGameInput {
  mode: GameMode;
  difficulty: Difficulty;
  elapsedSec: number;
  errors: number;
  hintsUsed: number;
  completed: boolean;
}

export interface RecordGameResult {
  xp: number;
  leveledUp: boolean;
  newLevel: number;
  unlockedCosmeticIds: string[];
  isRecord: boolean;
}

export interface RecordDailyInput extends RecordGameInput {
  date: string;
  score: number;
}

function computeXpSafe(input: RecordGameInput): number {
  return computeXp({
    mode: input.mode,
    difficulty: input.difficulty,
    elapsedSec: input.elapsedSec,
    errors: input.errors,
    hintsUsed: input.hintsUsed,
    completed: input.completed,
  });
}

export const useAppStore = create<AppState>((set, get) => ({
  route: "lobby",
  setRoute: (r) => set({ route: r }),

  // Active ranked match tracking — when set, navigation is intercepted
  // (AppShell shows an abandon modal instead of navigating away).
  activeRankedMatchId: null as string | null,
  setActiveRankedMatch: (id: string | null) => set({ activeRankedMatchId: id }),

  settings: DEFAULT_SETTINGS,
  hydrated: false,
  setSettings: (patch) => {
    const next = { ...get().settings, ...patch };
    localPersistence.set(KEYS.settings, next);
    set({ settings: next });
  },

  onboarding: { completed: false, tourSeen: false },
  completeOnboarding: (locale) => {
    const onboarding = { completed: true, tourSeen: false };
    const settings = { ...get().settings, locale };
    localPersistence.set(KEYS.onboarding, onboarding);
    localPersistence.set(KEYS.settings, settings);
    set({ onboarding, settings });
  },
  completeTour: () => {
    const onboarding = { ...get().onboarding, tourSeen: true };
    localPersistence.set(KEYS.onboarding, onboarding);
    set({ onboarding });
  },
  resetTour: () => {
    const onboarding = { ...get().onboarding, tourSeen: false };
    localPersistence.set(KEYS.onboarding, onboarding);
    set({ onboarding });
  },

  profile: defaultProfile(),
  updateProfile: (patch) => {
    const next = { ...get().profile, ...patch };
    localPersistence.set(KEYS.profile, next);
    set({ profile: next });
  },

  stats: emptyStats(),
  history: [],
  dailyRecords: [],
  streak: { count: 0, lastDate: null },
  levelUps: [],
  dismissLevelUp: (id) => set({ levelUps: get().levelUps.filter((l) => l.id !== id) }),
  unlockedAchievements: [],
  achievementToasts: [],
  dismissAchievementToast: (id) =>
    set({ achievementToasts: get().achievementToasts.filter((a) => a.id !== id) }),
  practiceBoard: null,
  setPracticeBoard: (b) => set({ practiceBoard: b }),
  level: 1,

  hydrate: () => {
    const settings = localPersistence.get<AppSettings>(KEYS.settings, DEFAULT_SETTINGS);
    const profile = localPersistence.get<LocalProfile>(KEYS.profile, defaultProfile());
    const stats = localPersistence.get<StatsByMode>(KEYS.stats, emptyStats());
    const history = localPersistence.get<HistoryEntry[]>(KEYS.history, []);
    const dailyRecords = localPersistence.get<DailyRecord[]>(KEYS.daily, []);
    const onboarding = localPersistence.get<OnboardingState>(KEYS.onboarding, { completed: false, tourSeen: false });
    const streak = localPersistence.get(KEYS.streak, { count: 0, lastDate: null });
    const unlockedAchievements = localPersistence.get<string[]>(KEYS.achievements, []);
    const level = levelFromXp(profile.totalXp).level;
    set({
      settings: { ...DEFAULT_SETTINGS, ...settings },
      profile,
      stats,
      history,
      dailyRecords,
      onboarding,
      streak,
      unlockedAchievements,
      level,
      hydrated: true,
    });
  },

  checkAchievements: (lastGame) => {
    const stats = get().stats;
    const level = get().level;
    const streakCount = get().streak.count;
    const already = get().unlockedAchievements;
    const ctx: AchievementContext = {
      stats,
      level,
      streakCount,
      lastGame: {
        mode: lastGame.mode,
        difficulty: lastGame.difficulty,
        elapsedSec: lastGame.elapsedSec,
        errors: lastGame.errors,
        hintsUsed: lastGame.hintsUsed,
        completed: lastGame.completed,
      },
    };
    const newly = evaluateAchievements(ctx, already);
    if (newly.length === 0) return { newlyUnlocked: [], bonusXp: 0 };

    const bonusXp = newly.reduce((sum, id) => {
      const a = ACHIEVEMENTS.find((x) => x.id === id);
      return sum + (a?.xpReward ?? 0);
    }, 0);

    const updatedUnlocked = [...already, ...newly];
    localPersistence.set(KEYS.achievements, updatedUnlocked);

    // achievement toasts
    const achievementToasts = [
      ...get().achievementToasts,
      ...newly.map((id, i) => ({
        id: `ach-${Date.now()}-${i}`,
        achievementId: id,
        xpReward: ACHIEVEMENTS.find((a) => a.id === id)?.xpReward ?? 0,
        createdAt: Date.now() + i,
      })),
    ];

    // award bonus XP + possibly level up
    const prevProfile = get().profile;
    const prevLevel = levelFromXp(prevProfile.totalXp).level;
    const newTotalXp = prevProfile.totalXp + bonusXp;
    const newLevelInfo = levelFromXp(newTotalXp);
    const profile = { ...prevProfile, totalXp: newTotalXp };

    // Level thresholds that award a streak freeze when crossed. `crossed`
    // is computed once in the outer scope so BOTH the streak-freeze award
    // and the levelUp event below can read it. (Previously `crossed` was
    // a const inside the first if-block and was out of scope in the
    // second if-block, causing a ReferenceError that crashed the win
    // flow whenever achievement bonus XP crossed a level boundary.)
    const leveledUp = newLevelInfo.level > prevLevel;
    const crossed = leveledUp
      ? [3, 7, 14].filter((th) => prevLevel < th && newLevelInfo.level >= th)
      : [];

    if (crossed.length > 0) {
      profile.streakFreezes = (profile.streakFreezes ?? 0) + crossed.length;
    }
    localPersistence.set(KEYS.profile, profile);

    const levelUps = [...get().levelUps];
    if (leveledUp) {
      const prevUnlockedCos = new Set(unlockedCosmeticsForLevel(prevLevel).map((c) => c.id));
      const nowUnlockedCos = unlockedCosmeticsForLevel(newLevelInfo.level)
        .filter((c) => !prevUnlockedCos.has(c.id))
        .map((c) => c.id);
      levelUps.push({
        id: `lu-${Date.now()}-ach`,
        newLevel: newLevelInfo.level,
        unlockedCosmeticIds: nowUnlockedCos,
        streakFreezesEarned: crossed.length || undefined,
        createdAt: Date.now(),
      });
    }

    set({
      unlockedAchievements: updatedUnlocked,
      achievementToasts,
      profile,
      level: newLevelInfo.level,
      levelUps,
    });
    return { newlyUnlocked: newly, bonusXp };
  },

  recordGame: (input) => {
    const xp = computeXpSafe(input);
    const prevProfile = get().profile;
    const prevLevel = levelFromXp(prevProfile.totalXp).level;
    const newTotalXp = prevProfile.totalXp + xp;
    const newLevelInfo = levelFromXp(newTotalXp);
    const leveledUp = newLevelInfo.level > prevLevel;

    const previouslyUnlocked = new Set(unlockedCosmeticsForLevel(prevLevel).map((c) => c.id));
    const nowUnlocked = unlockedCosmeticsForLevel(newLevelInfo.level);
    const newlyUnlocked = nowUnlocked.filter((c) => !previouslyUnlocked.has(c.id)).map((c) => c.id);

    // Update stats
    const stats = { ...get().stats };
    const modeStats = { ...stats[input.mode] };
    const diffStats = { ...modeStats[input.difficulty] };
    diffStats.played += 1;
    diffStats.totalTimeSec += input.elapsedSec;
    if (input.completed) {
      diffStats.wins += 1;
      if (diffStats.bestTimeSec === null || input.elapsedSec < diffStats.bestTimeSec) {
        diffStats.bestTimeSec = input.elapsedSec;
      }
    }
    modeStats[input.difficulty] = diffStats;
    stats[input.mode] = modeStats;

    const isRecord =
      input.completed &&
      (diffStats.bestTimeSec === input.elapsedSec ||
        (diffStats.bestTimeSec !== null && input.elapsedSec <= diffStats.bestTimeSec));

    // history
    const historyEntry: HistoryEntry = {
      id: `h-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      mode: input.mode,
      difficulty: input.difficulty,
      elapsedSec: input.elapsedSec,
      errors: input.errors,
      hintsUsed: input.hintsUsed,
      completed: input.completed,
      xp,
      date: new Date().toISOString(),
      isRecord,
    };
    const history = [historyEntry, ...get().history].slice(0, 200);

    // profile xp
    const profile = { ...prevProfile, totalXp: newTotalXp };

    // award streak freezes on crossing certain level thresholds
    if (leveledUp) {
      const thresholds = [3, 7, 14];
      const crossed = thresholds.filter(
        (th) => prevLevel < th && newLevelInfo.level >= th
      );
      if (crossed.length > 0) {
        profile.streakFreezes = (profile.streakFreezes ?? 0) + crossed.length;
      }
    }

    // level up events
    const levelUps = [...get().levelUps];
    if (leveledUp) {
      const freezeThresholds = [3, 7, 14];
      const freezesEarned = freezeThresholds.filter(
        (th) => prevLevel < th && newLevelInfo.level >= th
      ).length;
      levelUps.push({
        id: `lu-${Date.now()}`,
        newLevel: newLevelInfo.level,
        unlockedCosmeticIds: newlyUnlocked,
        streakFreezesEarned: freezesEarned || undefined,
        createdAt: Date.now(),
      });
    }

    // persist
    localPersistence.set(KEYS.profile, profile);
    localPersistence.set(KEYS.stats, stats);
    localPersistence.set(KEYS.history, history);

    set({ profile, stats, history, level: newLevelInfo.level, levelUps });
    return { xp, leveledUp, newLevel: newLevelInfo.level, unlockedCosmeticIds: newlyUnlocked, isRecord };
  },

  recordDaily: (input) => {
    // streak logic
    const today = input.date;
    const streak = { ...get().streak };
    let consumedFreeze = false;
    if (streak.lastDate !== today) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yKey = yesterday.toISOString().slice(0, 10);
      if (streak.lastDate === yKey) {
        streak.count += 1;
      } else {
        // Streak would reset — check if the user has a streak freeze.
        const profile = get().profile;
        if ((profile.streakFreezes ?? 0) > 0 && streak.count > 0) {
          // Consume a freeze to preserve the streak.
          consumedFreeze = true;
          streak.count += 1;
          const updatedProfile = { ...profile, streakFreezes: profile.streakFreezes - 1 };
          localPersistence.set(KEYS.profile, updatedProfile);
          set({ profile: updatedProfile });
          sonnerToast.info("❄️ Streak freeze used! Your streak was protected.", {
            description: `${updatedProfile.streakFreezes} freeze${updatedProfile.streakFreezes === 1 ? "" : "s"} remaining.`,
          });
        } else {
          streak.count = 1;
        }
      }
      streak.lastDate = today;
    }
    localPersistence.set(KEYS.streak, streak);

    // record the daily result (one per date+difficulty)
    const existing = get().dailyRecords.filter(
      (r) => !(r.date === input.date && r.difficulty === input.difficulty)
    );
    const record: DailyRecord = {
      date: input.date,
      difficulty: input.difficulty,
      completed: input.completed,
      elapsedSec: input.elapsedSec,
      errors: input.errors,
      score: input.score,
      xp: 0, // xp is recorded via recordGame; keep score here
    };
    const dailyRecords = [record, ...existing];
    localPersistence.set(KEYS.daily, dailyRecords);
    set({ dailyRecords, streak });
  },

  clearAllData: () => {
    localPersistence.clearAll();
    set({
      settings: DEFAULT_SETTINGS,
      profile: defaultProfile(),
      stats: emptyStats(),
      history: [],
      dailyRecords: [],
      onboarding: { completed: false, tourSeen: false },
      streak: { count: 0, lastDate: null },
      level: 1,
      levelUps: [],
      unlockedAchievements: [],
      achievementToasts: [],
      practiceBoard: null,
    });
  },

  exportData: () => localPersistence.exportAll(),
  importData: (json) => {
    const ok = localPersistence.importAll(json);
    if (ok) get().hydrate();
    return ok;
  },

  getSavedGame: <T,>() => localPersistence.get<T | null>(KEYS.savedGame, null),
  setSavedGame: (game) => {
    if (game === null) localPersistence.remove(KEYS.savedGame);
    else localPersistence.set(KEYS.savedGame, game);
  },
}));

/* helpers for division preview */
export function localDivision(rating: number): Division {
  if (rating >= 5000) return "grandmaster";
  if (rating >= 4000) return "master";
  if (rating >= 3200) return "diamond";
  if (rating >= 2400) return "platinum";
  if (rating >= 1600) return "gold";
  if (rating >= 800) return "silver";
  return "bronze";
}

export { COSMETICS };
