"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  BadgeCheck,
  Cpu,
  ExternalLink,
  Fingerprint,
  Network,
  Sparkles,
  Wrench,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { CoordinationTimeline } from "@/components/coordination-timeline";
import { ExecutionPanel } from "@/components/execution-panel";
import { TopologyWidget } from "@/components/topology-widget";
import { cn, relativeTime } from "@/lib/utils";
import { AGENT_BAZAAR } from "@/lib/constants";
import type {
  CoordinationEvent,
  ExecutionResult,
  Task,
  TopologySnapshot,
} from "@/lib/types";

function Metric({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="font-mono text-[10px] uppercase tracking-wider text-foreground-dim">
        {label}
      </div>
      <div className={cn("mt-1 font-mono text-sm font-semibold", color)}>
        {value}
      </div>
    </div>
  );
}

const STATUS_BADGE: Record<
  Task["status"],
  { label: string; variant: "info" | "ens" | "gensyn" | "warning" | "success" | "danger" }
> = {
  submitted: { label: "Submitted", variant: "info" },
  discovering: { label: "Discovering agents", variant: "ens" },
  coordinating: { label: "Agents coordinating", variant: "gensyn" },
  "execution-pending": { label: "Execution pending", variant: "warning" },
  "execution-complete": { label: "Complete", variant: "success" },
  failed: { label: "Failed", variant: "danger" },
};

export function TaskDetailClient({
  task: initialTask,
  events: initialEvents,
  execution: initialExecution,
}: {
  task: Task;
  events: CoordinationEvent[];
  execution: ExecutionResult | null;
}) {
  const [task, setTask] = useState(initialTask);
  const [events, setEvents] = useState(initialEvents);
  const [execution, setExecution] = useState(initialExecution);
  const [topology, setTopology] = useState<TopologySnapshot | null>(null);

  /* SSE subscription for real-time coordination events */
  useEffect(() => {
    const done =
      task.status === "execution-complete" || task.status === "failed";
    if (done) return;

    const es = new EventSource(`/api/stream/${task.id}`);

    es.onmessage = (e) => {
      try {
        const event: CoordinationEvent = JSON.parse(e.data);
        setEvents((prev) => {
          if (prev.find((x) => x.id === event.id)) return prev;
          return [...prev, event];
        });

        /* Update task status fields from event data */
        setTask((prev) => {
          const next = { ...prev, updatedAt: event.timestamp };
          if (event.type === "discovery.completed" && prev.status === "submitted")
            next.status = "discovering";
          if (
            event.type === "skill.invoked" &&
            (prev.status === "submitted" || prev.status === "discovering")
          )
            next.status = "coordinating";
          if (event.type === "skill.responded" && event.skill === "score_risk" && event.data) {
            const d = event.data as Record<string, unknown>;
            if (d.risk_score !== undefined) next.riskScore = d.risk_score as number;
            if (d.decision === "approved" || d.decision === "rejected") next.riskDecision = d.decision;
            if (d.rationale) next.finalSummary = d.rationale as string;
          }
          if (event.type === "execution.requested")
            next.status = "execution-pending";
          if (event.type === "execution.confirmed") {
            next.status = "execution-complete";
            const d = event.data as Record<string, unknown> | undefined;
            if (d?.txHash) next.executionTxHash = d.txHash as string;
            if (d?.workflowRunId)
              next.executionWorkflowRun = d.workflowRunId as string;
            setExecution({
              taskId: task.id,
              workflowId: "wf_demo",
              workflowRunId: (d?.workflowRunId as string) ?? "",
              txHash: d?.txHash as string | undefined,
              blockNumber: d?.blockNumber as number | undefined,
              gasUsed: d?.gasUsed as string | undefined,
              status: "succeeded",
              logs: (d?.logs as string[]) ?? [],
              chain: "base-sepolia",
              startedAt: new Date().toISOString(),
            });
          }
          if (event.type === "task.completed") {
            next.status = "execution-complete";
            const d = event.data as Record<string, unknown> | undefined;
            if (d?.auditSubname) next.auditSubname = d.auditSubname as string;
          }
          if (event.type === "audit.minted") {
            next.auditSubname = event.payloadPreview?.split(" ")[0];
          }
          if (event.type === "execution.failed") next.status = "failed";
          if (
            event.fromEns &&
            !next.participants.includes(event.fromEns)
          ) {
            next.participants = [...next.participants, event.fromEns];
          }
          return next;
        });
      } catch {
        /* ignore malformed messages */
      }
    };

    return () => es.close();
  }, [task.id, task.status]);

  /* Poll AXL topology every 5s */
  useEffect(() => {
    async function fetchTopology() {
      try {
        const res = await fetch("/api/topology");
        if (!res.ok) return;
        const data = await res.json();
        setTopology(data.topology ?? null);
      } catch {
        /* ignore */
      }
    }
    fetchTopology();
    const t = setInterval(fetchTopology, 5000);
    return () => clearInterval(t);
  }, []);

  const statusMeta = STATUS_BADGE[task.status];
  const isComplete = task.status === "execution-complete";

  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-8">
      {/* Breadcrumb + status */}
      <motion.div
        className="mb-6 flex flex-wrap items-center gap-3"
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
      >
        <Button asChild variant="ghost" size="sm">
          <Link href="/dashboard">
            <ArrowLeft className="h-4 w-4" />
            Dashboard
          </Link>
        </Button>
        <Separator orientation="vertical" className="h-4" />
        <span className="font-mono text-xs text-foreground-dim">{task.id}</span>
        <Badge variant={statusMeta.variant}>{statusMeta.label}</Badge>
        <span className="ml-auto font-mono text-xs text-foreground-dim">
          {relativeTime(task.createdAt)}
        </span>
      </motion.div>

      {/* Title */}
      <motion.div
        className="mb-8"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.05 }}
      >
        <h1 className="text-xl font-bold tracking-tight">{task.title}</h1>
        {task.prompt && (
          <p className="mt-2 max-w-3xl text-sm text-foreground-muted leading-relaxed">
            {task.prompt}
          </p>
        )}
      </motion.div>

      {/* Protocol breadcrumb */}
      <motion.div
        className="mb-8 flex flex-wrap items-center gap-2"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
      >
        {[
          { icon: Fingerprint, label: "ENS discovery", color: "text-ens", bg: "bg-ens-soft", border: "border-ens/30" },
          { icon: Network, label: "AXL coordination", color: "text-gensyn", bg: "bg-gensyn-soft", border: "border-gensyn/30" },
          { icon: Wrench, label: "KeeperHub execution", color: "text-keeperhub", bg: "bg-keeperhub-soft", border: "border-keeperhub/30" },
        ].map(({ icon: Icon, label, color, bg, border }) => (
          <span
            key={label}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-mono text-[11px]",
              bg,
              border,
              color
            )}
          >
            <Icon className="h-3 w-3" />
            {label}
          </span>
        ))}
      </motion.div>

      {/* Main grid */}
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        {/* Left: coordination timeline */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.1 }}
        >
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <Network className="h-4 w-4 text-gensyn" />
              Coordination timeline
            </h2>
            <Badge variant="gensyn" className="font-mono text-[10px]">
              {events.length} events
            </Badge>
          </div>
          <CoordinationTimeline events={events} />
        </motion.div>

        {/* Right: execution + topology + participants */}
        <div className="space-y-5">
          <motion.div
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.45, delay: 0.15 }}
          >
            <ExecutionPanel execution={execution} />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.45, delay: 0.2 }}
          >
            <TopologyWidget snapshot={topology} />
          </motion.div>

          {task.participants.length > 0 && (
            <motion.div
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.45, delay: 0.25 }}
            >
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <Cpu className="h-4 w-4 text-ens" />
                    Participating agents
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {task.participants.map((ens) => (
                    <div
                      key={ens}
                      className="flex items-center gap-2 rounded-md border border-border bg-card-elevated px-3 py-2"
                    >
                      <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-success" />
                      <span className="font-mono text-xs text-foreground">{ens}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </motion.div>
          )}
        </div>
      </div>

      {/* Final result / audit subname */}
      {isComplete && (
        <motion.div
          className="mt-8"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <Separator className="mb-8" />
          <div className="rounded-2xl border border-success/30 bg-success/5 p-8">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full border border-success/40 bg-success/10">
                <BadgeCheck className="h-5 w-5 text-success" />
              </div>
              <div>
                <div className="font-mono text-xs uppercase tracking-wider text-success">
                  Task complete
                </div>
                <h3 className="font-semibold text-foreground">{task.title}</h3>
              </div>
            </div>

            {task.finalSummary && (
              <p className="mb-6 text-sm leading-relaxed text-foreground-muted max-w-2xl">
                {task.finalSummary}
              </p>
            )}

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {task.riskScore !== undefined && (
                <Metric label="risk score" value={`${task.riskScore} / 10`} color="text-gensyn" />
              )}
              {task.riskDecision && (
                <Metric
                  label="decision"
                  value={task.riskDecision}
                  color={task.riskDecision === "approved" ? "text-success" : "text-danger"}
                />
              )}
              {task.participants.length > 0 && (
                <Metric label="agents" value={`${task.participants.length} participated`} color="text-ens" />
              )}
              {execution?.txHash && (
                <Metric label="tx" value={execution.txHash.slice(0, 12) + "…"} color="text-keeperhub" />
              )}
            </div>

            {task.auditSubname && (
              <div className="mt-6 rounded-xl border border-ens/40 bg-ens-soft/40 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="h-4 w-4 text-ens" />
                  <span className="font-mono text-xs uppercase tracking-wider text-ens">
                    Audit subname minted
                  </span>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <code className="font-mono text-sm text-foreground">
                    {task.auditSubname}
                  </code>
                  <a
                    href={`https://app.ens.domains/${task.auditSubname}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-ens hover:underline"
                  >
                    View on ENS App
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
                <p className="mt-2 text-xs text-foreground-muted">
                  Text records on this subname carry the full audit trail:{" "}
                  participant ENS names, KeeperHub tx hash, risk score, and
                  timestamps.
                </p>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </div>
  );
}
