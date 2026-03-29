import type { Tool } from "../types.js";
import { zodToMcpSchema } from "./schema.js";
import { EmptyArgs } from "./validate.js";

export const createFundLinkTool: Tool = {
  definition: {
    name: "create_fund_link",
    description:
      "Generate a one-time URL for the operator to fund this wallet with USDC. " +
      "Returns a short-lived link that expires in 1 hour. Share with the operator - they open it in a browser to deposit funds.",
    inputSchema: zodToMcpSchema(EmptyArgs),
  },
  handler: async (_args, wallet) => {
    const link = await wallet.createFundLink();
    return {
      url: link.url,
      token: link.token,
      expiresAt: link.expiresAt,
      walletAddress: link.walletAddress,
    };
  },
};

export const createWithdrawLinkTool: Tool = {
  definition: {
    name: "create_withdraw_link",
    description:
      "Generate a one-time URL for the operator to withdraw USDC from this wallet. " +
      "Returns a short-lived link that expires in 1 hour. Share with the operator - they open it in a browser to pull funds out.",
    inputSchema: zodToMcpSchema(EmptyArgs),
  },
  handler: async (_args, wallet) => {
    const link = await wallet.createWithdrawLink();
    return {
      url: link.url,
      token: link.token,
      expiresAt: link.expiresAt,
      walletAddress: link.walletAddress,
    };
  },
};

export const linkTools: Tool[] = [createFundLinkTool, createWithdrawLinkTool];
