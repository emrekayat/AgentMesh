#!/usr/bin/env tsx
/**
 * Seed ENS subnames for Agent Bazaar agents.
 *
 * This script:
 *   1. Creates three agent subnames under agentbazaar.eth via Namespace.ninja
 *   2. Writes the canonical text records for each agent
 *   3. Optionally creates the tasks.agentbazaar.eth sub-namespace for audit subnames
 *
 * Prerequisites:
 *   - Sign up at https://namespace.ninja
 *   - Register agentbazaar.eth (or use a test name they provide)
 *   - Copy your API key into .env.local as NAMESPACE_API_KEY
 *   - Set AGENT_BAZAAR_ENS=agentbazaar.eth in .env.local
 *
 * Usage:
 *   pnpm ens:seed
 */

import "dotenv/config";

const API_KEY = process.env.NAMESPACE_API_KEY;
const API_URL =
  process.env.NAMESPACE_API_URL ?? "https://api.namespace.ninja/v1";
const PARENT_ENS = process.env.AGENT_BAZAAR_ENS ?? "agentbazaar.eth";

if (!API_KEY) {
  console.error(
    "❌  NAMESPACE_API_KEY is not set in .env.local\n" +
      "   Sign up at https://namespace.ninja and add the key."
  );
  process.exit(1);
}

type SubnameEntry = {
  label: string;
  records: Record<string, string>;
};

const AGENTS: SubnameEntry[] = [
  {
    label: "research-alpha",
    records: {
      description:
        "Deep-context research agent. Aggregates onchain history, social signal, and protocol disclosures into structured findings.",
      "agent.capabilities": "research,analysis",
      "agent.role": "researcher",
      "agent.skills": JSON.stringify(["analyze_token", "gather_context"]),
      "axl.peer_id": "axl_2zqxR6yL4hT3kF8uVcN7jBmW9pYsXdHoKq1bZ",
      "agent.price": "0.25",
      "agent.model": "claude-opus-4-7",
      "agent.attestation": "0xabc123placeholder",
    },
  },
  {
    label: "risk-sentinel",
    records: {
      description:
        "Risk evaluator with explicit go/no-go output. Scores opportunities from 0–10 against a configurable risk policy.",
      "agent.capabilities": "risk,analysis",
      "agent.role": "evaluator",
      "agent.skills": JSON.stringify(["score_risk", "decide_go_no_go"]),
      "axl.peer_id": "axl_8mNqK4rT2vH9wXjL5oP7cBdF1eGsAyZbCq3uV",
      "agent.price": "0.40",
      "agent.model": "claude-opus-4-7",
      "agent.attestation": "0xdef456placeholder",
    },
  },
  {
    label: "execution-node",
    records: {
      description:
        "Authorized executor. Triggers KeeperHub workflows after verifying the upstream caller's ENS role text record.",
      "agent.capabilities": "execution,monitoring",
      "agent.role": "executor",
      "agent.skills": JSON.stringify(["execute_intent"]),
      "axl.peer_id": "axl_5pXyZ8cVbN3kJ7tH2qWmR4dGsLfA9BoEuY6iC",
      "agent.price": "0.10",
      "agent.model": "claude-opus-4-7",
      "agent.attestation": "0x789abcplaceholder",
      "keeperhub.workflow_id":
        process.env.KEEPERHUB_WORKFLOW_ID ?? "wf_eth_swap_base_sepolia",
    },
  },
];

async function ensureSubname(label: string, parent: string): Promise<void> {
  const res = await fetch(`${API_URL}/subnames`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({ label, parent }),
  });

  if (res.ok || res.status === 409) {
    // 409 = already exists, that's fine
    return;
  }
  const body = await res.text();
  throw new Error(`Failed to create ${label}.${parent}: ${res.status} ${body}`);
}

async function writeTextRecords(
  subname: string,
  records: Record<string, string>
): Promise<void> {
  const res = await fetch(`${API_URL}/subnames/${subname}/text-records`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({ records }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `Failed to write text records for ${subname}: ${res.status} ${body}`
    );
  }
}

async function main() {
  console.log(`\n🌐  Seeding ENS subnames under ${PARENT_ENS}\n`);

  for (const agent of AGENTS) {
    const subname = `${agent.label}.${PARENT_ENS}`;
    process.stdout.write(`  ↳ ${subname} … `);
    try {
      await ensureSubname(agent.label, PARENT_ENS);
      await writeTextRecords(subname, agent.records);
      console.log("✓");
    } catch (err) {
      console.error(`✗\n    ${err}`);
    }
  }

  // Also ensure the tasks sub-namespace exists
  const taskParent = `tasks.${PARENT_ENS}`;
  process.stdout.write(`  ↳ ${taskParent} (audit namespace) … `);
  try {
    await ensureSubname("tasks", PARENT_ENS);
    console.log("✓");
  } catch (err) {
    console.error(`✗\n    ${err}`);
  }

  console.log(`\n✅  Done. Verify at https://app.ens.domains/${PARENT_ENS}\n`);
}

main().catch((err) => {
  console.error("\n❌  Seed failed:", err);
  process.exit(1);
});
