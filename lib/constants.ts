export const AGENT_BAZAAR = {
  parentEns: "agentbazaar.eth",
  auditNamespace: "tasks.agentbazaar.eth",
  chains: {
    primary: "base-sepolia",
    chainId: 84532,
    explorer: "https://sepolia.basescan.org",
  },
  axl: {
    orchestratorPort: 9002,
    researchPort: 9003,
    riskPort: 9004,
    executionPort: 9005,
  },
} as const;

export const PROTOCOL_COLORS = {
  ens: {
    text: "text-ens",
    bg: "bg-ens",
    bgSoft: "bg-ens-soft",
    border: "border-ens/40",
    glow: "glow-ens",
  },
  gensyn: {
    text: "text-gensyn",
    bg: "bg-gensyn",
    bgSoft: "bg-gensyn-soft",
    border: "border-gensyn/40",
    glow: "glow-gensyn",
  },
  keeperhub: {
    text: "text-keeperhub",
    bg: "bg-keeperhub",
    bgSoft: "bg-keeperhub-soft",
    border: "border-keeperhub/40",
    glow: "glow-keeperhub",
  },
} as const;

export type Protocol = keyof typeof PROTOCOL_COLORS;
