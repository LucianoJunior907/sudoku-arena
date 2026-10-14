import { NextResponse } from "next/server";

/**
 * POST /api/match
 *
 * FUTURE contract: create a competitive match (solo/daily are local; duo/ranked
 * require this). The server generates or fetches the board, keeps the solution
 * secret, and returns a MatchHandle without exposing the solution to the client.
 *
 * Request: { mode, difficulty, maxErrors?, durationSec? }
 * Response: { matchId, startedAt }  (serverBoard is NEVER sent to the client)
 *
 * Current phase: NOT IMPLEMENTED — returns 501.
 */
export async function POST() {
  return NextResponse.json(
    {
      implemented: false,
      phase: "local",
      reason: "Match creation requires a backend with server-authoritative board generation and hidden solutions. Solo & Daily work locally; Duo & Ranked will use this endpoint in the next phase.",
    },
    { status: 501 }
  );
}
