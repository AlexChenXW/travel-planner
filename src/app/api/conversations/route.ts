import { getPool } from "@/lib/db";
import { NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2";

export async function GET() {
  const db = getPool();
  const [rows] = await db.execute<RowDataPacket[]>(
    "SELECT c.*, (SELECT content FROM Message WHERE conversationId = c.id ORDER BY createdAt DESC LIMIT 1) as lastMessage FROM Conversation c ORDER BY c.updatedAt DESC"
  );
  return NextResponse.json(rows);
}

export async function DELETE(req: Request) {
  const db = getPool();
  const { id } = await req.json();
  await db.execute("DELETE FROM Conversation WHERE id = ?", [id]);
  return NextResponse.json({ ok: true });
}
