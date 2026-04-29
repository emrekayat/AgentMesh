/**
 * ENS-based authorization helper for agents.
 *
 * Before execution-node triggers KeeperHub, it checks that the calling
 * peer's ENS subname has the correct agent.role text record. This is the
 * "policy-by-ENS" authorization pattern: authorization is a live ENS lookup,
 * not a config file. Revoke by editing the text record.
 */
import { peerIdToEnsName } from "@/lib/ens/registry";
import { getTextRecord, TEXT_RECORD_KEYS } from "@/lib/ens/text-records";

export async function isAuthorizedEvaluator(fromPeerId: string): Promise<boolean> {
  try {
    const ensName = await peerIdToEnsName(fromPeerId);
    if (!ensName) return false;
    const role = await getTextRecord(ensName, TEXT_RECORD_KEYS.role);
    return role === "evaluator";
  } catch {
    return false;
  }
}

export async function isAuthorizedExecutor(fromPeerId: string): Promise<boolean> {
  try {
    const ensName = await peerIdToEnsName(fromPeerId);
    if (!ensName) return false;
    const role = await getTextRecord(ensName, TEXT_RECORD_KEYS.role);
    return role === "executor";
  } catch {
    return false;
  }
}
