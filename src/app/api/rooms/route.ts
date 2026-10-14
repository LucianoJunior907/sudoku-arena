import { NextResponse } from "next/server";

/**
 * POST /api/rooms
 *
 * FUTURE contract: create/join a Duo room. Rooms require real-time WebSocket
 * synchronization between two teams of two players.
 *
 * Request (create): { isPrivate, difficulty }
 * Request (join):   { code }
 * Response: { roomId, code, isPrivate, joinUrl }
 *
 * Current phase: NOT IMPLEMENTED — returns 501. There are no simulated rooms
 * or opponents.
 */
export async function POST() {
  return NextResponse.json(
    {
      implemented: false,
      phase: "local",
      reason: "Duo rooms require a real-time multiplayer backend (WebSocket + room service). No rooms or opponents are simulated in the local phase.",
    },
    { status: 501 }
  );
}
