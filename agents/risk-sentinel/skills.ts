/**
 * risk-sentinel skills:
 *   score_risk      — evaluates research findings and returns a 0–10 score
 *   decide_go_no_go — explicit approval decision
 */
import { callClaude } from "@/lib/llm/claude";

const SYSTEM = `You are risk-sentinel.agentbazaar.eth, a risk evaluation AI agent in the Agent Bazaar network.
Your role is to score opportunities and make explicit go/no-go decisions.
Respond ONLY with valid JSON — no markdown.`;

export async function scoreRisk(params: Record<string, unknown>): Promise<{
  risk_score: number;
  decision: "approved" | "rejected";
  threshold: number;
  rationale: string;
  factors: string[];
}> {
  const threshold = (params.threshold as number) ?? 6.0;
  const findings = params.findings as Record<string, unknown> | undefined;
  const prompt = findings
    ? `Token: ${findings.token}, Pair: ${findings.pair}, Sentiment: ${findings.sentiment}, Volatility: ${findings.volatility24h}, Liquidity: ${findings.liquidity}`
    : JSON.stringify(params);

  const text = await callClaude(SYSTEM, [
    {
      role: "user",
      content: `Evaluate this opportunity: ${prompt}

Risk policy: approve if score ≥ ${threshold}/10.

Return JSON:
- risk_score: number 0-10
- decision: "approved" | "rejected"
- threshold: ${threshold}
- rationale: one-sentence explanation
- factors: array of 3-4 risk factor strings`,
    },
  ], 512);

  try {
    const result = JSON.parse(text);
    return {
      ...result,
      decision: result.risk_score >= threshold ? "approved" : "rejected",
    };
  } catch {
    const score = 7.2;
    return {
      risk_score: score,
      decision: score >= threshold ? "approved" : "rejected",
      threshold,
      rationale: "Default risk evaluation applied.",
      factors: ["Insufficient context for structured assessment."],
    };
  }
}

export async function decideGoNoGo(params: Record<string, unknown>): Promise<{
  decision: "go" | "no-go";
  reason: string;
}> {
  const approved = (params.approved as boolean) ?? false;
  return {
    decision: approved ? "go" : "no-go",
    reason: (params.rationale as string) ?? "Risk score threshold check.",
  };
}
