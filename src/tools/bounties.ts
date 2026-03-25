import type { Tool } from "../types.js";
import { parseInput, PostBountyArgs, AwardBountyArgs } from "./validate.js";
import { autoPermitFor } from "./permit-helper.js";

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
        permit: {
          type: "object",
          description:
            "Optional EIP-2612 permit signature for gasless USDC approval to the Bounty contract",
          properties: {
            value: { type: "number", description: "Approved amount in USDC base units" },
            deadline: { type: "number", description: "Permit deadline (Unix timestamp)" },
            v: { type: "number", description: "Recovery byte" },
            r: { type: "string", description: "Signature r component (0x-prefixed 32 bytes)" },
            s: { type: "string", description: "Signature s component (0x-prefixed 32 bytes)" },
          },
          required: ["value", "deadline", "v", "r", "s"],
        },
      },
      required: ["amount", "task", "deadline"],
    },
  },
  handler: async (args, wallet) => {
    const { amount, task, deadline, validation, max_attempts, permit } = parseInput(PostBountyArgs, args);
    const autoSigned = permit ?? (await autoPermitFor(wallet, "bounty", amount));
    const bounty = await wallet.postBounty({ amount, task, deadline, validation, maxAttempts: max_attempts, permit: autoSigned });
    return { success: true, bountyId: bounty.id, status: bounty.status };
  },
};

export const awardBountyTool: Tool = {
  definition: {
    name: "award_bounty",
    description: "Award a bounty to a specific submission after reviewing it.",
    inputSchema: {
      type: "object",
      properties: {
        bounty_id: { type: "string", description: "Bounty ID to award" },
        submission_id: { type: "number", description: "Submission index to award (0-based)" },
      },
      required: ["bounty_id", "submission_id"],
    },
  },
  handler: async (args, wallet) => {
    const { bounty_id, submission_id } = parseInput(AwardBountyArgs, args);
    const tx = await wallet.awardBounty(bounty_id, submission_id);
    return { success: true, txHash: tx.txHash, status: tx.status };
  },
};

export const bountyTools: Tool[] = [postBountyTool, awardBountyTool];
