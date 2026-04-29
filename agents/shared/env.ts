import "dotenv/config";

export const env = {
  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? "",
  keeperhubApiKey: process.env.KEEPERHUB_API_KEY ?? "",
  keeperhubApiUrl:
    process.env.KEEPERHUB_API_URL ?? "https://api.keeperhub.com/v1",
  keeperhubWorkflowId:
    process.env.KEEPERHUB_WORKFLOW_ID ?? "wf_eth_swap_base_sepolia",
  nextAppUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
} as const;
