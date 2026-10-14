/**
 * Persistence & service contracts for the FUTURE backend integration.
 *
 * In the current LOCAL phase, everything is implemented with
 * `localPersistence` (localStorage) and there is no remote server.
 * The interfaces below describe what the remote implementations must
 * satisfy once a backend exists. Nothing here is wired to a fake
 * server — it only documents the future contract.
 *
 * Rules honored in this phase:
 * - No fake authentication.
 * - No simulated multiplayer.
 * - No simulated friends / messages / reports.
 */

import type { Locale } from "@/lib/i18n/translations";
import type { Difficulty } from "@/lib/sudoku/types";

/* ------------------------------------------------------------------ */
/* Auth                                                                */
/* ------------------------------------------------------------------ */

export interface AuthSession {
  userId: string;
  displayName: string;
  isAnonymous: boolean;
  createdAt: string;
}

export interface AuthService {
  /** Returns the current session, or null when not signed in. */
  getSession(): Promise<AuthSession | null>;
  signIn(email: string, password: string): Promise<AuthSession>;
  signInAnonymous(displayName: string): Promise<AuthSession>;
  signOut(): Promise<void>;
}

/* ------------------------------------------------------------------ */
/* Profile                                                             */
/* ------------------------------------------------------------------ */

export interface ProfileService {
  getProfile(userId: string): Promise<RemoteProfile>;
  updateProfile(userId: string, patch: Partial<RemoteProfile>): Promise<RemoteProfile>;
}

export interface RemoteProfile {
  userId: string;
  displayName: string;
  avatarSeed: string;
  title: string | null;
  frameId: string | null;
  effectId: string | null;
  rating: number;
  division: Division;
  totalXp: number;
  level: number;
  createdAt: string;
}

/* ------------------------------------------------------------------ */
/* Matches & rooms                                                     */
/* ------------------------------------------------------------------ */

export interface MatchService {
  createMatch(config: MatchConfig): Promise<MatchHandle>;
  joinMatch(matchId: string): Promise<MatchHandle>;
  submitMove(matchId: string, move: MatchMove): Promise<MoveAck>;
  getMatchState(matchId: string): Promise<MatchState>;
}

export interface MatchConfig {
  mode: "solo" | "duo" | "ranked" | "daily";
  difficulty: Difficulty;
  boardSeed?: string;
  maxErrors?: number;
  durationSec?: number;
}

export interface MatchHandle {
  matchId: string;
  serverBoard: string; // server-controlled, hidden during competitive play
  startedAt: string;
}

export interface MatchMove {
  matchId: string;
  cellIndex: number;
  value: number; // 0 to erase
  notes?: number[];
  sequence: number;
}

export interface MoveAck {
  accepted: boolean;
  reason?: string;
  isCorrect: boolean;
  errors: number;
  completed: boolean;
}

export interface MatchState {
  matchId: string;
  status: "waiting" | "active" | "paused" | "completed" | "abandoned";
  cells: Array<{ index: number; value: number; notes: number[]; given: boolean }>;
  errors: number;
  elapsedSec: number;
}

/* ------------------------------------------------------------------ */
/* Rooms (Duo)                                                         */
/* ------------------------------------------------------------------ */

export interface RoomService {
  createRoom(config: { isPrivate: boolean; difficulty: Difficulty }): Promise<RoomHandle>;
  joinRoom(code: string): Promise<RoomHandle>;
  leaveRoom(roomId: string): Promise<void>;
  onRoomEvent(roomId: string, handler: (e: RoomEvent) => void): () => void;
}

export interface RoomHandle {
  roomId: string;
  code: string;
  isPrivate: boolean;
  joinUrl: string;
}

export type RoomEvent =
  | { type: "player-joined"; seat: number; displayName: string }
  | { type: "player-left"; seat: number; reason: string }
  | { type: "match-started"; matchId: string }
  | { type: "reconnect-window"; remainingSec: number }
  | { type: "paused" }
  | { type: "resumed" };

/* ------------------------------------------------------------------ */
/* Ranking & seasons                                                   */
/* ------------------------------------------------------------------ */

export interface RankingService {
  getLeaderboard(division: Division, page: number): Promise<LeaderboardPage>;
  getSeason(): Promise<Season>;
  submitResult(matchId: string, result: MatchResult): Promise<RatingUpdate>;
}

export interface LeaderboardPage {
  seasonId: string;
  division: Division;
  entries: Array<{ rank: number; userId: string; displayName: string; rating: number; wins: number }>;
  totalPages: number;
}

export interface Season {
  id: string;
  name: string;
  startsAt: string;
  endsAt: string;
  resetPolicy: "partial" | "full";
}

export interface MatchResult {
  matchId: string;
  outcome: "win" | "loss" | "draw";
  score: number;
  errors: number;
  cellsCorrect: number;
  elapsedSec: number;
}

export interface RatingUpdate {
  previousRating: number;
  newRating: number;
  delta: number;
  division: Division;
}

/* ------------------------------------------------------------------ */
/* XP                                                                  */
/* ------------------------------------------------------------------ */

export interface XpService {
  award(userId: string, amount: number, reason: string): Promise<XpResult>;
}

export interface XpResult {
  awarded: number;
  totalXp: number;
  level: number;
  leveledUp: boolean;
  unlockedCosmetics: string[];
}

/* ------------------------------------------------------------------ */
/* Friends, chat, reports                                              */
/* ------------------------------------------------------------------ */

export interface FriendsService {
  list(): Promise<Friend[]>;
  sendRequest(userId: string): Promise<void>;
  acceptRequest(requestId: string): Promise<void>;
  block(userId: string): Promise<void>;
}

export interface Friend {
  userId: string;
  displayName: string;
  status: "online" | "offline" | "in-match";
  rating: number;
}

export interface ChatService {
  send(threadId: string, message: string): Promise<void>;
  onMessage(threadId: string, handler: (m: ChatMessage) => void): () => void;
}

export interface ChatMessage {
  id: string;
  threadId: string;
  authorId: string;
  authorName: string;
  body: string;
  sentAt: string;
}

export interface ReportService {
  report(targetUserId: string, reason: string, detail: string): Promise<void>;
}

/* ------------------------------------------------------------------ */
/* Daily challenge                                                     */
/* ------------------------------------------------------------------ */

export interface DailyChallengeService {
  getForDate(date: string, difficulty: Difficulty): Promise<DailyChallenge>;
  submitResult(date: string, difficulty: Difficulty, result: MatchResult): Promise<void>;
}

export interface DailyChallenge {
  date: string;
  difficulty: Difficulty;
  boardSeed: string;
  version: string;
}

/* ------------------------------------------------------------------ */
/* Shared enums                                                        */
/* ------------------------------------------------------------------ */

export type Division =
  | "bronze"
  | "silver"
  | "gold"
  | "platinum"
  | "diamond"
  | "master"
  | "grandmaster";

export interface AppSettings {
  locale: Locale;
  theme: "light" | "dark" | "system";
  autoCheck: boolean;
  highlightPeers: boolean;
  highlightSame: boolean;
  showTimer: boolean;
  maxErrors: number; // 0 = unlimited
  maxHints: number;
  soundEnabled: boolean;
}
