import { getPool } from "@/lib/db";
import { createChatCompletion } from "@/lib/ai-provider";
import { NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2";

const SUGGEST_PROMPT = `根据用户的旅行档案，生成4个个性化的旅行建议问题。要求：
- 每个问题一行，不要编号和引号
- 问题要具体、有趣、有启发性
- 结合用户已知的偏好、去过的地方、时间和预算信息
- 不要重复用户已经去过的地方
- 如果用户档案为空，生成通用的旅行探索问题
- 只输出问题，不要其他内容

用户旅行档案：`;

// Fallback suggestions when AI fails
const FALLBACK = [
  "来一场说走就走的旅行，去哪好？",
  "有什么适合两人放松度假的地方？",
  "推荐一个没去过但值得去的国家",
  "假期有限，3-5天能去哪玩？",
];

export async function GET() {
  try {
    const db = getPool();

    // Get accepted insights for context
    const [insights] = await db.execute<RowDataPacket[]>(
      "SELECT category, content, manualOverride FROM ProfileInsight WHERE status = 'accepted' ORDER BY category",
    );

    const profileText = (insights as any[]).length > 0
      ? (insights as any[]).map((i) => `${i.category}: ${i.manualOverride || i.content}`).join("\n")
      : "暂无档案信息";

    const res = await createChatCompletion([
      { role: "user", content: `${SUGGEST_PROMPT}\n${profileText}` },
    ]);
    const text = res.choices[0]?.message?.content || "";

    const suggestions = text.split("\n").map((s: string) => s.replace(/^[\d.、)\]]+\s*/, "").trim()).filter((s: string) => s.length > 5 && s.length < 40);

    if (suggestions.length >= 3) {
      return NextResponse.json(suggestions.slice(0, 4));
    }
  } catch (err: any) {
    console.error("Suggestions failed:", err.message);
  }

  return NextResponse.json(FALLBACK);
}
