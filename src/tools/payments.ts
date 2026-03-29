import type { Tool } from "../types.js";
import {
  parseInput,
  PayDirectArgs,
  CreateEscrowArgs,
  ReleaseEscrowArgs,
  CancelEscrowArgs,
  ClaimStartArgs,
} from "./validate.js";
import { zodToMcpSchema } from "./schema.js";
import { autoPermitFor } from "./permit-helper.js";

export const payDirectTool: Tool = {
  definition: {
    name: "pay_direct",
    description:
      "Send a direct USDC payment to another agent or wallet. Use for tips, simple transfers, and one-off payments.",
    inputSchema: zodToMcpSchema(PayDirectArgs),
  },
  handler: async (args, wallet) => {
    const { to, amount, memo } = parseInput(PayDirectArgs, args);
    const permit = await autoPermitFor(wallet, "router", amount);
    const tx = await wallet.payDirect(to, amount, memo ?? "", permit ? { permit } : undefined);
    return { success: true, txHash: tx.txHash, status: tx.status };
  },
};

export const createEscrowTool: Tool = {
  definition: {
    name: "create_escrow",
    description:
      "Fund an escrow for a task or service. Funds are held until you release them. Use for freelance work, code review, content creation, etc.",
    inputSchema: zodToMcpSchema(CreateEscrowArgs),
  },
  handler: async (args, wallet) => {
    const { to, amount, task, timeout, milestones } = parseInput(CreateEscrowArgs, args);
    const permit = await autoPermitFor(wallet, "escrow", amount);
    const escrow = await wallet.pay(
      { to, amount, paymentType: "escrow", memo: task, timeout, milestones },
      permit ? { permit } : undefined,
    );
    return { success: true, invoiceId: escrow.invoiceId, txHash: escrow.txHash, status: escrow.status };
  },
};

export const releaseEscrowTool: Tool = {
  definition: {
    name: "release_escrow",
    description: "Release escrowed funds to the recipient after verifying task completion.",
    inputSchema: zodToMcpSchema(ReleaseEscrowArgs),
  },
  handler: async (args, wallet) => {
    const { invoice_id } = parseInput(ReleaseEscrowArgs, args);
    const tx = await wallet.releaseEscrow(invoice_id);
    return { success: true, txHash: tx.txHash, status: tx.status };
  },
};

export const cancelEscrowTool: Tool = {
  definition: {
    name: "cancel_escrow",
    description:
      "Cancel a funded escrow and return funds to the payer. " +
      "Only the payer can cancel, and only before the recipient claims.",
    inputSchema: zodToMcpSchema(CancelEscrowArgs),
  },
  handler: async (args, wallet) => {
    const { invoice_id } = parseInput(CancelEscrowArgs, args);
    const tx = await wallet.cancelEscrow(invoice_id);
    return { success: true, txHash: tx.txHash, status: tx.status };
  },
};

export const claimStartTool: Tool = {
  definition: {
    name: "claim_start",
    description:
      "Signal that work has started on an escrowed task. " +
      "Called by the recipient to indicate they have begun working. " +
      "Prevents the payer from cancelling the escrow.",
    inputSchema: zodToMcpSchema(ClaimStartArgs),
  },
  handler: async (args, wallet) => {
    const { invoice_id } = parseInput(ClaimStartArgs, args);
    const tx = await wallet.claimStart(invoice_id);
    return { success: true, txHash: tx.txHash, status: tx.status };
  },
};

export const paymentTools: Tool[] = [
  payDirectTool,
  createEscrowTool,
  releaseEscrowTool,
  cancelEscrowTool,
  claimStartTool,
];
