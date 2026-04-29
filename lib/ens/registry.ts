/**
 * ENS-driven agent discovery.
 *
 * In Phase 1, falls back to mock agents when ENS resolution is unavailable.
 * In Phase 2+, queries Namespace API for *.agentbazaar.eth subnames and
 * resolves each one's text records to build the Agent object.
 *
 * The orchestrator NEVER has a hardcoded agent list — this module is the
 * sole source of truth for which agents exist.
 */
import { getAllAgentTextRecords, resolveAddress, TEXT_RECORD_KEYS } from "./text-records";
import { MOCK_AGENTS } from "@/lib/mock/seed";
import type { Agent, AgentCapability, AgentRole } from "@/lib/types";

const PARENT_ENS = process.env.AGENT_BAZAAR_ENS ?? "agentbazaar.eth";
const NAMESPACE_API =
  process.env.NAMESPACE_API_URL ?? "https://api.namespace.ninja/v1";
const TESTNET = process.env.ENS_TESTNET === "true";

/**
 * Discover all agents under the AgentMesh ENS namespace.
 *
 * Uses Namespace's subname listing API, then resolves text records for each.
 * Falls back to mock data when the API isn't configured.
 */
export async function discoverAgents(): Promise<Agent[]> {
  const apiKey = process.env.NAMESPACE_API_KEY;
  if (!apiKey) {
    console.warn(
      "[ENS] NAMESPACE_API_KEY not set — using mock agents. Run pnpm ens:seed after signing up."
    );
    return MOCK_AGENTS;
  }

  try {
    const res = await fetch(
      `${NAMESPACE_API}/subnames?parent=${PARENT_ENS}`,
      {
        headers: { Authorization: `Bearer ${apiKey}` },
        next: { revalidate: 30 },
      }
    );
    if (!res.ok) throw new Error(`Namespace API ${res.status}`);

    const data = await res.json();
    const subnames: string[] = data.subnames ?? [];

    if (subnames.length === 0) return MOCK_AGENTS;

    const agents = await Promise.allSettled(
      subnames.map((name) => resolveAgent(name))
    );

    const resolved = agents
      .filter((r): r is PromiseFulfilledResult<Agent> => r.status === "fulfilled")
      .map((r) => r.value);

    return resolved.length > 0 ? resolved : MOCK_AGENTS;
  } catch (err) {
    console.error("[ENS] discovery failed, using mock agents:", err);
    return MOCK_AGENTS;
  }
}

/** Resolve a single ENS subname to an Agent object using its text records */
export async function resolveAgent(ensName: string): Promise<Agent> {
  const [records, address] = await Promise.all([
    getAllAgentTextRecords(ensName, TESTNET),
    resolveAddress(ensName, TESTNET),
  ]);

  const capabilities = parseCapabilities(
    records[TEXT_RECORD_KEYS.capabilities] ?? ""
  );
  const skills = parseSkills(records[TEXT_RECORD_KEYS.skills] ?? "");
  const role = parseRole(records[TEXT_RECORD_KEYS.role] ?? "researcher");

  return {
    ensName,
    address: address as `0x${string}` | undefined,
    description: records[TEXT_RECORD_KEYS.description] ?? ensName,
    role,
    capabilities,
    skills,
    axlPeerId: records[TEXT_RECORD_KEYS.axlPeerId] ?? "",
    axlEndpoint: `http://localhost:${portForRole(role)}`,
    pricePerTaskUsdc: parseFloat(records[TEXT_RECORD_KEYS.price] ?? "0"),
    model: records[TEXT_RECORD_KEYS.model] ?? "claude-opus-4-7",
    attestation: records[TEXT_RECORD_KEYS.attestation] ?? undefined,
    online: true,
  };
}

/** Resolve an AXL peer ID back to an ENS name for display in the timeline */
export async function peerIdToEnsName(
  peerId: string
): Promise<string | undefined> {
  const agents = await discoverAgents();
  return agents.find((a) => a.axlPeerId === peerId)?.ensName;
}

function parseCapabilities(raw: string): AgentCapability[] {
  const valid: AgentCapability[] = [
    "research",
    "analysis",
    "risk",
    "execution",
    "monitoring",
  ];
  return raw
    .split(",")
    .map((s) => s.trim() as AgentCapability)
    .filter((s) => valid.includes(s));
}

function parseSkills(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.map(String);
  } catch {
    /* not JSON — treat as comma-separated */
  }
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseRole(raw: string): AgentRole {
  const valid: AgentRole[] = ["researcher", "evaluator", "executor"];
  const r = raw.trim().toLowerCase() as AgentRole;
  return valid.includes(r) ? r : "researcher";
}

function portForRole(role: AgentRole): number {
  const map: Record<AgentRole, number> = {
    researcher: 9003,
    evaluator: 9004,
    executor: 9005,
  };
  return map[role];
}
