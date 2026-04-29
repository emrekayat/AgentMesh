/**
 * HTTP client for a single AXL node's local API (127.0.0.1:{port}).
 *
 * POST /send          — fire-and-forget binary message to peer
 * GET  /recv          — poll for inbound raw messages
 * POST /a2a/{peer_id} — send A2A JSON-RPC request to remote peer
 * GET  /topology      — mesh state of this node
 */
import { nanoid } from "nanoid";
import type {
  A2AMessage,
  A2AResponse,
  SendResult,
  TopologyResponse,
} from "./types";

export class AXLClient {
  private baseUrl: string;

  constructor(port: number, host = "127.0.0.1") {
    this.baseUrl = `http://${host}:${port}`;
  }

  /** Get this node's topology / peer list */
  async getTopology(): Promise<TopologyResponse> {
    const res = await fetch(`${this.baseUrl}/topology`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new Error(`AXL topology error: ${res.status}`);
    return res.json();
  }

  /**
   * Send raw bytes to a remote peer.
   * peerId must be the 64-char hex-encoded ed25519 public key.
   */
  async send(peerId: string, body: string): Promise<SendResult> {
    const res = await fetch(`${this.baseUrl}/send`, {
      method: "POST",
      headers: { "X-Destination-Peer-Id": peerId },
      body,
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) throw new Error(`AXL send error: ${res.status}`);
    const sentBytes = parseInt(res.headers.get("X-Sent-Bytes") ?? "0", 10);
    return { sentBytes };
  }

  /**
   * Poll for a single inbound raw message.
   * Returns null if the queue is empty (204).
   */
  async recv(): Promise<{ fromPeerId: string; body: ArrayBuffer } | null> {
    const res = await fetch(`${this.baseUrl}/recv`, {
      signal: AbortSignal.timeout(5000),
    });
    if (res.status === 204) return null;
    if (!res.ok) throw new Error(`AXL recv error: ${res.status}`);
    const fromPeerId = res.headers.get("X-From-Peer-Id") ?? "";
    const body = await res.arrayBuffer();
    return { fromPeerId, body };
  }

  /**
   * Send an A2A JSON-RPC request to a remote peer.
   * This is the primary communication method for inter-agent delegation.
   *
   * peerId: 64-char hex public key of the destination peer
   * method: A2A method name (e.g. "SendMessage")
   * payload: skill name + inner request
   */
  async sendA2A(
    peerId: string,
    skill: string,
    payload: Record<string, unknown>,
    timeoutMs = 30000
  ): Promise<A2AResponse> {
    const message: A2AMessage = {
      jsonrpc: "2.0",
      method: "SendMessage",
      id: nanoid(),
      params: {
        message: {
          role: "ROLE_USER",
          parts: [
            {
              text: JSON.stringify({
                service: skill,
                request: {
                  jsonrpc: "2.0",
                  method: skill,
                  id: nanoid(),
                  params: payload,
                },
              }),
            },
          ],
          messageId: nanoid(),
        },
      },
    };

    const res = await fetch(`${this.baseUrl}/a2a/${peerId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(message),
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`AXL A2A error ${res.status}: ${text}`);
    }

    return res.json();
  }

  get url() {
    return this.baseUrl;
  }
}

/* Pre-built clients for each node in the stack */
export const axlClients = {
  orchestrator: new AXLClient(9002),
  research: new AXLClient(9003),
  risk: new AXLClient(9004),
  execution: new AXLClient(9005),
} as const;
