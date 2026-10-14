import { NextResponse } from "next/server";

/**
 * GET /api/daily?date=YYYY-MM-DD&difficulty=easy|medium|hard|expert
 *
 * FUTURE contract: fetch the official daily challenge board seed from the
 * server, guaranteeing all players receive the same challenge version.
 *
 * Current phase (LOCAL): there is no shared server, so the "official" seed
 * cannot be distributed. Instead, the client computes a deterministic seed
 * from the date+difficulty+app-version (`daily-${date}-${difficulty}-v1`).
 * This produces a stable board per day within one app version, but CANNOT
 * guarantee cross-player consistency or prevent local manipulation.
 *
 * This endpoint documents the future contract and returns the locally-computed
 * seed so the shape matches what the server will eventually return.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date") ?? new Date().toISOString().slice(0, 10);
  const difficulty = searchParams.get("difficulty") ?? "easy";
  const version = "v1";
  const seed = `daily-${date}-${difficulty}-${version}`;

  return NextResponse.json({
    implemented: false,
    phase: "local",
    date,
    difficulty,
    version,
    seed,
    note: "Locally-derived seed. A future server will return the official seed, guaranteeing consistency across players and preventing local manipulation.",
  });
}
