"use client";

import { supabase } from "./client";
import type { Board } from "@/lib/sudoku/types";
import type { Difficulty } from "@/lib/sudoku/types";
import type { GameMode } from "@/lib/progression/progression";

export interface RemoteMatch {
  id: string;
  userId: string;
  mode: GameMode;
  difficulty: Difficulty;
  elapsedSec: number;
  errors: number;
  hintsUsed: number;
  completed: boolean;
  xpEarned: number;
  score: number;
  isRecord: boolean;
  createdAt: string;
}

export async function saveMatch(userId: string, input: {
  mode: GameMode;
  difficulty: Difficulty;
  elapsedSec: number;
  errors: number;
  hintsUsed: number;
  completed: boolean;
  xpEarned: number;
  score: number;
  isRecord: boolean;
}): Promise<{ error: string | null }> {
  const { error } = await supabase.from("matches").insert({
    user_id: userId,
    mode: input.mode,
    difficulty: input.difficulty,
    elapsed_sec: input.elapsedSec,
    errors: input.errors,
    hints_used: input.hintsUsed,
    completed: input.completed,
    xp_earned: input.xpEarned,
    score: input.score,
    is_record: input.isRecord,
  });
  return { error: error?.message ?? null };
}

export async function fetchLeaderboard(limit = 50): Promise<RemoteMatch[]> {
  const { data, error } = await supabase
    .from("matches")
    .select("*, profiles!inner(display_name, avatar_seed)")
    .eq("completed", true)
    .order("score", { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return data.map((m: Record<string, unknown>) => ({
    id: m.id as string,
    userId: m.user_id as string,
    mode: m.mode as GameMode,
    difficulty: m.difficulty as Difficulty,
    elapsedSec: m.elapsed_sec as number,
    errors: m.errors as number,
    hintsUsed: m.hints_used as number,
    completed: m.completed as boolean,
    xpEarned: m.xp_earned as number,
    score: m.score as number,
    isRecord: m.is_record as boolean,
    createdAt: m.created_at as string,
  }));
}

export async function fetchUserStats(userId: string) {
  const { data, error } = await supabase
    .from("matches")
    .select("*")
    .eq("user_id", userId)
    .eq("completed", true);
  if (error || !data) return null;
  return data;
}

export async function saveDailyRecord(userId: string, input: {
  date: string;
  difficulty: Difficulty;
  completed: boolean;
  elapsedSec: number;
  errors: number;
  score: number;
}): Promise<{ error: string | null }> {
  const { error } = await supabase.from("daily_records").upsert({
    user_id: userId,
    date: input.date,
    difficulty: input.difficulty,
    completed: input.completed,
    elapsed_sec: input.elapsedSec,
    errors: input.errors,
    score: input.score,
  }, { onConflict: "user_id,date,difficulty" });
  return { error: error?.message ?? null };
}

export async function fetchProfile(userId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();
  if (error) return null;
  return data;
}

export async function updateProfile(userId: string, patch: Record<string, unknown>) {
  const { error } = await supabase
    .from("profiles")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", userId);
  return { error: error?.message ?? null };
}

// Board serialization for share/match
export function boardToString(board: Board): string {
  return board.map((v) => String(v)).join("");
}
