import OpenAI from "openai";
import type { ChatCompletionStream } from "openai/resources/chat/completions/completions";

const GLM_BASE = "https://open.bigmodel.cn/api/paas/v4";
const DS_BASE = "https://api.deepseek.com";

interface ProviderState {
  name: "glm" | "deepseek";
  failCount: number;
  cooldownUntil: number;
}

const state: ProviderState = {
  name: "glm",
  failCount: 0,
  cooldownUntil: 0,
};

function createClient(provider: "glm" | "deepseek"): OpenAI {
  if (provider === "glm") {
    return new OpenAI({
      apiKey: process.env.GLM_API_KEY,
      baseURL: GLM_BASE,
    });
  }
  return new OpenAI({
    apiKey: process.env.DS_API_KEY,
    baseURL: DS_BASE,
  });
}

function getActiveProvider(): "glm" | "deepseek" {
  if (Date.now() < state.cooldownUntil) {
    return state.name === "glm" ? "deepseek" : "glm";
  }
  return state.name;
}

function reportSuccess() {
  state.failCount = 0;
  if (state.name === "deepseek") {
    state.name = "glm";
    state.cooldownUntil = 0;
  }
}

function reportFailure(provider: "glm" | "deepseek") {
  state.failCount++;
  if (state.failCount >= 2) {
    state.name = provider === "glm" ? "deepseek" : "glm";
    state.cooldownUntil = Date.now() + 5 * 60 * 1000;
    state.failCount = 0;
    console.log(`Switching to ${state.name} due to ${provider} failures, cooldown 5min`);
  }
}

export async function createChatCompletion(
  messages: OpenAI.Chat.ChatCompletionMessageParam[],
  tools?: any[],
): Promise<OpenAI.Chat.ChatCompletion> {
  const provider = getActiveProvider();
  const model = provider === "glm" ? "glm-4-plus" : "deepseek-chat";
  const client = createClient(provider);
  // DeepSeek doesn't support web_search tool type
  const activeTools = provider === "glm" ? tools : undefined;

  try {
    const res = await client.chat.completions.create({ model, messages, tools: activeTools } as any);
    reportSuccess();
    return res;
  } catch (err: any) {
    console.error(`${provider} completion error:`, err.message);
    reportFailure(provider);

    const fallback = provider === "glm" ? "deepseek" : "glm";
    const fallbackModel = fallback === "deepseek" ? "deepseek-chat" : "glm-4-plus";
    const fallbackClient = createClient(fallback);
    const res = await fallbackClient.chat.completions.create({ model: fallbackModel, messages });
    return res;
  }
}

export async function createChatCompletionStream(
  messages: OpenAI.Chat.ChatCompletionMessageParam[],
  tools?: any[],
): Promise<ChatCompletionStream<null>> {
  const provider = getActiveProvider();
  const model = provider === "glm" ? "glm-4-plus" : "deepseek-chat";
  const client = createClient(provider);
  // DeepSeek doesn't support web_search tool type
  const activeTools = provider === "glm" ? tools : undefined;

  try {
    const stream = await client.chat.completions.stream({
      model,
      messages,
      tools: activeTools,
    } as any) as ChatCompletionStream<null>;
    reportSuccess();
    return stream;
  } catch (err: any) {
    console.error(`${provider} stream error:`, err.message);
    reportFailure(provider);

    const fallback = provider === "glm" ? "deepseek" : "glm";
    const fallbackModel = fallback === "deepseek" ? "deepseek-chat" : "glm-4-plus";
    console.log(`Retrying stream with ${fallback}...`);
    const fallbackClient = createClient(fallback);
    return fallbackClient.chat.completions.stream({
      model: fallbackModel,
      messages,
    });
  }
}
