import type { Tool } from "../types.js";

export const createSubscriptionTool: Tool = {
  definition: {
    name: "create_subscription",
    description:
      "Subscribe to a recurring service. Automatically renews at the specified interval.",
    inputSchema: {
      type: "object",
      properties: {
        to: { type: "string", description: "Service provider wallet address (0x...)" },
        amount: { type: "number", description: "Amount per billing period in USD" },
        interval: {
          type: "string",
          enum: ["daily", "weekly", "monthly", "yearly"],
          description: "Billing interval (default: monthly)",
        },
        max_periods: {
          type: "number",
          description: "Optional maximum number of billing periods before auto-cancellation",
        },
      },
      required: ["to", "amount"],
    },
  },
  handler: async (args, wallet) => {
    const sub = await wallet.subscribe({
      to: args["to"] as string,
      amount: args["amount"] as number,
      interval: args["interval"] as "daily" | "weekly" | "monthly" | "yearly" | undefined,
      maxPeriods: args["max_periods"] as number | undefined,
    });
    return { success: true, subscriptionId: sub.subscriptionId, status: sub.status };
  },
};

export const cancelSubscriptionTool: Tool = {
  definition: {
    name: "cancel_subscription",
    description: "Cancel an active recurring subscription.",
    inputSchema: {
      type: "object",
      properties: {
        subscription_id: { type: "string", description: "Subscription ID to cancel" },
      },
      required: ["subscription_id"],
    },
  },
  handler: async (args, wallet) => {
    const tx = await wallet.cancelSubscription(args["subscription_id"] as string);
    return { success: true, txHash: tx.txHash, status: tx.status };
  },
};

export const subscriptionTools: Tool[] = [createSubscriptionTool, cancelSubscriptionTool];
