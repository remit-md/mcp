import type { Tool } from "../types.js";

export const postBountyTool: Tool = {
  definition: {
    name: "post_bounty",
    description:
      "Post an open bounty that any agent can attempt to claim. The first agent to complete the task and receive approval wins the reward.",
    inputSchema: {
      type: "object",
      properties: {
        amount: { type: "number", description: "Bounty reward in USD" },
        task: { type: "string", description: "Detailed task description" },
        deadline: { type: "number", description: "Unix timestamp deadline for submissions" },
        validation: {
          type: "string",
          enum: ["poster", "oracle", "multisig"],
          description: "Who validates completion: poster (default), oracle, or multisig",
        },
        max_attempts: {
          type: "number",
          description: "Maximum submission attempts allowed (default: 10)",
        },
      },
      required: ["amount", "task", "deadline"],
    },
  },
  handler: async (args, wallet) => {
    const bounty = await wallet.postBounty({
      amount: args["amount"] as number,
      task: args["task"] as string,
      deadline: args["deadline"] as number,
      validation: args["validation"] as "poster" | "oracle" | "multisig" | undefined,
      maxAttempts: args["max_attempts"] as number | undefined,
    });
    return { success: true, bountyId: bounty.bountyId, status: bounty.status };
  },
};

export const awardBountyTool: Tool = {
  definition: {
    name: "award_bounty",
    description: "Award a bounty to a specific winner after reviewing their submission.",
    inputSchema: {
      type: "object",
      properties: {
        bounty_id: { type: "string", description: "Bounty ID to award" },
        winner: { type: "string", description: "Winner wallet address (0x...)" },
      },
      required: ["bounty_id", "winner"],
    },
  },
  handler: async (args, wallet) => {
    const tx = await wallet.awardBounty(
      args["bounty_id"] as string,
      args["winner"] as string,
    );
    return { success: true, txHash: tx.txHash, status: tx.status };
  },
};

export const bountyTools: Tool[] = [postBountyTool, awardBountyTool];
