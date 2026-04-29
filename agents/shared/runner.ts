/**
 * AgentRunner — base class for each agent process.
 *
 * Responsibilities:
 *   1. Runs a lightweight HTTP server on `a2aPort` to receive forwarded A2A messages
 *      from the local AXL node (configured via `a2a_addr` in node config)
 *   2. Dispatches incoming A2A requests to registered skill handlers
 *   3. Provides `emit()` to push coordination events back to the Next.js app
 *
 * Each agent process (research-alpha, risk-sentinel, execution-node) extends
 * this class, registers its skills, and calls `start()`.
 */
import { createServer, IncomingMessage, ServerResponse } from "http";
import type { CoordinationEvent } from "@/lib/types";

export type SkillHandler = (
  params: Record<string, unknown>,
  fromPeerId?: string
) => Promise<unknown>;

export class AgentRunner {
  private skills = new Map<string, SkillHandler>();
  private server = createServer(this.handleRequest.bind(this));

  constructor(
    protected readonly ensName: string,
    protected readonly axlPort: number,
    protected readonly a2aPort: number
  ) {}

  /** Register an A2A skill handler */
  skill(name: string, handler: SkillHandler): this {
    this.skills.set(name, handler);
    return this;
  }

  /** Start the A2A HTTP server */
  start(): void {
    this.server.listen(this.a2aPort, "127.0.0.1", () => {
      const names = [...this.skills.keys()].join(", ");
      console.log(
        `[${this.ensName}] A2A server listening on :${this.a2aPort} (skills: ${names})`
      );
    });
    this.server.on("error", (err) => {
      console.error(`[${this.ensName}] A2A server error:`, err);
    });
  }

  /** Push a coordination event to the Next.js app store via its internal API */
  protected async emit(event: Omit<CoordinationEvent, "id" | "timestamp">): Promise<void> {
    const { nanoid } = await import("nanoid");
    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    try {
      await fetch(`${appUrl}/api/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...event,
          id: nanoid(),
          timestamp: new Date().toISOString(),
        }),
      });
    } catch {
      /* non-fatal — the UI just won't get this event */
    }
  }

  private async handleRequest(
    req: IncomingMessage,
    res: ServerResponse
  ): Promise<void> {
    if (req.method !== "POST") {
      res.writeHead(405);
      res.end();
      return;
    }

    const body = await readBody(req);
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(body);
    } catch {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "invalid_json" }));
      return;
    }

    /* AXL wraps A2A in SendMessage format; extract the inner service request */
    const innerText =
      (parsed.params as Record<string, unknown> | undefined)
        ?.message &&
      (
        (
          (parsed.params as Record<string, unknown>).message as Record<
            string,
            unknown
          >
        ).parts as Array<{ text: string }> | undefined
      )?.[0]?.text;

    let skill: string;
    let skillParams: Record<string, unknown>;

    if (innerText) {
      try {
        const inner = JSON.parse(innerText as string) as {
          service: string;
          request: { method: string; params: Record<string, unknown> };
        };
        skill = inner.service ?? inner.request.method;
        skillParams = inner.request.params ?? {};
      } catch {
        skill = (parsed.method as string) ?? "";
        skillParams = (parsed.params as Record<string, unknown>) ?? {};
      }
    } else {
      skill = (parsed.method as string) ?? "";
      skillParams = (parsed.params as Record<string, unknown>) ?? {};
    }

    const fromPeerId =
      (req.headers["x-from-peer-id"] as string | undefined) ?? undefined;

    const handler = this.skills.get(skill);
    if (!handler) {
      console.warn(`[${this.ensName}] Unknown skill: ${skill}`);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          jsonrpc: "2.0",
          id: parsed.id,
          error: { code: -32601, message: `Unknown skill: ${skill}` },
        })
      );
      return;
    }

    console.log(`[${this.ensName}] ← ${skill} (from ${fromPeerId?.slice(0, 12) ?? "?"}…)`);

    try {
      const result = await handler(skillParams, fromPeerId);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          jsonrpc: "2.0",
          id: parsed.id,
          result,
        })
      );
      console.log(`[${this.ensName}] → ${skill} responded`);
    } catch (err) {
      console.error(`[${this.ensName}] ${skill} error:`, err);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          jsonrpc: "2.0",
          id: parsed.id,
          error: {
            code: -32603,
            message: err instanceof Error ? err.message : "Internal error",
          },
        })
      );
    }
  }
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
    req.on("error", reject);
  });
}
