/**
 * LLM wrapper — uses Groq (free tier) when GROQ_API_KEY is set,
 * falls back to Anthropic when ANTHROPIC_API_KEY is set.
 * Interface is identical for all callers.
 */

export const AGENT_MODEL = process.env.GROQ_API_KEY
  ? "llama-3.3-70b-versatile"
  : "claude-haiku-4-5";

export type ClaudeMessage = {
  role: "user" | "assistant";
  content: string;
};

export async function callClaude(
  system: string,
  messages: ClaudeMessage[],
  maxTokens = 1024
): Promise<string> {
  if (process.env.GROQ_API_KEY) {
    return callGroq(system, messages, maxTokens);
  }
  return callAnthropic(system, messages, maxTokens);
}

/* ── Groq (OpenAI-compatible, free tier) ──────────────────────────────────── */
async function callGroq(
  system: string,
  messages: ClaudeMessage[],
  maxTokens: number
): Promise<string> {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: AGENT_MODEL,
      max_tokens: maxTokens,
      messages: [
        { role: "system", content: system },
        ...messages,
      ],
    }),
    signal: AbortSignal.timeout(30000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Groq error ${res.status}: ${text}`);
  }

  const data = (await res.json()) as {
    choices: { message: { content: string } }[];
  };
  return data.choices[0]?.message?.content ?? "";
}

/* ── Anthropic (fallback) ──────────────────────────────────────────────────── */
async function callAnthropic(
  system: string,
  messages: ClaudeMessage[],
  maxTokens: number
): Promise<string> {
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY ?? "",
  });
  const response = await client.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: maxTokens,
    system: [
      {
        type: "text",
        text: system,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages,
  });
  const block = response.content[0];
  if (block.type !== "text") throw new Error("Unexpected content block type");
  return block.text;
}
