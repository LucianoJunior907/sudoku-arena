import { NextResponse } from "next/server";

/**
 * GET /api/contracts
 *
 * Documents the future backend service contracts for Sudoku Arena.
 * In the current LOCAL phase none of these are implemented against a
 * real server — they return 501 with a description of the contract the
 * backend must satisfy. See `src/lib/contracts/persistence.ts` for the
 * TypeScript interfaces.
 */
export async function GET() {
  return NextResponse.json({
    phase: "local",
    note: "No backend in this phase. The contracts below describe what the future remote implementation must satisfy.",
    contracts: {
      auth: "POST /api/auth/{signin,anonymous,signout} — AuthSession",
      profile: "GET/PATCH /api/profile/:userId — RemoteProfile",
      match: "POST /api/match — createMatch; POST /api/match/:id/move — submitMove; GET /api/match/:id — state",
      rooms: "POST /api/rooms — createRoom; POST /api/rooms/join — joinRoom; (WebSocket for room events)",
      ranking: "GET /api/ranking/:division — leaderboard; GET /api/season — current season; POST /api/result — submitResult",
      xp: "POST /api/xp/award — award XP",
      friends: "GET/POST /api/friends — list/send; POST /api/friends/:id/accept; POST /api/friends/:id/block",
      chat: "POST /api/chat/:thread — send; (WebSocket for messages)",
      daily: "GET /api/daily/:date/:difficulty — DailyChallenge (board seed from server in future)",
      reports: "POST /api/reports — report user",
    },
    securityRequirements: [
      "Server-side move validation",
      "Hidden solution during competitive matches",
      "Server-authoritative scoring & rating",
      "Room access control",
      "Consistent move synchronization",
      "Duplicate-result prevention",
      "Abuse rate limiting",
      "Shared persistence",
      "Real authentication & authorization",
    ],
  });
}
