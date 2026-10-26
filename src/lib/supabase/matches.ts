"use client";

import { supabase } from "./client";
import type { GameMode } from "@/lib/progression/progression";
import type { Difficulty } from "@/lib/sudoku/types";

export interface LeaderboardEntry {
  userId: string;
  displayName: string;
  avatarSeed: string;
  rating: number;
  level: number;
  totalXp: number;
  username: string;
}

export interface FriendEntry {
  userId: string;
  displayName: string;
  avatarSeed: string;
  status: string;
  rating: number;
}

/**
 * Resolve the single public name for a user. The username IS the
 * identity — there is no separate display name. We fall back to
 * display_name only for legacy accounts that may not have a username
 * yet, and never return "Player" as a placeholder.
 */
function resolveName(p: Record<string, unknown>): string {
  const uname = (p.username as string | null) ?? null;
  if (uname && uname.trim()) return uname;
  const dname = (p.display_name as string | null) ?? null;
  if (dname && dname.trim() && dname !== "Player") return dname;
  return "";
}

/**
 * Fetch the global leaderboard from Supabase.
 * Returns top N players ordered by rating (descending).
 */
export async function fetchGlobalLeaderboard(limit = 50): Promise<LeaderboardEntry[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_seed, username, rating, level, total_xp")
    .order("rating", { ascending: false })
    .limit(limit);

  if (error || !data) return [];

  return (data as Record<string, unknown>[]).map((p) => {
    const name = resolveName(p);
    return {
      userId: p.id as string,
      displayName: name,
      avatarSeed: (p.avatar_seed as string) ?? "default",
      username: name,
      rating: (p.rating as number) ?? 0,
      level: (p.level as number) ?? 1,
      totalXp: (p.total_xp as number) ?? 0,
    };
  });
}

/**
 * Save a completed match to Supabase.
 */
export async function saveMatchToCloud(
  userId: string,
  input: {
    mode: GameMode;
    difficulty: Difficulty;
    elapsedSec: number;
    errors: number;
    hintsUsed: number;
    completed: boolean;
    xpEarned: number;
    score: number;
    isRecord: boolean;
  }
): Promise<boolean> {
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
  return !error;
}

/**
 * Fetch the current user's match history from Supabase.
 */
export async function fetchUserMatches(userId: string, limit = 50) {
  const { data, error } = await supabase
    .from("matches")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return data;
}

/**
 * Fetch or create the user's profile in Supabase.
 */
export async function fetchOrCreateProfile(userId: string, displayName: string) {
  const { data: existing } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();

  if (existing) return existing;

  // Create if not found
  const { data, error } = await supabase
    .from("profiles")
    .insert({
      id: userId,
      display_name: displayName,
      avatar_seed: "arena-" + Math.random().toString(36).slice(2, 8),
    })
    .select()
    .single();

  if (error) return null;
  return data;
}

/**
 * Update the user's profile in Supabase.
 */
export async function updateCloudProfile(
  userId: string,
  patch: {
    display_name?: string;
    avatar_seed?: string;
    title_id?: string | null;
    frame_id?: string;
    effect_id?: string;
    total_xp?: number;
    level?: number;
    rating?: number;
    streak_freezes?: number;
  }
): Promise<boolean> {
  const { error } = await supabase
    .from("profiles")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", userId);
  return !error;
}

/**
 * Save a daily record to Supabase.
 */
export async function saveDailyToCloud(
  userId: string,
  input: {
    date: string;
    difficulty: Difficulty;
    completed: boolean;
    elapsedSec: number;
    errors: number;
    score: number;
  }
): Promise<boolean> {
  const { error } = await supabase.from("daily_records").upsert(
    {
      user_id: userId,
      date: input.date,
      difficulty: input.difficulty,
      completed: input.completed,
      elapsed_sec: input.elapsedSec,
      errors: input.errors,
      score: input.score,
    },
    { onConflict: "user_id,date,difficulty" }
  );
  return !error;
}

/**
 * Send a friend request.
 */
export async function sendFriendRequest(userId: string, targetUserId: string): Promise<{ success: boolean; error?: string }> {
  // Check if already friends or pending
  const { data: existing } = await supabase
    .from("friends")
    .select("status")
    .or(`and(user_id.eq.${userId},friend_id.eq.${targetUserId}),and(user_id.eq.${targetUserId},friend_id.eq.${userId})`)
    .limit(1);

  if (existing && existing.length > 0) {
    const status = (existing[0] as Record<string, unknown>).status as string;
    if (status === "accepted") return { success: false, error: "already_friends" };
    if (status === "pending") return { success: false, error: "already_pending" };
  }

  const { error } = await supabase.from("friends").insert({
    user_id: userId,
    friend_id: targetUserId,
    status: "pending",
  });
  if (error) {
    // Duplicate key = already exists
    if (error.code === "23505") return { success: false, error: "already_pending" };
    return { success: false, error: error.message };
  }
  return { success: true };
}

/**
 * Search for a user by username (for friend requests).
 */
export async function searchUserByUsername(username: string): Promise<{
  found: boolean;
  user?: { id: string; displayName: string; username: string; avatarSeed: string; rating: number };
}> {
  const { data, error } = await supabase.rpc("search_user_by_username", {
    p_username: username,
  });
  if (error || !data) return { found: false };
  const result = data as Record<string, unknown>;
  if (!result.found) return { found: false };
  const user = result.user as Record<string, unknown>;
  return {
    found: true,
    user: {
      id: user.id as string,
      displayName: resolveName(user),
      username: (user.username as string) ?? resolveName(user),
      avatarSeed: (user.avatar_seed as string) ?? "default",
      rating: (user.rating as number) ?? 0,
    },
  };
}

/**
 * Check if a username is available.
 */
export async function checkUsernameAvailable(username: string): Promise<{ available: boolean; error?: string }> {
  const { data, error } = await supabase.rpc("check_username_available", {
    p_username: username,
  });
  if (error) return { available: false, error: error.message };
  const result = data as Record<string, unknown>;
  return {
    available: result.available as boolean,
    error: (result.error as string) ?? undefined,
  };
}

/**
 * Set the current user's username.
 */
export async function setUsername(username: string): Promise<{ success: boolean; error?: string }> {
  const { data, error } = await supabase.rpc("set_username", {
    p_username: username,
  });
  if (error) return { success: false, error: error.message };
  const result = data as Record<string, unknown>;
  if (result.error) return { success: false, error: result.error as string };
  return { success: true };
}

/**
 * Fetch the user's friends list (two-step query to avoid FK issues).
 */
export async function fetchFriends(userId: string): Promise<FriendEntry[]> {
  const { data: friends, error } = await supabase
    .from("friends")
    .select("friend_id, status")
    .eq("user_id", userId)
    .eq("status", "accepted");

  if (error || !friends || friends.length === 0) return [];

  const friendIds = friends.map((f: Record<string, unknown>) => f.friend_id as string);
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_seed, rating")
    .in("id", friendIds);

  const profileMap = new Map<string, Record<string, unknown>>();
  for (const p of (profiles ?? []) as Record<string, unknown>[]) {
    profileMap.set(p.id as string, p);
  }

  return friends.map((f: Record<string, unknown>) => {
    const profile = profileMap.get(f.friend_id as string) ?? {};
    return {
      userId: f.friend_id as string,
      displayName: resolveName(profile),
      avatarSeed: (profile.avatar_seed as string) ?? "default",
      status: f.status as string,
      rating: (profile.rating as number) ?? 0,
    };
  });
}

/**
 * Fetch pending friend requests (incoming) — two-step query.
 */
export async function fetchPendingRequests(userId: string): Promise<FriendEntry[]> {
  const { data: requests, error } = await supabase
    .from("friends")
    .select("user_id, status")
    .eq("friend_id", userId)
    .eq("status", "pending");

  if (error || !requests || requests.length === 0) return [];

  const requesterIds = requests.map((r: Record<string, unknown>) => r.user_id as string);
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_seed, rating")
    .in("id", requesterIds);

  const profileMap = new Map<string, Record<string, unknown>>();
  for (const p of (profiles ?? []) as Record<string, unknown>[]) {
    profileMap.set(p.id as string, p);
  }

  return requests.map((r: Record<string, unknown>) => {
    const profile = profileMap.get(r.user_id as string) ?? {};
    return {
      userId: r.user_id as string,
      displayName: resolveName(profile),
      avatarSeed: (profile.avatar_seed as string) ?? "default",
      status: r.status as string,
      rating: (profile.rating as number) ?? 0,
    };
  });
}

/**
 * Fetch sent friend requests (outgoing) — two-step query.
 */
export async function fetchSentRequests(userId: string): Promise<FriendEntry[]> {
  const { data: requests, error } = await supabase
    .from("friends")
    .select("friend_id, status")
    .eq("user_id", userId)
    .eq("status", "pending");

  if (error || !requests || requests.length === 0) return [];

  const targetIds = requests.map((r: Record<string, unknown>) => r.friend_id as string);
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_seed, rating")
    .in("id", targetIds);

  const profileMap = new Map<string, Record<string, unknown>>();
  for (const p of (profiles ?? []) as Record<string, unknown>[]) {
    profileMap.set(p.id as string, p);
  }

  return requests.map((r: Record<string, unknown>) => {
    const profile = profileMap.get(r.friend_id as string) ?? {};
    return {
      userId: r.friend_id as string,
      displayName: resolveName(profile),
      avatarSeed: (profile.avatar_seed as string) ?? "default",
      status: r.status as string,
      rating: (profile.rating as number) ?? 0,
    };
  });
}

/**
 * Accept a friend request.
 */
export async function acceptFriendRequest(userId: string, requesterId: string): Promise<boolean> {
  // Update the original request to accepted
  const { error: updateError } = await supabase
    .from("friends")
    .update({ status: "accepted" })
    .eq("user_id", requesterId)
    .eq("friend_id", userId);

  if (updateError) return false;

  // Create the reverse friendship (or update if exists)
  const { error: insertError } = await supabase.from("friends").upsert({
    user_id: userId,
    friend_id: requesterId,
    status: "accepted",
  }, { onConflict: "user_id,friend_id" });

  return !insertError;
}

/**
 * Reject/decline a friend request.
 */
export async function rejectFriendRequest(userId: string, requesterId: string): Promise<boolean> {
  const { error } = await supabase
    .from("friends")
    .delete()
    .eq("user_id", requesterId)
    .eq("friend_id", userId);
  return !error;
}

/**
 * Block a user.
 */
export async function blockUser(userId: string, targetUserId: string): Promise<boolean> {
  const { error } = await supabase.from("friends").upsert(
    {
      user_id: userId,
      friend_id: targetUserId,
      status: "blocked",
    },
    { onConflict: "user_id,friend_id" }
  );
  return !error;
}

/**
 * Send a chat message.
 */
export async function sendChatMessage(
  threadId: string,
  authorId: string,
  body: string
): Promise<boolean> {
  const { error } = await supabase.from("chat_messages").insert({
    thread_id: threadId,
    author_id: authorId,
    body,
  });
  return !error;
}

/**
 * Subscribe to chat messages for a thread (realtime).
 */
export function subscribeToChat(
  threadId: string,
  onMessage: (msg: { id: string; authorId: string; body: string; createdAt: string }) => void
) {
  const channel = supabase
    .channel(`chat:${threadId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "chat_messages",
        filter: `thread_id=eq.${threadId}`,
      },
      (payload) => {
        const newMsg = payload.new as Record<string, unknown>;
        onMessage({
          id: newMsg.id as string,
          authorId: newMsg.author_id as string,
          body: newMsg.body as string,
          createdAt: newMsg.created_at as string,
        });
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

// ============================================
// Duo Rooms (Supabase Realtime)
// ============================================

export async function createRoom(
  hostId: string,
  difficulty: Difficulty,
  isPrivate: boolean
): Promise<{ code: string; roomId: string } | null> {
  const code = Math.random().toString(36).slice(2, 8).toUpperCase();
  const { data, error } = await supabase
    .from("rooms")
    .insert({
      code,
      is_private: isPrivate,
      difficulty,
      host_id: hostId,
      status: "waiting",
    })
    .select()
    .single();

  if (error || !data) return null;

  // Add host as participant
  await supabase.from("room_participants").insert({
    room_id: data.id,
    user_id: hostId,
    team: 1,
    seat: 1,
  });

  return { code: data.code, roomId: data.id };
}

export async function joinRoom(code: string, userId: string): Promise<string | null> {
  // Find the room by code
  const { data: room, error: roomError } = await supabase
    .from("rooms")
    .select("id, status")
    .eq("code", code.toUpperCase())
    .eq("status", "waiting")
    .single();

  if (roomError || !room) return null;

  // Check if already a participant
  const { data: existing } = await supabase
    .from("room_participants")
    .select("id")
    .eq("room_id", room.id)
    .eq("user_id", userId)
    .single();

  if (existing) return room.id;

  // Count current participants to assign team/seat
  const { data: participants } = await supabase
    .from("room_participants")
    .select("team, seat")
    .eq("room_id", room.id);

  const count = participants?.length ?? 0;
  if (count >= 4) return null; // Room full

  const team = count < 2 ? 1 : 2;
  const seat = count % 2 === 0 ? 1 : 2;

  const { error: joinError } = await supabase.from("room_participants").insert({
    room_id: room.id,
    user_id: userId,
    team,
    seat,
  });

  if (joinError) return null;
  return room.id;
}

export function subscribeToRoom(roomId: string, onChange: () => void) {
  const channel = supabase
    .channel(`room:${roomId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "room_participants",
        filter: `room_id=eq.${roomId}`,
      },
      () => onChange()
    )
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "rooms",
        filter: `id=eq.${roomId}`,
      },
      () => onChange()
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

export async function fetchRoomParticipants(roomId: string) {
  const { data, error } = await supabase
    .from("room_participants")
    .select(`
      user_id,
      team,
      seat,
      profiles!inner(display_name, avatar_seed)
    `)
    .eq("room_id", roomId);
  if (error || !data) return [];
  return data;
}
