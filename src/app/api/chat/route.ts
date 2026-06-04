import { getPool } from "@/lib/db";
import { buildSystemPrompt } from "@/lib/system-prompt";
import { createChatCompletionStream, createChatCompletion } from "@/lib/ai-provider";
import { extractInsights } from "@/lib/extract-insights";
import type { RowDataPacket, ResultSetHeader } from "mysql2";
import { TRAVEL_TOOLS, executeTool } from "@/lib/travel-tools";
import type OpenAI from "openai";

const WEB_SEARCH_TOOL = [{ type: "web_search" as any, web_search: { enable: true } }];

export async function POST(req: Request) {
  const db = getPool();
  const { conversationId, message } = await req.json();

  let convId = conversationId as number | null;
  let existingMessages: { role: string; content: string }[] = [];

  if (convId) {
    const [rows] = await db.execute<RowDataPacket[]>(
      "SELECT role, content FROM Message WHERE conversationId = ? ORDER BY createdAt ASC",
      [convId],
    );
    existingMessages = rows as { role: string; content: string }[];
  }

  // Try insight-based system prompt first, fallback to old Profile
  const [insights] = await db.execute<RowDataPacket[]>(
    "SELECT category, content, status, manualOverride FROM ProfileInsight WHERE status = 'accepted' ORDER BY category, acceptedAt DESC",
  );

  let systemPrompt: string;
  if ((insights as any[]).length > 0) {
    systemPrompt = buildSystemPrompt(insights);
  } else {
    const [profileRows] = await db.execute<RowDataPacket[]>("SELECT * FROM Profile LIMIT 1");
    const row = profileRows[0] as any;
    const profile = row ? {
      departureCities: row.departureCities,
      preferences: row.preferences,
      constraints: row.constraints_col || row.constraints,
      visitedPlaces: row.visitedPlaces,
      feedback: row.feedback,
    } : null;
    systemPrompt = profile
      ? buildSystemPrompt(profile)
      : buildSystemPrompt({
          departureCities: "深圳/香港/广州",
          preferences: "{}",
          constraints: "{}",
          visitedPlaces: "[]",
          feedback: "[]",
        });
  }

  if (!convId) {
    const [result] = await db.execute<ResultSetHeader>(
      "INSERT INTO Conversation (title) VALUES (?)",
      [message.slice(0, 30)],
    );
    convId = result.insertId;
  }

  const isNewConv = !conversationId;

  await db.execute("INSERT INTO Message (conversationId, role, content) VALUES (?, ?, ?)", [
    convId,
    "user",
    message,
  ]);

  const allMessages = [
    ...existingMessages.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
    { role: "user" as const, content: message },
  ];

  const chatMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
    ...allMessages,
  ];

  const allTools = [...WEB_SEARCH_TOOL, ...TRAVEL_TOOLS];

  const encoder = new TextEncoder();
  let fullResponse = "";
  const capturedConvId = convId;
  const capturedMessage = message;

  const readable = new ReadableStream({
    async start(controller) {
      try {
        // Single streaming call with web_search + function tools
        const stream = await createChatCompletionStream(chatMessages, allTools);

        let pendingToolCalls: any[] = [];
        let currentToolCall: any = null;

        for await (const chunk of stream) {
          const choice = chunk.choices[0];
          if (!choice) continue;

          // Handle tool calls from the stream
          const delta = choice.delta as any;

          if (delta?.tool_calls) {
            for (const tc of delta.tool_calls) {
              if (tc.id) {
                // New tool call starting
                currentToolCall = { id: tc.id, function: { name: tc.function?.name || "", arguments: tc.function?.arguments || "" } };
                pendingToolCalls.push(currentToolCall);
              } else if (currentToolCall && tc.function) {
                // Continuation of current tool call
                if (tc.function.name) currentToolCall.function.name += tc.function.name;
                if (tc.function.arguments) currentToolCall.function.arguments += tc.function.arguments;
              }
            }
          }

          // Stream text content to client
          const text = delta?.content || "";
          if (text) {
            fullResponse += text;
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`));
          }
        }

        // If there were tool calls, execute them and get final response
        if (pendingToolCalls.length > 0) {
          // Build assistant message with tool calls
          const assistantMsg: any = { role: "assistant", content: null, tool_calls: pendingToolCalls };
          chatMessages.push(assistantMsg);

          for (const call of pendingToolCalls) {
            try {
              const args = JSON.parse(call.function.arguments);
              const result = await executeTool(call.function.name, args);
              chatMessages.push({ role: "tool", content: result, tool_call_id: call.id } as any);
            } catch (toolErr: any) {
              chatMessages.push({ role: "tool", content: JSON.stringify({ error: toolErr.message }), tool_call_id: call.id } as any);
            }
          }

          // Second call to get final answer with tool results + web search
          const stream2 = await createChatCompletionStream(chatMessages, WEB_SEARCH_TOOL);
          for await (const chunk of stream2) {
            const text = chunk.choices[0]?.delta?.content || "";
            if (text) {
              fullResponse += text;
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`));
            }
          }
        }

        await db.execute("INSERT INTO Message (conversationId, role, content) VALUES (?, ?, ?)", [
          capturedConvId,
          "assistant",
          fullResponse,
        ]);

        // Auto-generate a short title for new conversations
        if (isNewConv && fullResponse.length > 10) {
          try {
            const titleRes = await createChatCompletion([
              { role: "user", content: `给这段对话起一个简短的标题（不超过10个字，不要引号和标点）：\n用户：${capturedMessage}\n助手：${fullResponse.slice(0, 200)}` },
            ]);
            const title = titleRes.choices[0]?.message?.content?.trim().slice(0, 20) || capturedMessage.slice(0, 20);
            await db.execute("UPDATE Conversation SET title = ? WHERE id = ?", [title, capturedConvId]);
          } catch {}
        }

        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ done: true, conversationId: capturedConvId })}\n\n`)
        );
        controller.close();

        // Fire-and-forget insight extraction
        extractInsights(capturedConvId, capturedMessage, fullResponse, db).catch(() => {});
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
