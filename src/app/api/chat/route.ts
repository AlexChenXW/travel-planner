import OpenAI from "openai";
import { getPool } from "@/lib/db";
import { buildSystemPrompt } from "@/lib/system-prompt";
import type { RowDataPacket, ResultSetHeader } from "mysql2";

export async function POST(req: Request) {
  const db = getPool();
  const { conversationId, message } = await req.json();

  let convId = conversationId as number | null;
  let existingMessages: { role: string; content: string }[] = [];

  if (convId) {
    const [rows] = await db.execute<RowDataPacket[]>(
      "SELECT role, content FROM Message WHERE conversationId = ? ORDER BY createdAt ASC",
      [convId]
    );
    existingMessages = rows as { role: string; content: string }[];
  }

  const [profileRows] = await db.execute<RowDataPacket[]>("SELECT * FROM Profile LIMIT 1");
  const profile = profileRows[0] as any;
  const systemPrompt = profile
    ? buildSystemPrompt(profile)
    : buildSystemPrompt({
        departureCities: "深圳/香港/广州",
        preferences: "{}",
        constraints: "{}",
        visitedPlaces: "[]",
        feedback: "[]",
      });

  if (!convId) {
    const [result] = await db.execute<ResultSetHeader>(
      "INSERT INTO Conversation (title) VALUES (?)",
      [message.slice(0, 30)]
    );
    convId = result.insertId;
  }

  await db.execute("INSERT INTO Message (conversationId, role, content) VALUES (?, ?, ?)", [
    convId,
    "user",
    message,
  ]);

  const allMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    ...existingMessages.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
    { role: "user" as const, content: message },
  ];

  const client = new OpenAI({
    apiKey: process.env.GLM_API_KEY,
    baseURL: "https://open.bigmodel.cn/api/paas/v4",
  });

  const stream = await client.chat.completions.create({
    model: "glm-4-plus",
    messages: [{ role: "system", content: systemPrompt }, ...allMessages],
    stream: true,
  });

  const encoder = new TextEncoder();
  let fullResponse = "";

  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          const text = chunk.choices[0]?.delta?.content || "";
          if (text) {
            fullResponse += text;
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`));
          }
        }

        await db.execute("INSERT INTO Message (conversationId, role, content) VALUES (?, ?, ?)", [
          convId,
          "assistant",
          fullResponse,
        ]);
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ done: true, conversationId: convId })}\n\n`)
        );
        controller.close();
      } catch (err: any) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: err.message })}\n\n`));
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
