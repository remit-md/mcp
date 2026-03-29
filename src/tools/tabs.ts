import type { Tool } from "../types.js";
import { parseInput, OpenTabArgs, CloseTabArgs } from "./validate.js";
import { zodToMcpSchema } from "./schema.js";
import { autoPermitFor } from "./permit-helper.js";

export const openTabTool: Tool = {
  definition: {
    name: "open_tab",
    description:
      "Open a metered payment tab with a service provider. The provider can charge per-unit (per API call, per token, per query, etc.) up to your spend limit.",
    inputSchema: zodToMcpSchema(OpenTabArgs),
  },
  handler: async (args, wallet) => {
    const { to, limit, per_unit, expires } = parseInput(OpenTabArgs, args);
    const permit = await autoPermitFor(wallet, "tab", limit);
    const tab = await wallet.openTab({ to, limit, perUnit: per_unit, expires, ...(permit ? { permit } : {}) });
    return {
      success: true,
      tabId: tab.id,
      limit: tab.limit,
      perUnit: tab.perUnit,
      expiresAt: tab.expiresAt,
    };
  },
};

export const closeTabTool: Tool = {
  definition: {
    name: "close_tab",
    description: "Close and settle a metered payment tab.",
    inputSchema: zodToMcpSchema(CloseTabArgs),
  },
  handler: async (args, wallet) => {
    const { tab_id } = parseInput(CloseTabArgs, args);
    const tx = await wallet.closeTab(tab_id);
    return { success: true, txHash: tx.txHash, status: tx.status };
  },
};

export const tabTools: Tool[] = [openTabTool, closeTabTool];
