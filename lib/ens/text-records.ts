/**
 * ENS text record helpers.
 * Reads/writes the canonical text record keys used by AgentMesh agents.
 */
import { createPublicClient, http } from "viem";
import { mainnet, sepolia } from "viem/chains";

/* Public client — mainnet for real ENS, sepolia for testnet resolution */
export function getEnsClient(testnet = false) {
  return createPublicClient({
    chain: testnet ? sepolia : mainnet,
    transport: http(
      testnet
        ? (process.env.SEPOLIA_RPC_URL ?? "https://rpc.sepolia.org")
        : (process.env.MAINNET_RPC_URL ?? "https://ethereum.publicnode.com")
    ),
  });
}

/** Canonical text record keys used by AgentMesh */
export const TEXT_RECORD_KEYS = {
  description: "description",
  capabilities: "agent.capabilities",
  role: "agent.role",
  skills: "agent.skills",
  axlPeerId: "axl.peer_id",
  price: "agent.price",
  model: "agent.model",
  attestation: "agent.attestation",
  keeperhubWorkflowId: "keeperhub.workflow_id",
} as const;

export type TextRecordKey = keyof typeof TEXT_RECORD_KEYS;

/** Read a single text record from an ENS name */
export async function getTextRecord(
  ensName: string,
  key: string,
  testnet = false
): Promise<string | null> {
  const client = getEnsClient(testnet);
  try {
    const value = await client.getEnsText({ name: ensName, key });
    return value ?? null;
  } catch {
    return null;
  }
}

/** Read all agent text records for a given ENS name in one go */
export async function getAllAgentTextRecords(
  ensName: string,
  testnet = false
): Promise<Record<string, string | null>> {
  const client = getEnsClient(testnet);
  const keys = Object.values(TEXT_RECORD_KEYS);

  const results = await Promise.allSettled(
    keys.map((key) =>
      client.getEnsText({ name: ensName, key }).catch(() => null)
    )
  );

  return Object.fromEntries(
    keys.map((key, i) => {
      const r = results[i];
      return [key, r.status === "fulfilled" ? (r.value ?? null) : null];
    })
  );
}

/** Resolve ENS name to address */
export async function resolveAddress(
  ensName: string,
  testnet = false
): Promise<string | null> {
  const client = getEnsClient(testnet);
  try {
    const address = await client.getEnsAddress({ name: ensName });
    return address ?? null;
  } catch {
    return null;
  }
}

/** Reverse resolve an address to its ENS primary name */
export async function reverseLookup(
  address: `0x${string}`,
  testnet = false
): Promise<string | null> {
  const client = getEnsClient(testnet);
  try {
    const name = await client.getEnsName({ address });
    return name ?? null;
  } catch {
    return null;
  }
}
