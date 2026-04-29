/**
 * ENS-based authorization helper for agents.
 *
 * Before execution-node triggers KeeperHub, it checks that the calling
 * peer's ENS subname has the correct agent.role. This is the
 * "policy-by-ENS" authorization pattern: authorization is derived from the
 * ENS-driven agent registry, not a config file.
 */
import { discoverAgents } from "@/lib/ens/registry";

export async function isAuthorizedEvaluator(fromPeerId: string): Promise<boolean> {
  try {
    const agents = await discoverAgents();
    const agent = agents.find((a) => a.axlPeerId === fromPeerId);
    return agent?.role === "evaluator";
  } catch {
    return false;
  }
}

export async function isAuthorizedExecutor(fromPeerId: string): Promise<boolean> {
  try {
    const agents = await discoverAgents();
    const agent = agents.find((a) => a.axlPeerId === fromPeerId);
    return agent?.role === "executor";
  } catch {
    return false;
  }
}
