#!/usr/bin/env tsx
/**
 * Seed ENS subnames for Agent Bazaar agents via @thenamespace/offchain-manager SDK.
 * Usage: pnpm ens:seed
 */
import "dotenv/config";
import { createOffchainClient } from "@thenamespace/offchain-manager";

const API_KEY = process.env.NAMESPACE_API_KEY;
const PARENT_ENS = process.env.AGENT_BAZAAR_ENS ?? "agentbazaar.eth";

if (!API_KEY) {
  console.error("❌  NAMESPACE_API_KEY is not set in .env");
  process.exit(1);
}

const client = createOffchainClient({
  mode: "mainnet",
  domainApiKeys: { [PARENT_ENS]: API_KEY },
});

type AgentEntry = {
  label: string;
  records: Record<string, string>;
};

function toTexts(records: Record<string, string>) {
  return Object.entries(records).map(([key, value]) => ({ key, value }));
}

const AGENTS: AgentEntry[] = [
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

async function seedAgent(agent: AgentEntry): Promise<void> {
  const subname = `${agent.label}.${PARENT_ENS}`;
  process.stdout.write(`  ↳ ${subname} … `);

  try {
    await client.createSubname({
      parentName: PARENT_ENS,
      label: agent.label,
      texts: toTexts(agent.records),
    });
    console.log("✓ created");
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.toLowerCase().includes("already exists") || msg.includes("409")) {
      /* subname exists — just update text records */
      try {
        await client.updateSubname(subname, { texts: toTexts(agent.records) });
        console.log("✓ updated (already existed)");
      } catch (updateErr) {
        console.error(`✗ update failed: ${updateErr}`);
      }
    } else {
      console.error(`✗\n    ${msg}`);
    }
  }
}

async function main() {
  console.log(`\n🌐  Seeding ENS subnames under ${PARENT_ENS}\n`);

  for (const agent of AGENTS) {
    await seedAgent(agent);
  }

  /* Also create the tasks.agentbazaar.eth sub-namespace for audit subnames */
  const taskSubname = `tasks.${PARENT_ENS}`;
  process.stdout.write(`  ↳ ${taskSubname} (audit namespace) … `);
  try {
    await client.createSubname({ parentName: PARENT_ENS, label: "tasks" });
    console.log("✓ created");
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.toLowerCase().includes("already exists") || msg.includes("409")) {
      console.log("✓ (already existed)");
    } else {
      console.error(`✗\n    ${msg}`);
    }
  }

  console.log(`\n✅  Done. Verify at https://app.namespace.ninja/${PARENT_ENS}\n`);
}

main().catch((err) => {
  console.error("\n❌  Seed failed:", err);
  process.exit(1);
});
