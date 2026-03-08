import type { Tool } from "../types.js";

export const openTabTool: Tool = {
  definition: {
    name: "open_tab",
    description:
      "Open a metered payment tab with a service provider. The provider can charge per-unit (per API call, per token, per query, etc.) up to your spend limit.",
    inputSchema: {
      type: "object",
      properties: {
        to: { type: "string", description: "Service provider wallet address (0x...)" },
        limit: { type: "number", description: "Maximum spend limit in USD" },
        per_unit: { type: "number", description: "Cost per unit in USD (e.g. 0.003 per API call)" },
        expires: {
          type: "number",
          description: "Seconds until tab expires (default: 86400 = 1 day)",
        },
      },
      required: ["to", "limit", "per_unit"],
    },
  },
  handler: async (args, wallet) => {
    const tab = await wallet.openTab({
      to: args["to"] as string,
      limit: args["limit"] as number,
      perUnit: args["per_unit"] as number,
      expires: args["expires"] as number | undefined,
    });
    return {
      success: true,
      tabId: tab.tabId,
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
    inputSchema: {
      type: "object",
      properties: {
        tab_id: { type: "string", description: "Tab ID to close" },
      },
      required: ["tab_id"],
    },
  },
  handler: async (args, wallet) => {
    const tx = await wallet.closeTab(args["tab_id"] as string);
    return { success: true, txHash: tx.txHash, status: tx.status };
  },
};

export const tabTools: Tool[] = [openTabTool, closeTabTool];
