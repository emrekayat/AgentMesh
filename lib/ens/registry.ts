/**
 * ENS-driven agent discovery via Namespace SDK.
 * Text records come directly from SDK response — no viem calls needed.
 */
import { createOffchainClient } from "@thenamespace/offchain-manager";
import { MOCK_AGENTS } from "@/lib/mock/seed";
import type { Agent, AgentCapability, AgentRole } from "@/lib/types";

const PARENT_ENS = process.env.AGENT_BAZAAR_ENS ?? "agentbazaar.eth";
const TESTNET = process.env.ENS_TESTNET === "true";

function getNamespaceClient() {
  const apiKey = process.env.NAMESPACE_API_KEY;
  if (!apiKey) return null;
  return createOffchainClient({
    mode: TESTNET ? "sepolia" : "mainnet",
    defaultApiKey: apiKey,
  });
}

type SubnameItem = {
  fullName?: string;
  label?: string;
  texts?: Record<string, string>;
  addresses?: Record<string, string>;
};

export async function discoverAgents(): Promise<Agent[]> {
  const client = getNamespaceClient();
  if (!client) {
    console.warn("[ENS] NAMESPACE_API_KEY not set — using mock agents.");
    return MOCK_AGENTS;
  }

  try {
    const result = await client.getFilteredSubnames({ parentName: PARENT_ENS });
    const items: SubnameItem[] = Array.isArray(result)
      ? result
      : (result as { items?: SubnameItem[] }).items ?? [];

    const agents = items
      .filter((s) => {
        const name = s.fullName ?? `${s.label}.${PARENT_ENS}`;
        // skip the parent-level subnames that aren't agents
        return name !== PARENT_ENS && s.texts?.["agent.role"];
      })
      .map((s) => subnameToAgent(s));

    if (agents.length === 0) {
      console.warn("[ENS] No agent subnames found — using mock agents.");
      return MOCK_AGENTS;
    }

    console.log(`[ENS] Discovered ${agents.length} agents from ENS:`, agents.map((a) => a.ensName).join(", "));
    return agents;
  } catch (err) {
    console.error("[ENS] discovery failed, using mock agents:", err instanceof Error ? err.message : err);
    return MOCK_AGENTS;
  }
}

function subnameToAgent(s: SubnameItem): Agent {
  const ensName = s.fullName ?? `${s.label}.${PARENT_ENS}`;
  const texts = s.texts ?? {};
  const role = parseRole(texts["agent.role"] ?? "researcher");

  return {
    ensName,
    address: (Object.values(s.addresses ?? {})[0] as `0x${string}` | undefined),
    description: texts["description"] ?? ensName,
    role,
    capabilities: parseCapabilities(texts["agent.capabilities"] ?? ""),
    skills: parseSkills(texts["agent.skills"] ?? ""),
    axlPeerId: texts["axl.peer_id"] ?? "",
    axlEndpoint: `http://localhost:${portForRole(role)}`,
    pricePerTaskUsdc: parseFloat(texts["agent.price"] ?? "0"),
    model: texts["agent.model"] ?? "claude-opus-4-7",
    attestation: texts["agent.attestation"] ?? undefined,
    online: true,
  };
}

/** Resolve an AXL peer ID back to an ENS name for display */
export async function peerIdToEnsName(peerId: string): Promise<string | undefined> {
  const agents = await discoverAgents();
  return agents.find((a) => a.axlPeerId === peerId)?.ensName;
}

/** Kept for backward compatibility with other callers */
export async function resolveAgent(ensName: string): Promise<Agent> {
  const agents = await discoverAgents();
  const found = agents.find((a) => a.ensName === ensName);
  if (found) return found;
  // fallback: find in mock
  return MOCK_AGENTS.find((a) => a.ensName === ensName) ?? MOCK_AGENTS[0];
}

function parseCapabilities(raw: string): AgentCapability[] {
  const valid: AgentCapability[] = ["research", "analysis", "risk", "execution", "monitoring"];
  return raw.split(",").map((s) => s.trim() as AgentCapability).filter((s) => valid.includes(s));
}

function parseSkills(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.map(String);
  } catch { /* comma-separated fallback */ }
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

function parseRole(raw: string): AgentRole {
  const valid: AgentRole[] = ["researcher", "evaluator", "executor"];
  const r = raw.trim().toLowerCase() as AgentRole;
  return valid.includes(r) ? r : "researcher";
}

function portForRole(role: AgentRole): number {
  return { researcher: 9003, evaluator: 9004, executor: 9005 }[role];
}
