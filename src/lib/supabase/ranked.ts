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
  finishReason: "solved" | "errors" | "abandon" | "opponent_abandon" | null;
  player1Progress: number;
  player2Progress: number;
  player1Errors: number;
  player2Errors: number;
  player1CellsCorrect: number;
  player2CellsCorrect: number;
  player1RatingBefore: number;
  player1RatingAfter: number;
  player2RatingBefore: number;
  player2RatingAfter: number;
  startedAt: string;
  endedAt: string | null;
}

export interface MatchmakingResult {
  match: RankedMatch | null;
  opponentName: string;
  isPlayer1: boolean;
  puzzle: { puzzle: number[]; solution: number[] } | null;
}

export interface FinishResult {
  alreadyFinished: boolean;
  winnerId: string | null;
  ratingBefore: number;
  ratingAfter: number;
  ratingChange: number;
  reason: string | null;
  error?: string;
}

/**
 * Join the ranked queue. Creates/refreshes the user's queue entry.
 */
export async function joinRankedQueue(
  userId: string,
  difficulty: Difficulty
): Promise<{ error: string | null }> {
  // Upsert: remove existing entry then insert fresh (with heartbeat)
  await supabase.from("ranked_queue").delete().eq("user_id", userId);
  const { error } = await supabase.from("ranked_queue").insert({
    user_id: userId,
    difficulty,
    last_heartbeat: new Date().toISOString(),
  });
  return { error: error?.message ?? null };
}

/**
 * Heartbeat — call every 10s while in queue. Keeps the entry alive.
 * Entries without heartbeat for >30s are considered offline and
 * ignored by the matchmaker (and cleaned up).
 */
export async function heartbeatQueue(): Promise<void> {
  await supabase.rpc("heartbeat_ranked_queue");
}

/**
 * Leave the ranked queue.
 */
export async function leaveRankedQueue(userId: string): Promise<void> {
  await supabase.from("ranked_queue").delete().eq("user_id", userId);
}

/**
 * Try to matchmake ATOMICALLY on the server.
 * The server:
 *   - Cleans expired entries
 *   - Finds an eligible opponent (online, no active match)
 *   - Creates the match
 *   - Removes both from queue
 * Returns { matchId, boardSeed } on success.
 */
export async function tryMatchmake(
  difficulty: Difficulty
): Promise<{ matchId: string | null; boardSeed: string | null; error: string | null }> {
  const { data, error } = await supabase.rpc("try_matchmake_atomic", {
    p_difficulty: difficulty,
  });
  if (error) return { matchId: null, boardSeed: null, error: error.message };
  const result = data as Record<string, unknown>;
  const matchId = result.match_id as string | null;
  const boardSeed = result.board_seed as string | null;
  return { matchId, boardSeed, error: null };
}

/**
 * Check if we were paired by another player.
 * Returns { matchId, boardSeed } if an active match exists for us.
 */
export async function checkForMatch(): Promise<{ matchId: string | null; boardSeed: string | null }> {
  const { data, error } = await supabase.rpc("check_my_ranked_match");
  if (error) return { matchId: null, boardSeed: null };
  const result = data as Record<string, unknown>;
  return {
    matchId: result.match_id as string | null,
    boardSeed: result.board_seed as string | null,
  };
}

/**
 * Fetch a ranked match by ID. Uses maybeSingle (no 406 on empty).
 */
export async function fetchRankedMatch(matchId: string): Promise<RankedMatch | null> {
  const { data, error } = await supabase
    .from("ranked_matches")
    .select("*")
    .eq("id", matchId)
    .maybeSingle();
  if (error || !data) return null;
  return mapRankedMatch(data);
}

/**
 * Update progress on the server. The RPC verifies the caller only
 * updates their own fields.
 */
export async function updateRankedProgress(
  matchId: string,
  progress: number,
  errors: number,
  cellsCorrect: number
): Promise<void> {
  await supabase.rpc("update_ranked_progress", {
    p_match_id: matchId,
    p_progress: progress,
    p_errors: errors,
    p_cells_correct: cellsCorrect,
  });
}

/**
 * FINISH a match — server-authoritative.
 * Sends the full solution array; the server validates it and
 * determines the winner atomically. Rating is calculated and
 * persisted on the server. Idempotent (calling twice returns the
 * existing result without applying changes).
 *
 * This is the ONLY way to legitimately finish a match. The old
 * client-side reportRankedWin is removed.
 */
export async function finishRankedMatch(
  matchId: string,
  solution: number[],
  abandon = false
): Promise<FinishResult> {
  const { data, error } = await supabase.rpc("finish_ranked_match", {
    p_match_id: matchId,
    p_solution: solution,
    p_abandon: abandon,
  });
  if (error) {
    return {
      alreadyFinished: false,
      winnerId: null,
      ratingBefore: 0,
      ratingAfter: 0,
      ratingChange: 0,
      reason: null,
      error: error.message,
    };
  }
  const r = data as Record<string, unknown>;
  return {
    alreadyFinished: (r.already_finished as boolean) ?? false,
    winnerId: (r.winner_id as string) ?? null,
    ratingBefore: (r.rating_before as number) ?? 0,
    ratingAfter: (r.rating_after as number) ?? 0,
    ratingChange: (r.rating_change as number) ?? 0,
    reason: (r.reason as string) ?? null,
    error: (r.error as string) ?? undefined,
  };
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
        const m = mapRankedMatch(payload.new as Record<string, unknown>);
        onUpdate(m);
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
    .select("display_name, username")
    .eq("id", opponentId)
    .maybeSingle();
  if (error || !data) return "Opponent";
  const p = data as Record<string, unknown>;
  return (p.username as string) || (p.display_name as string) || "Opponent";
}

// ---- helpers ----

function mapRankedMatch(d: Record<string, unknown>): RankedMatch {
  return {
    id: d.id as string,
    player1Id: d.player1_id as string,
    player2Id: d.player2_id as string,
    difficulty: d.difficulty as Difficulty,
    boardSeed: d.board_seed as string,
    status: d.status as RankedMatch["status"],
    winnerId: (d.winner_id as string) ?? null,
    finishReason: (d.finish_reason as RankedMatch["finishReason"]) ?? null,
    player1Progress: (d.player1_progress as number) ?? 0,
    player2Progress: (d.player2_progress as number) ?? 0,
    player1Errors: (d.player1_errors as number) ?? 0,
    player2Errors: (d.player2_errors as number) ?? 0,
    player1CellsCorrect: (d.player1_cells_correct as number) ?? 0,
    player2CellsCorrect: (d.player2_cells_correct as number) ?? 0,
    player1RatingBefore: (d.player1_rating_before as number) ?? 0,
    player1RatingAfter: (d.player1_rating_after as number) ?? 0,
    player2RatingBefore: (d.player2_rating_before as number) ?? 0,
    player2RatingAfter: (d.player2_rating_after as number) ?? 0,
    startedAt: d.started_at as string,
    endedAt: (d.ended_at as string) ?? null,
  };
}
