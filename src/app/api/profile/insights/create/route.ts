import { getPool } from "@/lib/db";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const db = getPool();
  const { category, content } = await req.json();

  if (!category || !content) {
    return NextResponse.json({ error: "category and content required" }, { status: 400 });
  }

  const [result] = await db.execute(
    "INSERT INTO ProfileInsight (category, content, source, status, confidence) VALUES (?, ?, 'manual', 'accepted', 10)",
    [category, content],
  );

  // Create version snapshot
  const [insights] = await (db as any).execute(
    "SELECT category, content, manualOverride FROM ProfileInsight WHERE status = 'accepted' ORDER BY category, acceptedAt DESC",
  );
  await db.execute(
    "INSERT INTO ProfileVersion (snapshot, trigger_type, insightIds, note) VALUES (?, 'manual', ?, ?)",
    [JSON.stringify(insights), String((result as any).insertId), "手动添加"],
  );

  return NextResponse.json({ ok: true });
}
