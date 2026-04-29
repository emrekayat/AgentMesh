"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  CheckCircle2,
  CircleDot,
  Fingerprint,
  Network,
  Wrench,
  XCircle,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn, formatTimestamp, shorten } from "@/lib/utils";
import type { CoordinationEvent } from "@/lib/types";

const LAYER_META = {
  ens: { Icon: Fingerprint, color: "text-ens", border: "border-ens/30" },
  gensyn: { Icon: Network, color: "text-gensyn", border: "border-gensyn/30" },
  keeperhub: {
    Icon: Wrench,
    color: "text-keeperhub",
    border: "border-keeperhub/30",
  },
  system: {
    Icon: CircleDot,
    color: "text-foreground-muted",
    border: "border-border",
  },
} as const;

const TYPE_ICON: Partial<
  Record<CoordinationEvent["type"], React.ComponentType<{ className?: string }>>
> = {
  "execution.confirmed": CheckCircle2,
  "task.completed": CheckCircle2,
  "execution.failed": XCircle,
  "audit.minted": Sparkles,
};

export function CoordinationTimeline({
  events,
  emptyMessage = "Waiting for the orchestrator to dispatch the task…",
}: {
  events: CoordinationEvent[];
  emptyMessage?: string;
}) {
  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card-elevated/30 px-6 py-16 text-center">
        <div className="font-mono text-xs text-foreground-dim">
          {emptyMessage}
        </div>
        <div className="cursor-blink mt-2 text-foreground-muted" />
      </div>
    );
  }

  return (
    <ol className="relative space-y-3">
      <span className="absolute left-[19px] top-3 bottom-3 w-px bg-border" aria-hidden />
      <AnimatePresence initial={false}>
        {events.map((event) => {
          const layerMeta = LAYER_META[event.layer];
          const TypeIcon = TYPE_ICON[event.type] ?? layerMeta.Icon;
          return (
            <motion.li
              key={event.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="relative flex gap-3"
            >
              <div
                className={cn(
                  "relative z-10 mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border bg-background",
                  layerMeta.border
                )}
              >
                <TypeIcon className={cn("h-4 w-4", layerMeta.color)} />
              </div>
              <div className="flex-1 rounded-lg border border-border bg-card p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs text-foreground">
                      {event.type}
                    </span>
                    <Badge
                      variant={
                        event.layer === "system" ? "default" : event.layer
                      }
                    >
                      {event.layer}
                    </Badge>
                  </div>
                  <span className="font-mono text-[10px] text-foreground-dim">
                    {formatTimestamp(event.timestamp)}
                  </span>
                </div>
                {(event.fromEns || event.toEns) && (
                  <div className="mt-2 flex flex-wrap items-center gap-2 font-mono text-xs">
                    {event.fromEns && (
                      <span className="rounded-md bg-card-elevated px-2 py-0.5 text-foreground-muted">
                        {event.fromEns}
                      </span>
                    )}
                    {event.fromEns && event.toEns && (
                      <ArrowRight className="h-3 w-3 text-foreground-dim" />
                    )}
                    {event.toEns && (
                      <span className="rounded-md bg-card-elevated px-2 py-0.5 text-foreground-muted">
                        {event.toEns}
                      </span>
                    )}
                    {event.skill && (
                      <span className="ml-1 rounded-md border border-border-strong px-2 py-0.5 text-foreground">
                        {event.skill}()
                      </span>
                    )}
                  </div>
                )}
                {event.payloadPreview && (
                  <div className="mt-2 line-clamp-2 font-mono text-[11px] text-foreground-dim">
                    {event.payloadPreview}
                  </div>
                )}
                {(event.fromPeerId || event.toPeerId) && (
                  <div className="mt-2 flex items-center gap-1.5 font-mono text-[10px] text-foreground-dim">
                    <span>peers:</span>
                    {event.fromPeerId && <span>{shorten(event.fromPeerId, 6, 4)}</span>}
                    {event.toPeerId && <span>→ {shorten(event.toPeerId, 6, 4)}</span>}
                  </div>
                )}
              </div>
            </motion.li>
          );
        })}
      </AnimatePresence>
    </ol>
  );
}
