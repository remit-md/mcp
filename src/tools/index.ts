import { paymentTools } from "./payments.js";
import { tabTools } from "./tabs.js";
import { streamTools } from "./streams.js";
import { bountyTools } from "./bounties.js";
import { depositTools } from "./deposits.js";
import { statusTools } from "./status.js";
import { x402Tools } from "./x402.js";
import type { Tool, WalletLike } from "../types.js";

export const ALL_TOOLS: Tool[] = [
  ...paymentTools,
  ...tabTools,
  ...streamTools,
  ...bountyTools,
  ...depositTools,
  ...statusTools,
  ...x402Tools,
];

export const toolRegistry: Map<string, Tool> = new Map(
  ALL_TOOLS.map((t) => [t.definition.name, t]),
);

export async function callTool(
  name: string,
  args: Record<string, unknown>,
  wallet: WalletLike,
): Promise<unknown> {
  const tool = toolRegistry.get(name);
  if (!tool) throw new Error(`Unknown tool: ${name}`);
  return tool.handler(args, wallet);
}
