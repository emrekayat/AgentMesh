/**
 * Live topology polling for the orchestrator node.
 * Converts the raw AXL /topology response into our TopologySnapshot schema.
 */
import { AXLClient } from "./client";
import { peerIdToEnsName } from "@/lib/ens/registry";
import type { TopologySnapshot } from "@/lib/types";

const orchestrator = new AXLClient(9002);

export async function getTopologySnapshot(): Promise<TopologySnapshot | null> {
  try {
    const raw = await orchestrator.getTopology();
    const peers = await Promise.all(
      (raw.peers ?? []).map(async (p) => {
        const ensName = await peerIdToEnsName(p.public_key).catch(() => undefined);
        return {
          peerId: p.public_key,
          ensName,
          hops: 1,
          reachable: true,
          lastSeen: p.last_seen ?? new Date().toISOString(),
        };
      })
    );
    return {
      selfPeerId: raw.our_public_key,
      peers,
      takenAt: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}
