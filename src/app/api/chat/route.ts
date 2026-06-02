import OpenAI from "openai";
import { getPrisma } from "@/lib/db";
import { buildSystemPrompt } from "@/lib/system-prompt";

export async function POST(req: Request) {
  const prisma = getPrisma();
  const { conversationId, message } = await req.json();

  let conversation = conversationId
    ? await prisma.conversation.findUnique({
        where: { id: conversationId },
        include: { messages: { orderBy: { createdAt: "asc" } } },
      })
    : null;

  const profile = await prisma.profile.findFirst();
  const systemPrompt = profile ? buildSystemPrompt(profile) : buildSystemPrompt({
    departureCities: "深圳/香港/广州",
    preferences: "{}",
    constraints: "{}",
    visitedPlaces: "[]",
    feedback: "[]",
  });

  if (!conversation) {
    conversation = await prisma.conversation.create({
      data: { title: message.slice(0, 30) },
      include: { messages: true },
    });
  }

  await prisma.message.create({
    data: { conversationId: conversation.id, role: "user", content: message },
  });

  const allMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    ...(conversation.messages || []).map((m: { role: string; content: string }) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
    { role: "user" as const, content: message },
  ];

  const client = new OpenAI({
    apiKey: process.env.GLM_API_KEY,
    baseURL: "https://open.bigmodel.cn/api/paas/v4",
  });

  const stream = await client.chat.completions.create({
    model: "glm-4-plus",
    messages: [
      { role: "system", content: systemPrompt },
      ...allMessages,
    ],
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

        await getPrisma().message.create({
          data: { conversationId: conversation!.id, role: "assistant", content: fullResponse },
        });
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true, conversationId: conversation!.id })}\n\n`));
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
