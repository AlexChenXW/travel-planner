import { getPool } from "@/lib/db";
import { NextResponse } from "next/server";
import type { RowDataPacket, ResultSetHeader } from "mysql2";

export async function GET() {
  const db = getPool();

  // Fetch insights grouped by status
  const [pendingRows] = await db.execute<RowDataPacket[]>(
    "SELECT id, category, content, source, sourceConvId, status, confidence, manualOverride, createdAt FROM ProfileInsight WHERE status = 'pending' ORDER BY createdAt DESC",
  );
  const [acceptedRows] = await db.execute<RowDataPacket[]>(
    "SELECT id, category, content, source, sourceConvId, status, confidence, manualOverride, createdAt, acceptedAt FROM ProfileInsight WHERE status = 'accepted' ORDER BY category, acceptedAt DESC",
  );
  const [dismissedRows] = await db.execute<RowDataPacket[]>(
    "SELECT id, category, content, source, sourceConvId, status, confidence, manualOverride, createdAt, dismissedAt FROM ProfileInsight WHERE status = 'dismissed' ORDER BY dismissedAt DESC LIMIT 20",
  );

  // Build compiled active profile from accepted insights
  const grouped = new Map<string, string[]>();
  for (const ins of acceptedRows as any[]) {
    const text = ins.manualOverride || ins.content;
    const list = grouped.get(ins.category) || [];
    list.push(text);
    grouped.set(ins.category, list);
  }

  const active = {
    departureCities: (grouped.get("departure") || []).join("、") || "深圳/香港/广州",
    preferences: Object.fromEntries(
      (grouped.get("preference") || []).map((p, i) => [`偏好${i + 1}`, p]),
    ),
    constraints: Object.fromEntries(
      (grouped.get("constraint") || []).map((c, i) => [`约束${i + 1}`, c]),
    ),
    visitedPlaces: grouped.get("visited") || [],
    feedback: grouped.get("feedback") || [],
  };

  // Fetch recent versions
  const [versions] = await db.execute<RowDataPacket[]>(
    "SELECT id, trigger_type as triggerType, note, createdAt FROM ProfileVersion ORDER BY createdAt DESC LIMIT 10",
  );

  return NextResponse.json({
    active,
    insights: {
      pending: pendingRows,
      accepted: acceptedRows,
      dismissed: dismissedRows,
    },
    recentVersions: versions,
  });
}

export async function POST(req: Request) {
  const db = getPool();
  const body = await req.json();

  // Save to old Profile table (backward compat)
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
      [data.departureCities, data.preferences, data.constraints_col, data.visitedPlaces, data.feedback, (existing[0] as any).id],
    );
  } else {
    await db.execute(
      "INSERT INTO Profile (departureCities, preferences, constraints_col, visitedPlaces, feedback) VALUES (?, ?, ?, ?, ?)",
      [data.departureCities, data.preferences, data.constraints_col, data.visitedPlaces, data.feedback],
    );
  }

  // Also create manual insights for each field
  if (body.departureCities) {
    await db.execute(
      "INSERT INTO ProfileInsight (category, content, source, status, confidence) VALUES (?, ?, 'manual', 'accepted', 10) ON DUPLICATE KEY UPDATE content=VALUES(content)",
      ["departure", "出发城市：" + body.departureCities],
    );
  }

  return NextResponse.json({ ok: true });
}
