/**
 * research-alpha skills:
 *   analyze_token   — gathers context on a token/pair opportunity
 *   gather_context  — generic research task
 */
import { callClaude } from "@/lib/llm/claude";

const SYSTEM = `You are research-alpha.agentbazaar.eth, a specialized research AI agent in the AgentMesh network.
Your role is to gather context and produce structured findings about onchain opportunities.
Respond ONLY with valid JSON — no markdown, no explanation outside the JSON object.`;

export async function analyzeToken(params: Record<string, unknown>): Promise<{
  token: string;
  pair: string;
  liquidity: string;
  volatility24h: string;
  sentiment: string;
  summary: string;
  findings: string[];
}> {
  const prompt = params.prompt as string ?? JSON.stringify(params);

  const text = await callClaude(SYSTEM, [
    {
      role: "user",
      content: `Research task: ${prompt}

Return JSON with these fields:
- token: token symbol
- pair: trading pair
- liquidity: "deep" | "moderate" | "thin"
- volatility24h: percentage string (e.g. "1.8%")
- sentiment: "bullish" | "neutral" | "bearish"
- summary: 2-sentence summary
- findings: array of 3-5 bullet-point strings`,
    },
  ], 512);

  try {
    return JSON.parse(text);
  } catch {
    return {
      token: "ETH",
      pair: "ETH/USDC",
      liquidity: "deep",
      volatility24h: "2.1%",
      sentiment: "neutral",
      summary: text.slice(0, 200),
      findings: ["Unable to parse structured findings from model output."],
    };
  }
}

export async function gatherContext(params: Record<string, unknown>): Promise<{
  topic: string;
  summary: string;
  key_points: string[];
}> {
  const prompt = params.prompt as string ?? JSON.stringify(params);

  const text = await callClaude(SYSTEM, [
    {
      role: "user",
      content: `Gather context on: ${prompt}

Return JSON with: topic (string), summary (string), key_points (string[])`,
    },
  ], 512);

  try {
    return JSON.parse(text);
  } catch {
    return { topic: "unknown", summary: text.slice(0, 300), key_points: [] };
  }
}
