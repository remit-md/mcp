import type { Tool } from "../types.js";

export const placeDepositTool: Tool = {
  definition: {
    name: "place_deposit",
    description:
      "Place a refundable security deposit with another wallet. The deposit is returned if terms are met, or forfeited if you violate the agreement.",
    inputSchema: {
      type: "object",
      properties: {
        to: { type: "string", description: "Deposit holder wallet address (0x...)" },
        amount: { type: "number", description: "Deposit amount in USD" },
        expires: {
          type: "number",
          description: "Seconds until deposit auto-expires and is returned to you",
        },
      },
      required: ["to", "amount", "expires"],
    },
  },
  handler: async (args, wallet) => {
    const deposit = await wallet.placeDeposit({
      to: args["to"] as string,
      amount: args["amount"] as number,
      expires: args["expires"] as number,
    });
    return { success: true, depositId: deposit.depositId, status: deposit.status };
  },
};

export const depositTools: Tool[] = [placeDepositTool];
