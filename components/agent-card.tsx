"use client";

import { motion } from "framer-motion";
import { BadgeCheck, Cpu, Coins, Radio } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { cn, shorten } from "@/lib/utils";
import type { Agent } from "@/lib/types";

const ROLE_VARIANT: Record<Agent["role"], "ens" | "gensyn" | "keeperhub"> = {
  researcher: "ens",
  evaluator: "gensyn",
  executor: "keeperhub",
};

export function AgentCard({ agent }: { agent: Agent }) {
  const roleVariant = ROLE_VARIANT[agent.role];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <Card className="group relative overflow-hidden p-5 transition hover:border-border-strong">
        <div
          className={cn(
            "absolute -right-10 -top-10 h-32 w-32 rounded-full blur-3xl opacity-20 transition group-hover:opacity-40",
            roleVariant === "ens" && "bg-ens",
            roleVariant === "gensyn" && "bg-gensyn",
            roleVariant === "keeperhub" && "bg-keeperhub"
          )}
        />

        <div className="relative flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-border-strong bg-background">
              <Cpu className="h-5 w-5 text-foreground-muted" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-mono text-sm font-medium text-foreground">
                  {agent.ensName}
                </span>
                {agent.attestation && (
                  <BadgeCheck className="h-3.5 w-3.5 text-success" />
                )}
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  agent.online ? "bg-success" : "bg-foreground-dim"
                )} />
                <span className="font-mono text-[10px] uppercase tracking-wider text-foreground-dim">
                  {agent.online ? "online" : "offline"}
                </span>
              </div>
            </div>
          </div>
          <Badge variant={roleVariant}>{agent.role}</Badge>
        </div>

        <p className="relative mt-4 text-sm leading-relaxed text-foreground-muted">
          {agent.description}
        </p>

        <div className="relative mt-4 flex flex-wrap gap-1.5">
          {agent.capabilities.map((cap) => (
            <Badge key={cap} variant="outline">
              {cap}
            </Badge>
          ))}
        </div>

        <div className="relative mt-5 grid grid-cols-2 gap-3 border-t border-border pt-4">
          <Stat
            icon={<Radio className="h-3 w-3" />}
            label="AXL peer"
            value={shorten(agent.axlPeerId, 6, 4)}
          />
          <Stat
            icon={<Coins className="h-3 w-3" />}
            label="price / task"
            value={`${agent.pricePerTaskUsdc.toFixed(2)} USDC`}
          />
        </div>

        {agent.skills.length > 0 && (
          <div className="relative mt-4">
            <div className="font-mono text-[10px] uppercase tracking-wider text-foreground-dim">
              A2A skills
            </div>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {agent.skills.map((s) => (
                <span
                  key={s}
                  className="rounded-md border border-border bg-card-elevated px-2 py-0.5 font-mono text-[11px] text-foreground-muted"
                >
                  {s}
                </span>
              ))}
            </div>
          </div>
        )}
      </Card>
    </motion.div>
  );
}

function Stat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-foreground-dim">
        {icon}
        <span className="font-mono text-[10px] uppercase tracking-wider">
          {label}
        </span>
      </div>
      <div className="mt-0.5 font-mono text-xs text-foreground">{value}</div>
    </div>
  );
}
