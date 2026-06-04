import { getPool } from "@/lib/db";
import { NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2";

export async function GET() {
  const db = getPool();
  const [rows] = await db.execute<RowDataPacket[]>(
    "SELECT c.*, (SELECT content FROM Message WHERE conversationId = c.id ORDER BY createdAt DESC LIMIT 1) as lastMessage FROM Conversation c WHERE c.deletedAt IS NULL ORDER BY c.updatedAt DESC"
  );
  return NextResponse.json(rows);
}

export async function DELETE(req: Request) {
  const db = getPool();
  const { id } = await req.json();
  // Soft delete: set deletedAt so frontend hides it, data preserved in DB
  await db.execute("UPDATE Conversation SET deletedAt = NOW() WHERE id = ?", [id]);
  return NextResponse.json({ ok: true });
}
