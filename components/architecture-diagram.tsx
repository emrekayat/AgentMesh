"use client";

import { motion } from "framer-motion";
import { Fingerprint, Network, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";

type Layer = {
  key: "ens" | "gensyn" | "keeperhub";
  title: string;
  protocol: string;
  description: string;
  bullets: string[];
  Icon: React.ComponentType<{ className?: string }>;
  accentClass: string;
  glowClass: string;
  borderClass: string;
};

const LAYERS: Layer[] = [
  {
    key: "ens",
    title: "Identity & Discovery",
    protocol: "ENS",
    description:
      "Every agent is an ENS subname. Capabilities, prices, peer IDs and roles live in text records.",
    bullets: [
      "subname-driven discovery",
      "text records as capabilities",
      "policy-by-ENS authorization",
    ],
    Icon: Fingerprint,
    accentClass: "text-ens",
    glowClass: "shadow-[0_0_48px_var(--ens-glow)]",
    borderClass: "border-ens/40",
  },
  {
    key: "gensyn",
    title: "Coordination & Transport",
    protocol: "Gensyn AXL",
    description:
      "Agents run as separate AXL nodes on a real encrypted P2P mesh. They negotiate and delegate via A2A — no central broker.",
    bullets: [
      "ed25519 peer identities",
      "A2A skill invocation",
      "live mesh topology",
    ],
    Icon: Network,
    accentClass: "text-gensyn",
    glowClass: "shadow-[0_0_48px_var(--gensyn-glow)]",
    borderClass: "border-gensyn/40",
  },
  {
    key: "keeperhub",
    title: "Execution & Settlement",
    protocol: "KeeperHub",
    description:
      "Approved intents fire pre-registered KeeperHub workflows. Multi-RPC, hardware-backed wallets, real onchain audit trails.",
    bullets: [
      "Turnkey-backed execution",
      "x402 micropayment rails",
      "Base Sepolia ready",
    ],
    Icon: Wrench,
    accentClass: "text-keeperhub",
    glowClass: "shadow-[0_0_48px_var(--keeperhub-glow)]",
    borderClass: "border-keeperhub/40",
  },
];

export function ArchitectureDiagram() {
  return (
    <div className="relative">
      <div className="grid gap-4 md:grid-cols-3">
        {LAYERS.map((layer, i) => (
          <motion.div
            key={layer.key}
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.55, delay: i * 0.12 }}
            className={cn(
              "group relative flex flex-col gap-4 overflow-hidden rounded-2xl border border-border bg-card p-6 transition",
              "hover:border-border-strong",
              layer.borderClass
            )}
          >
            <div
              className={cn(
                "absolute -right-12 -top-12 h-40 w-40 rounded-full blur-3xl opacity-30 transition group-hover:opacity-60",
                layer.glowClass
              )}
            />
            <div className="relative flex items-center justify-between">
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-foreground-dim">
                Layer {i + 1}
              </span>
              <span
                className={cn(
                  "font-mono text-[11px] uppercase tracking-[0.18em]",
                  layer.accentClass
                )}
              >
                {layer.protocol}
              </span>
            </div>
            <div className="relative flex items-start gap-3">
              <div
                className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border bg-card-elevated",
                  layer.borderClass
                )}
              >
                <layer.Icon className={cn("h-5 w-5", layer.accentClass)} />
              </div>
              <div>
                <h3 className="text-base font-semibold text-foreground">
                  {layer.title}
                </h3>
              </div>
            </div>
            <p className="relative text-sm leading-relaxed text-foreground-muted">
              {layer.description}
            </p>
            <ul className="relative mt-auto space-y-1.5 text-xs text-foreground-dim">
              {layer.bullets.map((b) => (
                <li key={b} className="flex items-center gap-2 font-mono">
                  <span
                    className={cn(
                      "h-1 w-1 rounded-full",
                      layer.accentClass.replace("text-", "bg-")
                    )}
                  />
                  {b}
                </li>
              ))}
            </ul>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
