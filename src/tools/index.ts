import { paymentTools } from "./payments.js";
import { tabTools } from "./tabs.js";
import { streamTools } from "./streams.js";
import { bountyTools } from "./bounties.js";
import { depositTools } from "./deposits.js";
import { statusTools } from "./status.js";
import { x402Tools, createX402Tools } from "./x402.js";
import type { X402Config } from "./x402.js";
import { linkTools } from "./links.js";
import { webhookTools } from "./webhooks.js";
import type { Tool, WalletLike } from "../types.js";

export type { X402Config };

/** Default tools list (uses module-level x402 config — for backward compat / tests). */
export const ALL_TOOLS: Tool[] = [
  ...paymentTools,
  ...tabTools,
  ...streamTools,
  ...bountyTools,
  ...depositTools,
  ...statusTools,
  ...x402Tools,
  ...linkTools,
  ...webhookTools,
];

/** Build a tools list with a per-instance x402 config captured in closure. */
export function buildTools(x402Config: X402Config): Tool[] {
  return [
    ...paymentTools,
    ...tabTools,
    ...streamTools,
    ...bountyTools,
    ...depositTools,
    ...statusTools,
    ...createX402Tools(x402Config),
    ...linkTools,
    ...webhookTools,
  ];
}

export const toolRegistry: Map<string, Tool> = new Map(
  ALL_TOOLS.map((t) => [t.definition.name, t]),
);

export function buildToolRegistry(tools: Tool[]): Map<string, Tool> {
  return new Map(tools.map((t) => [t.definition.name, t]));
}

export async function callTool(
  name: string,
  args: Record<string, unknown>,
  wallet: WalletLike,
  registry?: Map<string, Tool>,
): Promise<unknown> {
  const reg = registry ?? toolRegistry;
  const tool = reg.get(name);
  if (!tool) throw new Error(`Unknown tool: ${name}`);
  return tool.handler(args, wallet);
}
