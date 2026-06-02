import { getPool } from "@/lib/db";
import { NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const db = getPool();
  const { id } = await params;

  const [convs] = await db.execute<RowDataPacket[]>(
    "SELECT * FROM Conversation WHERE id = ?",
    [parseInt(id)]
  );
  if (convs.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [messages] = await db.execute<RowDataPacket[]>(
    "SELECT * FROM Message WHERE conversationId = ? ORDER BY createdAt ASC",
    [parseInt(id)]
  );

  return NextResponse.json({ ...convs[0], messages });
}
