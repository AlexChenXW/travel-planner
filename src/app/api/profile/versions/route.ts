import { getPool } from "@/lib/db";
import { NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2";

export async function GET() {
  const db = getPool();
  const [rows] = await db.execute<RowDataPacket[]>(
    "SELECT id, snapshot, trigger_type as triggerType, insightIds, note, createdAt FROM ProfileVersion ORDER BY createdAt DESC LIMIT 50",
  );
  return NextResponse.json(rows);
}
