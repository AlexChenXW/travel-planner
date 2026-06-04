import { getPool } from "@/lib/db";
import { NextResponse } from "next/server";
import type { RowDataPacket, ResultSetHeader } from "mysql2";

export async function POST(req: Request) {
  const db = getPool();
  const { action, insightId, manualOverride } = await req.json();

  if (!insightId || !["accept", "dismiss", "edit", "restore"].includes(action)) {
    return NextResponse.json({ error: "Invalid params" }, { status: 400 });
  }

  if (action === "accept") {
    await db.execute(
      "UPDATE ProfileInsight SET status = 'accepted', acceptedAt = NOW(), manualOverride = ? WHERE id = ?",
      [manualOverride || null, insightId],
    );
    await createVersionSnapshot(db, "auto", [insightId], "接受洞察");
  } else if (action === "dismiss") {
    await db.execute(
      "UPDATE ProfileInsight SET status = 'dismissed', dismissedAt = NOW() WHERE id = ?",
      [insightId],
    );
  } else if (action === "edit") {
    await db.execute(
      "UPDATE ProfileInsight SET manualOverride = ?, status = 'accepted', acceptedAt = NOW() WHERE id = ?",
      [manualOverride, insightId],
    );
    await createVersionSnapshot(db, "auto", [insightId], "编辑洞察");
  } else if (action === "restore") {
    await db.execute(
      "UPDATE ProfileInsight SET status = 'pending', acceptedAt = NULL, dismissedAt = NULL WHERE id = ?",
      [insightId],
    );
  }

  return NextResponse.json({ ok: true });
}

async function createVersionSnapshot(db: ReturnType<typeof getPool>, trigger: string, ids: number[], note: string) {
  const [insights] = await db.execute<RowDataPacket[]>(
    "SELECT category, content, manualOverride FROM ProfileInsight WHERE status = 'accepted' ORDER BY category, acceptedAt DESC",
  );
  const snapshot = JSON.stringify(insights);
  await db.execute(
    "INSERT INTO ProfileVersion (snapshot, trigger_type, insightIds, note) VALUES (?, ?, ?, ?)",
    [snapshot, trigger, ids.join(","), note],
  );
}
