"use client";

import { Network } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn, shorten } from "@/lib/utils";
import type { TopologySnapshot } from "@/lib/types";

export function TopologyWidget({ snapshot }: { snapshot: TopologySnapshot | null }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Network className="h-4 w-4 text-gensyn" />
          <span className="font-mono text-xs uppercase tracking-wider text-foreground-muted">
            AXL mesh
          </span>
        </div>
        {snapshot && (
          <Badge variant="gensyn">
            {snapshot.peers.filter((p) => p.reachable).length}/{snapshot.peers.length} peers
          </Badge>
        )}
      </div>
      {!snapshot ? (
        <div className="mt-4 text-center font-mono text-xs text-foreground-dim">
          Querying GET /topology…
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          <div className="flex items-center gap-2 rounded-md border border-gensyn/30 bg-gensyn-soft/30 px-3 py-2">
            <span className="h-2 w-2 rounded-full bg-gensyn" />
            <div className="flex-1">
              <div className="font-mono text-xs text-foreground">self</div>
              <div className="font-mono text-[10px] text-foreground-dim">
                {shorten(snapshot.selfPeerId, 8, 6)}
              </div>
            </div>
          </div>
          {snapshot.peers.map((peer) => (
            <div
              key={peer.peerId}
              className="flex items-center gap-2 rounded-md border border-border bg-card-elevated px-3 py-2"
            >
              <span
                className={cn(
                  "h-2 w-2 rounded-full",
                  peer.reachable ? "bg-success" : "bg-danger"
                )}
              />
              <div className="flex-1">
                <div className="font-mono text-xs text-foreground">
                  {peer.ensName ?? "anon"}
                </div>
                <div className="font-mono text-[10px] text-foreground-dim">
                  {shorten(peer.peerId, 8, 6)} · {peer.hops} hop
                  {peer.hops === 1 ? "" : "s"}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
