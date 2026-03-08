import type { Tool } from "../types.js";

export const checkBalanceTool: Tool = {
  definition: {
    name: "check_balance",
    description: "Check your current USDC wallet balance.",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  handler: async (_args, wallet) => {
    const bal = await wallet.balance();
    return { balance: bal, currency: "USDC", address: wallet.address };
  },
};

export const getStatusTool: Tool = {
  definition: {
    name: "get_status",
    description:
      "Get your wallet status: balance, reputation tier, active escrows, open tabs, and streams.",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  handler: async (_args, wallet) => {
    const s = await wallet.status();
    return {
      address: s.address,
      balance: s.usdcBalance,
      tier: s.tier,
      totalVolume: s.totalVolume,
      activeEscrows: s.escrowsActive,
      openTabs: s.openTabs,
      activeStreams: s.activeStreams,
    };
  },
};

export const statusTools: Tool[] = [checkBalanceTool, getStatusTool];
