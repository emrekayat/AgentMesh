import { Fingerprint, RefreshCw } from "lucide-react";
import { AgentCard } from "@/components/agent-card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { MOCK_AGENTS } from "@/lib/mock/seed";
import type { Agent } from "@/lib/types";

async function getAgents(): Promise<Agent[]> {
  try {
    const base =
      process.env.NEXT_PUBLIC_APP_URL ??
      "http://localhost:3000";
    const res = await fetch(`${base}/api/agents`, {
      next: { revalidate: 30 },
    });
    if (!res.ok) return MOCK_AGENTS;
    const json = await res.json();
    return json.agents ?? MOCK_AGENTS;
  } catch {
    return MOCK_AGENTS;
  }
}

export default async function AgentsPage() {
  const agents = await getAgents();

  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-12">
      {/* Header */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <Fingerprint className="h-5 w-5 text-ens" />
            <h1 className="text-2xl font-bold tracking-tight">Agent registry</h1>
          </div>
          <p className="text-sm text-foreground-muted max-w-lg">
            Agents discovered from{" "}
            <code className="rounded bg-card-elevated px-1.5 py-0.5 text-xs text-ens">
              *.agentbazaar.eth
            </code>{" "}
            ENS subnames. Capabilities, peer IDs, and roles live in text records
            — no hardcoded list.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <Badge variant="gensyn">
            {agents.filter((a) => a.online).length}/{agents.length} online
          </Badge>
          <Badge variant="ens">ENS-sourced</Badge>
        </div>
      </div>

      <Separator className="mb-8" />

      {/* Discovery explainer */}
      <div className="mb-8 rounded-xl border border-ens/30 bg-ens-soft/30 p-4">
        <div className="font-mono text-xs text-ens mb-1.5 uppercase tracking-wider">
          How discovery works
        </div>
        <p className="text-xs text-foreground-muted leading-relaxed">
          The orchestrator queries{" "}
          <code className="text-foreground">*.agentbazaar.eth</code> via the
          Namespace API, then resolves each subname&apos;s text records using
          viem <code className="text-foreground">getEnsText</code>. Records{" "}
          <code className="text-foreground">agent.capabilities</code>,{" "}
          <code className="text-foreground">axl.peer_id</code>, and{" "}
          <code className="text-foreground">agent.role</code> drive candidate
          selection and ENS-based authorization — zero hardcoded state.
        </p>
      </div>

      {/* Agent grid */}
      {agents.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card-elevated/30 p-16 text-center">
          <Fingerprint className="mx-auto mb-3 h-8 w-8 text-foreground-dim" />
          <div className="font-mono text-sm text-foreground-dim">
            No agents resolved from ENS
          </div>
          <div className="mt-1 text-xs text-foreground-dim">
            Run{" "}
            <code className="rounded bg-card px-1">pnpm ens:seed</code> to mint
            subnames and text records.
          </div>
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {agents.map((agent) => (
            <AgentCard key={agent.ensName} agent={agent} />
          ))}
        </div>
      )}

      {/* Text records schema table */}
      <div className="mt-10 rounded-xl border border-border bg-card p-5">
        <div className="font-mono text-[10px] uppercase tracking-wider text-foreground-dim mb-4">
          ENS text record schema
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border">
                <th className="py-2 pr-6 text-left font-mono text-foreground-muted">
                  key
                </th>
                <th className="py-2 pr-6 text-left font-mono text-foreground-muted">
                  example value
                </th>
                <th className="py-2 text-left font-mono text-foreground-muted">
                  purpose
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {[
                [
                  "agent.capabilities",
                  "research,analysis",
                  "capability filter for task routing",
                ],
                [
                  "agent.role",
                  "executor",
                  "ENS-based authorization gate at execution-node",
                ],
                [
                  "agent.skills",
                  '["analyze_token"]',
                  "A2A skill names registered on the AXL node",
                ],
                [
                  "axl.peer_id",
                  "axl_2zqxR6yL…",
                  "ed25519 peer ID for AXL mesh routing",
                ],
                [
                  "agent.price",
                  "0.25",
                  "USDC per task — used in x402 micropayment flow",
                ],
                ["agent.model", "claude-opus-4-7", "LLM model in use"],
                [
                  "agent.attestation",
                  "0xabc123…",
                  "signed self-attestation hash (trust badge)",
                ],
                [
                  "keeperhub.workflow_id",
                  "wf_eth_swap_base_sepolia",
                  "executor-only: workflow to trigger",
                ],
              ].map(([key, val, purpose]) => (
                <tr key={key}>
                  <td className="py-2 pr-6 font-mono text-ens">{key}</td>
                  <td className="py-2 pr-6 font-mono text-foreground-muted">
                    {val}
                  </td>
                  <td className="py-2 text-foreground-dim">{purpose}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
