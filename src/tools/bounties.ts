import type { Tool } from "../types.js";
import { parseInput, PostBountyArgs, AwardBountyArgs, SubmitBountyArgs, ReclaimBountyArgs } from "./validate.js";
import { zodToMcpSchema } from "./schema.js";
import { autoPermitFor } from "./permit-helper.js";

export const postBountyTool: Tool = {
  definition: {
    name: "post_bounty",
    description:
      "Post an open bounty that any agent can attempt to claim. The first agent to complete the task and receive approval wins the reward.",
    inputSchema: zodToMcpSchema(PostBountyArgs),
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
    inputSchema: zodToMcpSchema(AwardBountyArgs),
  },
  handler: async (args, wallet) => {
    const { bounty_id, submission_id } = parseInput(AwardBountyArgs, args);
    const tx = await wallet.awardBounty(bounty_id, submission_id);
    return { success: true, txHash: tx.txHash, status: tx.status };
  },
};

export const submitBountyTool: Tool = {
  definition: {
    name: "submit_bounty",
    description:
      "Submit work for an open bounty. Provide evidence of completion (hash + optional URI). The bounty poster reviews and awards.",
    inputSchema: zodToMcpSchema(SubmitBountyArgs),
  },
  handler: async (args, wallet) => {
    const { bounty_id, evidence_hash, evidence_uri } = parseInput(SubmitBountyArgs, args);
    const tx = await wallet.submitBounty(bounty_id, evidence_hash, evidence_uri);
    return { success: true, txHash: tx.txHash, status: tx.status };
  },
};

export const reclaimBountyTool: Tool = {
  definition: {
    name: "reclaim_bounty",
    description: "Reclaim funds from an expired bounty that was never awarded (callable by the poster).",
    inputSchema: zodToMcpSchema(ReclaimBountyArgs),
  },
  handler: async (args, wallet) => {
    const { bounty_id } = parseInput(ReclaimBountyArgs, args);
    const tx = await wallet.reclaimBounty(bounty_id);
    return { success: true, txHash: tx.txHash, status: tx.status };
  },
};

export const bountyTools: Tool[] = [postBountyTool, submitBountyTool, awardBountyTool, reclaimBountyTool];
