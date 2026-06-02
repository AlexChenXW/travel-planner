import { getPool } from "@/lib/db";
import { NextResponse } from "next/server";
import type { RowDataPacket, ResultSetHeader } from "mysql2";

export async function GET() {
  const db = getPool();
  const [rows] = await db.execute<RowDataPacket[]>("SELECT * FROM Profile LIMIT 1");
  const profile = rows[0] as any;

  if (!profile) {
    return NextResponse.json({
      departureCities: "深圳/香港/广州",
      preferences: {},
      constraints: {},
      visitedPlaces: [],
      feedback: [],
    });
  }

  return NextResponse.json({
    ...profile,
    preferences: JSON.parse(profile.preferences || "{}"),
    constraints: JSON.parse(profile.constraints_col || "{}"),
    visitedPlaces: JSON.parse(profile.visitedPlaces || "[]"),
    feedback: JSON.parse(profile.feedback || "[]"),
  });
}

export async function POST(req: Request) {
  const db = getPool();
  const body = await req.json();

  const data = {
    departureCities: body.departureCities || "深圳/香港/广州",
    preferences: JSON.stringify(body.preferences || {}),
    constraints_col: JSON.stringify(body.constraints || {}),
    visitedPlaces: JSON.stringify(body.visitedPlaces || []),
    feedback: JSON.stringify(body.feedback || []),
  };

  const [existing] = await db.execute<RowDataPacket[]>("SELECT id FROM Profile LIMIT 1");

  if (existing.length > 0) {
    await db.execute(
      "UPDATE Profile SET departureCities=?, preferences=?, constraints_col=?, visitedPlaces=?, feedback=? WHERE id=?",
      [data.departureCities, data.preferences, data.constraints_col, data.visitedPlaces, data.feedback, (existing[0] as any).id]
    );
  } else {
    await db.execute(
      "INSERT INTO Profile (departureCities, preferences, constraints_col, visitedPlaces, feedback) VALUES (?, ?, ?, ?, ?)",
      [data.departureCities, data.preferences, data.constraints_col, data.visitedPlaces, data.feedback]
    );
  }

  return NextResponse.json({ ok: true });
}
