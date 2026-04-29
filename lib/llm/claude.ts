/**
 * Thin wrapper around the Anthropic SDK with prompt caching enabled.
 * All agent LLM calls go through this module.
 */
import Anthropic from "@anthropic-ai/sdk";
import { env } from "@/agents/shared/env";

let _client: Anthropic | null = null;

export function getClaudeClient(): Anthropic {
  if (!_client) {
    _client = new Anthropic({ apiKey: env.anthropicApiKey });
  }
  return _client;
}

export const AGENT_MODEL = "claude-opus-4-7";

export type ClaudeMessage = {
  role: "user" | "assistant";
  content: string;
};

/**
 * Call Claude with prompt caching on the system prompt.
 * Returns the text of the first content block.
 */
export async function callClaude(
  system: string,
  messages: ClaudeMessage[],
  maxTokens = 1024
): Promise<string> {
  const client = getClaudeClient();
  const response = await client.messages.create({
    model: AGENT_MODEL,
    max_tokens: maxTokens,
    system: [
      {
        type: "text",
        text: system,
        // Prompt caching: system prompt is cached after first call
        cache_control: { type: "ephemeral" },
      },
    ],
    messages,
  });
  const block = response.content[0];
  if (block.type !== "text") throw new Error("Unexpected content block type");
  return block.text;
}
