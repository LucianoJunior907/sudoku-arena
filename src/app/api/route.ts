import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    app: "Sudoku Arena",
    phase: "local",
    version: "1.0.0-local",
    contracts: "/api/contracts",
  });
}
