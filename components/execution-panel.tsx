"use client";

import { motion } from "framer-motion";
import { ArrowUpRight, CheckCircle2, Clock, Loader2, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { cn, formatTimestamp, shorten } from "@/lib/utils";
import { AGENT_BAZAAR } from "@/lib/constants";
import type { ExecutionResult } from "@/lib/types";

const STATUS_VISUAL: Record<
  ExecutionResult["status"],
  {
    label: string;
    Icon: React.ComponentType<{ className?: string }>;
    iconClass: string;
    badge: "warning" | "info" | "success" | "danger" | "default";
  }
> = {
  queued: { label: "Queued", Icon: Clock, iconClass: "text-warning", badge: "warning" },
  running: { label: "Executing", Icon: Loader2, iconClass: "text-info animate-spin", badge: "info" },
  succeeded: { label: "Confirmed", Icon: CheckCircle2, iconClass: "text-success", badge: "success" },
  failed: { label: "Failed", Icon: XCircle, iconClass: "text-danger", badge: "danger" },
  cancelled: { label: "Cancelled", Icon: XCircle, iconClass: "text-foreground-dim", badge: "default" },
};

export function ExecutionPanel({
  execution,
}: {
  execution: ExecutionResult | null;
}) {
  if (!execution) {
    return (
      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span className="text-keeperhub">●</span>
            Execution
          </CardTitle>
          <CardDescription>
            KeeperHub workflow will fire once the risk evaluator approves.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-dashed border-border bg-card-elevated/40 px-4 py-8 text-center font-mono text-xs text-foreground-dim">
            execution-node.agentbazaar.eth waiting for approval…
          </div>
        </CardContent>
      </Card>
    );
  }

  const visual = STATUS_VISUAL[execution.status];
  const explorerUrl = execution.txHash
    ? `${AGENT_BAZAAR.chains.explorer}/tx/${execution.txHash}`
    : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <span className="text-keeperhub">●</span>
              KeeperHub execution
            </CardTitle>
            <Badge variant={visual.badge}>
              <visual.Icon className={cn("h-3 w-3", visual.iconClass)} />
              {visual.label}
            </Badge>
          </div>
          <CardDescription className="font-mono text-xs">
            workflow {shorten(execution.workflowId, 6, 4)} · run{" "}
            {shorten(execution.workflowRunId, 6, 4)}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <Field label="chain">
              <span className="font-mono">{execution.chain}</span>
            </Field>
            <Field label="started">
              <span className="font-mono">
                {formatTimestamp(execution.startedAt)}
              </span>
            </Field>
            {execution.txHash && (
              <Field label="tx hash" className="col-span-2">
                {explorerUrl ? (
                  <a
                    href={explorerUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 font-mono text-keeperhub hover:underline"
                  >
                    {shorten(execution.txHash, 10, 8)}
                    <ArrowUpRight className="h-3 w-3" />
                  </a>
                ) : (
                  <span className="font-mono">{shorten(execution.txHash, 10, 8)}</span>
                )}
              </Field>
            )}
            {execution.blockNumber !== undefined && (
              <Field label="block">
                <span className="font-mono">{execution.blockNumber}</span>
              </Field>
            )}
            {execution.gasUsed && (
              <Field label="gas used">
                <span className="font-mono">{execution.gasUsed}</span>
              </Field>
            )}
          </div>

          {execution.logs.length > 0 && (
            <div>
              <div className="font-mono text-[10px] uppercase tracking-wider text-foreground-dim mb-2">
                logs
              </div>
              <div className="rounded-md border border-border bg-background/60 p-3 max-h-48 overflow-y-auto space-y-1 font-mono text-[11px] text-foreground-muted">
                {execution.logs.map((line, i) => (
                  <div key={i} className="leading-relaxed">
                    <span className="text-foreground-dim mr-2">
                      [{String(i + 1).padStart(2, "0")}]
                    </span>
                    {line}
                  </div>
                ))}
              </div>
            </div>
          )}

          {execution.errorMessage && (
            <div className="rounded-md border border-danger/40 bg-danger/10 p-3 text-xs text-danger">
              {execution.errorMessage}
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="font-mono text-[10px] uppercase tracking-wider text-foreground-dim">
        {label}
      </div>
      <div className="mt-0.5">{children}</div>
    </div>
  );
}
