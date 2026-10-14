"use client";

import { supabase } from "./client";
import { generatePuzzle } from "@/lib/sudoku/engine";
import type { Difficulty } from "@/lib/sudoku/types";

export interface RankedMatch {
  id: string;
  player1Id: string;
  player2Id: string;
  difficulty: Difficulty;
  boardSeed: string;
  status: "active" | "completed" | "abandoned";
  winnerId: string | null;
  player1Progress: number;
  player2Progress: number;
  player1Errors: number;
  player2Errors: number;
  player1CellsCorrect: number;
  player2CellsCorrect: number;
  startedAt: string;
  endedAt: string | null;
}

export interface MatchmakingResult {
  match: RankedMatch | null;
  opponentName: string;
  isPlayer1: boolean;
  puzzle: { puzzle: number[]; solution: number[] } | null;
}

/**
 * Join the ranked queue. Polls for a match.
 * Returns when an opponent is found and a match is created.
 */
export async function joinRankedQueue(
  userId: string,
  difficulty: Difficulty
): Promise<{ error: string | null }> {
  // Remove any existing queue entry for this user
  await supabase.from("ranked_queue").delete().eq("user_id", userId);

  // Insert into queue
  const { error } = await supabase.from("ranked_queue").insert({
    user_id: userId,
    difficulty,
  });
  return { error: error?.message ?? null };
}

/**
 * Leave the ranked queue.
 */
export async function leaveRankedQueue(userId: string): Promise<void> {
  await supabase.from("ranked_queue").delete().eq("user_id", userId);
}

/**
 * Try to find a match. Called periodically while in queue.
 * If another player is in the queue, creates a match and removes both from queue.
 */
export async function tryMatchmake(
  userId: string,
  difficulty: Difficulty
): Promise<{ matchId: string | null; error: string | null }> {
  // Find another player in the queue (not us)
  const { data: opponents, error: qError } = await supabase
    .from("ranked_queue")
    .select("user_id")
    .neq("user_id", userId)
    .eq("difficulty", difficulty)
    .order("joined_at", { ascending: true })
    .limit(1);

  if (qError || !opponents || opponents.length === 0) {
    return { matchId: null, error: null };
  }

  const opponentId = opponents[0].user_id;

  // Generate a shared board seed
  const seed = `ranked-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const p = generatePuzzle(difficulty, seed);

  // Create the match (player1 = us, player2 = opponent)
  const { data: match, error: mError } = await supabase
    .from("ranked_matches")
    .insert({
      player1_id: userId,
      player2_id: opponentId,
      difficulty,
      board_seed: seed,
      status: "active",
    })
    .select()
    .single();

  if (mError || !match) {
    return { matchId: null, error: mError?.message ?? "Failed to create match" };
  }

  // Remove both players from queue
  await supabase.from("ranked_queue").delete().in("user_id", [userId, opponentId]);

  return { matchId: match.id, error: null };
}

/**
 * Check if a match was created for us (we're player2).
 */
export async function checkForMatch(userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("ranked_matches")
    .select("id")
    .or(`player1_id.eq.${userId},player2_id.eq.${userId}`)
    .eq("status", "active")
    .order("started_at", { ascending: false })
    .limit(1)
    .single();

  if (error || !data) return null;
  return data.id;
}

/**
 * Fetch a ranked match by ID.
 */
export async function fetchRankedMatch(matchId: string): Promise<RankedMatch | null> {
  const { data, error } = await supabase
    .from("ranked_matches")
    .select("*")
    .eq("id", matchId)
    .single();

  if (error || !data) return null;

  return {
    id: data.id,
    player1Id: data.player1_id,
    player2Id: data.player2_id,
    difficulty: data.difficulty,
    boardSeed: data.board_seed,
    status: data.status,
    winnerId: data.winner_id,
    player1Progress: data.player1_progress,
    player2Progress: data.player2_progress,
    player1Errors: data.player1_errors,
    player2Errors: data.player2_errors,
    player1CellsCorrect: data.player1_cells_correct,
    player2CellsCorrect: data.player2_cells_correct,
    startedAt: data.started_at,
    endedAt: data.ended_at,
  };
}

/**
 * Update the player's progress in a ranked match.
 */
export async function updateRankedProgress(
  matchId: string,
  userId: string,
  isPlayer1: boolean,
  data: {
    progress: number;
    errors: number;
    cellsCorrect: number;
  }
): Promise<void> {
  const updates: Record<string, number> = {};
  if (isPlayer1) {
    updates.player1_progress = data.progress;
    updates.player1_errors = data.errors;
    updates.player1_cells_correct = data.cellsCorrect;
  } else {
    updates.player2_progress = data.progress;
    updates.player2_errors = data.errors;
    updates.player2_cells_correct = data.cellsCorrect;
  }

  await supabase.from("ranked_matches").update(updates).eq("id", matchId);
}

/**
 * Report a win (this player completed the board).
 */
export async function reportRankedWin(
  matchId: string,
  winnerId: string
): Promise<void> {
  await supabase
    .from("ranked_matches")
    .update({
      status: "completed",
      winner_id: winnerId,
      ended_at: new Date().toISOString(),
    })
    .eq("id", matchId);
}

/**
 * Report a loss (this player exceeded the error limit).
 */
export async function reportRankedLoss(
  matchId: string,
  winnerId: string
): Promise<void> {
  await supabase
    .from("ranked_matches")
    .update({
      status: "completed",
      winner_id: winnerId,
      ended_at: new Date().toISOString(),
    })
    .eq("id", matchId);
}

/**
 * Subscribe to ranked match updates (realtime).
 */
export function subscribeToRankedMatch(
  matchId: string,
  onUpdate: (match: RankedMatch) => void
): () => void {
  const channel = supabase
    .channel(`ranked:${matchId}`)
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "ranked_matches",
        filter: `id=eq.${matchId}`,
      },
      async (payload) => {
        const data = payload.new as Record<string, unknown>;
        onUpdate({
          id: data.id as string,
          player1Id: data.player1_id as string,
          player2Id: data.player2_id as string,
          difficulty: data.difficulty as Difficulty,
          boardSeed: data.board_seed as string,
          status: data.status as RankedMatch["status"],
          winnerId: (data.winner_id as string) ?? null,
          player1Progress: data.player1_progress as number,
          player2Progress: data.player2_progress as number,
          player1Errors: data.player1_errors as number,
          player2Errors: data.player2_errors as number,
          player1CellsCorrect: data.player1_cells_correct as number,
          player2CellsCorrect: data.player2_cells_correct as number,
          startedAt: data.started_at as string,
          endedAt: (data.ended_at as string) ?? null,
        });
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

/**
 * Fetch the opponent's display name.
 */
export async function fetchOpponentName(opponentId: string): Promise<string> {
  const { data, error } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", opponentId)
    .single();

  if (error || !data) return "Opponent";
  return data.display_name;
}

/**
 * Update the user's rating in their profile.
 */
export async function updateRating(
  userId: string,
  newRating: number
): Promise<void> {
  await supabase
    .from("profiles")
    .update({ rating: newRating, updated_at: new Date().toISOString() })
    .eq("id", userId);
}
