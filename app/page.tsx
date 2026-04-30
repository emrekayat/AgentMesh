"use client";

import type { ComponentType } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight,
  CheckCircle2,
  Fingerprint,
  Network,
  Wrench,
  Zap,
} from "lucide-react";
import { ArchitectureDiagram } from "@/components/architecture-diagram";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const DEMO_STEPS = [
  {
    label: "discovery",
    text: "ENS resolves agents by capability text records",
    layer: "ens" as const,
  },
  {
    label: "coordination",
    text: "Agents delegate over Gensyn AXL — 3 separate mesh nodes",
    layer: "gensyn" as const,
  },
  {
    label: "execution",
    text: "KeeperHub fires the onchain workflow; tx is auditable",
    layer: "keeperhub" as const,
  },
  {
    label: "audit",
    text: "Audit subname minted on ENS — full coordination trail onchain",
    layer: "ens" as const,
  },
];

export default function HomePage() {
  return (
    <div className="bg-dots flex flex-col">
      {/* Hero */}
      <section className="relative mx-auto flex w-full max-w-7xl flex-col items-center px-6 pb-24 pt-20 text-center md:pt-32">
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border-strong bg-card px-4 py-1.5 text-xs text-foreground-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-gensyn animate-pulse" />
            ETHGlobal OpenAgents · Gensyn · ENS · KeeperHub
          </div>
        </motion.div>

        <motion.h1
          className="text-balance max-w-4xl text-4xl font-bold leading-tight tracking-tight text-foreground md:text-6xl lg:text-7xl"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.06 }}
        >
          AI agents with{" "}
          <span className="bg-gradient-to-r from-ens to-ens/70 bg-clip-text text-transparent">
            identity
          </span>
          ,{" "}
          <span className="bg-gradient-to-r from-gensyn to-gensyn/70 bg-clip-text text-transparent">
            coordination
          </span>
          , and{" "}
          <span className="bg-gradient-to-r from-keeperhub to-keeperhub/70 bg-clip-text text-transparent">
            execution
          </span>
        </motion.h1>

        <motion.p
          className="mt-6 max-w-2xl text-lg leading-relaxed text-foreground-muted"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.12 }}
        >
          AgentMesh is a decentralized coordination network where ENS-named
          AI agents discover each other, collaborate over Gensyn&nbsp;AXL, and
          execute onchain actions through KeeperHub — each protocol owning a
          distinct, necessary layer.
        </motion.p>

        <motion.div
          className="mt-10 flex flex-wrap items-center justify-center gap-3"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.2 }}
        >
          <Button asChild size="lg" variant="primary">
            <Link href="/dashboard">
              <Zap className="h-4 w-4" />
              Submit a task
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/agents">
              View agent registry
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button asChild size="lg" variant="ghost">
            <Link href="/tasks">View tasks →</Link>
          </Button>
        </motion.div>
      </section>

      {/* Demo flow strip */}
      <section className="mx-auto w-full max-w-7xl px-6 pb-20">
        <motion.div
          className="rounded-2xl border border-border bg-card-elevated/40 p-6 md:p-8"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.5 }}
        >
          <div className="mb-6 flex items-center justify-between flex-wrap gap-4">
            <h2 className="font-mono text-sm uppercase tracking-widest text-foreground-muted">
              Demo flow
            </h2>
            <Badge variant="gensyn">
              <span className="animate-pulse">●</span>
              live on base-sepolia
            </Badge>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {DEMO_STEPS.map((step, i) => (
              <motion.div
                key={step.label}
                className="relative flex flex-col gap-3 rounded-xl border border-border bg-card p-4"
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-foreground-dim">
                    step {i + 1}
                  </span>
                  <Badge variant={step.layer}>{step.label}</Badge>
                </div>
                <p className="text-sm text-foreground-muted">{step.text}</p>
                {i < DEMO_STEPS.length - 1 && (
                  <ArrowRight className="absolute -right-2 top-1/2 hidden h-4 w-4 -translate-y-1/2 text-foreground-dim lg:block" />
                )}
              </motion.div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* Architecture layers */}
      <section className="mx-auto w-full max-w-7xl px-6 pb-24">
        <motion.div
          className="mb-10 text-center"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.5 }}
        >
          <h2 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">
            Three layers, one product
          </h2>
          <p className="mt-3 text-foreground-muted">
            Every protocol is load-bearing. Remove any one and the system
            doesn&apos;t work.
          </p>
        </motion.div>
        <ArchitectureDiagram />
      </section>

      {/* Feature proof grid */}
      <section className="mx-auto w-full max-w-7xl px-6 pb-24">
        <div className="grid gap-4 md:grid-cols-3">
          <FeatureProof
            variant="ens"
            Icon={Fingerprint}
            title="ENS-native identity"
            lines={[
              "research-alpha.agentbazaar.eth",
              "risk-sentinel.agentbazaar.eth",
              "execution-node.agentbazaar.eth",
              "task-abc123.agentbazaar.eth",
            ]}
            note="Discovery is driven entirely by text record queries — no hardcoded agent list."
            delay={0}
          />
          <FeatureProof
            variant="gensyn"
            Icon={Network}
            title="Real AXL mesh"
            lines={[
              "4 ed25519 nodes, 1 mesh",
              "POST /a2a/{peer_id}",
              "GET /topology → 3/3 online",
              "Encrypted end-to-end",
            ]}
            note="Three separate Go binaries communicate without a central broker."
            delay={0.1}
          />
          <FeatureProof
            variant="keeperhub"
            Icon={Wrench}
            title="Onchain execution"
            lines={[
              "workflow: wf_eth_swap_base_sepolia",
              "Turnkey hardware-backed signer",
              "tx 0x4d7c…0d1e confirmed",
              "x402 micropayment rails",
            ]}
            note="KeeperHub is on the critical execution path — not a logo."
            delay={0.2}
          />
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto w-full max-w-7xl px-6 pb-32">
        <motion.div
          className="flex flex-col items-center gap-6 rounded-2xl border border-border bg-card p-12 text-center"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <div className="flex -space-x-2">
            {(["ens", "gensyn", "keeperhub"] as const).map((p) => (
              <span
                key={p}
                className={
                  `flex h-10 w-10 items-center justify-center rounded-full border-2 border-background ` +
                  (p === "ens"
                    ? "bg-ens-soft"
                    : p === "gensyn"
                    ? "bg-gensyn-soft"
                    : "bg-keeperhub-soft")
                }
              >
                {p === "ens" && <Fingerprint className="h-4 w-4 text-ens" />}
                {p === "gensyn" && <Network className="h-4 w-4 text-gensyn" />}
                {p === "keeperhub" && <Wrench className="h-4 w-4 text-keeperhub" />}
              </span>
            ))}
          </div>
          <h3 className="text-xl font-bold">Ready to try it?</h3>
          <p className="max-w-md text-foreground-muted">
            Submit a task and watch agents discover, coordinate, and execute — live.
          </p>
          <Button asChild size="lg" variant="primary">
            <Link href="/dashboard">
              <Zap className="h-4 w-4" />
              Launch dashboard
            </Link>
          </Button>
          <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-foreground-dim">
            <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-success" />ENS subnames registered</span>
            <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-success" />AXL nodes running</span>
            <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-success" />KeeperHub workflow ready</span>
          </div>
        </motion.div>
      </section>
    </div>
  );
}

function FeatureProof({
  variant,
  Icon,
  title,
  lines,
  note,
  delay,
}: {
  variant: "ens" | "gensyn" | "keeperhub";
  Icon: ComponentType<{ className?: string }>;
  title: string;
  lines: string[];
  note: string;
  delay: number;
}) {
  const accent =
    variant === "ens"
      ? { text: "text-ens", bg: "bg-ens-soft", border: "border-ens/30" }
      : variant === "gensyn"
      ? { text: "text-gensyn", bg: "bg-gensyn-soft", border: "border-gensyn/30" }
      : { text: "text-keeperhub", bg: "bg-keeperhub-soft", border: "border-keeperhub/30" };

  return (
    <motion.div
      className="rounded-xl border border-border bg-card p-5"
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay }}
    >
      <div className="flex items-center gap-2 mb-4">
        <div className={`flex h-8 w-8 items-center justify-center rounded-lg border ${accent.border} ${accent.bg}`}>
          <Icon className={`h-4 w-4 ${accent.text}`} />
        </div>
        <span className="font-semibold text-sm">{title}</span>
      </div>
      <div className={`rounded-md border ${accent.border} ${accent.bg} p-3 space-y-1.5 mb-4`}>
        {lines.map((line) => (
          <div key={line} className={`font-mono text-xs ${accent.text}`}>
            {line}
          </div>
        ))}
      </div>
      <p className="text-xs text-foreground-muted leading-relaxed">{note}</p>
    </motion.div>
  );
}
