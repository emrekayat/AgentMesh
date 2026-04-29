/** AXL HTTP API types */

export type TopologyResponse = {
  our_ipv6: string;
  our_public_key: string;
  peers: TopologyPeerRaw[];
  tree: unknown[];
};

export type TopologyPeerRaw = {
  addr: string;
  public_key: string;
  last_seen?: string;
};

export type A2AMessage = {
  jsonrpc: "2.0";
  method: string;
  id: string | number;
  params: {
    message: {
      role: "ROLE_USER";
      parts: Array<{ text: string }>;
      messageId: string;
    };
  };
};

export type A2AResponse = {
  jsonrpc: "2.0";
  id: string | number;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
};

export type SendResult = { sentBytes: number };
