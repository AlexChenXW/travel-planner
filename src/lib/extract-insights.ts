import type { Pool as PromisePool, RowDataPacket } from "mysql2/promise";
import { createChatCompletion } from "./ai-provider";

const VALID_CATEGORIES = ["departure", "preference", "constraint", "visited", "feedback", "budget", "companion", "season", "other"];

const EXTRACT_PROMPT = `你是一个旅行档案分析器。阅读这段对话，提取关于用户旅行偏好的具体事实。

规则：
- 只提取明确陈述的事实，不要推断
- 每个事实用一行，格式：类别|内容|置信度(1-10的整数)
- 类别必须是以下之一：departure, preference, constraint, visited, feedback, budget, companion, season, other
- 如果没有新事实，不要输出任何内容（留空即可）
- 不要提取已有的、常识性的或模糊的信息
- 不要输出"无"、"暂无"、"没有"等表示缺失的内容
- 内容要简洁但完整，例如"偏好舒适型酒店"而不是"有偏好"

对话：`;

export async function extractInsights(
  conversationId: number,
  userMessage: string,
  aiResponse: string,
  db: PromisePool,
): Promise<void> {
  try {
    // Throttle: check last extraction for this conversation
    const [lastRows] = await db.execute<RowDataPacket[]>(
      "SELECT createdAt FROM ProfileInsight WHERE sourceConvId = ? AND source = 'learned' ORDER BY createdAt DESC LIMIT 1",
      [conversationId],
    );
    if (lastRows.length > 0) {
      const lastTime = new Date(lastRows[0].createdAt).getTime();
      if (Date.now() - lastTime < 10 * 60 * 1000) return; // 10 min throttle
    }

    const res = await createChatCompletion([
      { role: "user", content: `${EXTRACT_PROMPT}\n用户：${userMessage}\n助手：${aiResponse.slice(0, 1000)}` },
    ]);
    const text = res.choices[0]?.message?.content || "";

    if (!text.trim()) return;

    const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
    for (const line of lines) {
      const parts = line.split("|").map((s) => s.trim());
      if (parts.length < 3) continue;

      const category = parts[0].toLowerCase();
      const content = parts[1];
      const confidence = parseInt(parts[2], 10);

      if (!VALID_CATEGORIES.includes(category) || !content || isNaN(confidence) || confidence < 1 || confidence > 10) continue;

      // Filter out meaningless content
      const normalized = content.toLowerCase().replace(/[。,.，\s]/g, "");
      if (["无", "none", "null", "暂无", "没有", "-", "na", "n/a"].includes(normalized)) continue;
      if (content.length < 2) continue;

      // Dedup: check for similar existing insights
      const [existing] = await db.execute<RowDataPacket[]>(
        "SELECT id, content FROM ProfileInsight WHERE category = ? AND status IN ('pending', 'accepted')",
        [category],
      );
      const isDuplicate = (existing as { content: string }[]).some(
        (e) => e.content.includes(content) || content.includes(e.content),
      );
      if (isDuplicate) continue;

      await db.execute(
        "INSERT INTO ProfileInsight (category, content, source, sourceConvId, status, confidence) VALUES (?, ?, 'learned', ?, 'pending', ?)",
        [category, content, conversationId, confidence],
      );
    }
  } catch (err: any) {
    console.error("Insight extraction failed:", err.message);
  }
}
