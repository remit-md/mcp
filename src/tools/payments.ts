import type { Tool } from "../types.js";
import {
  parseInput,
  PayDirectArgs,
  CreateEscrowArgs,
  ReleaseEscrowArgs,
  CancelEscrowArgs,
  ClaimStartArgs,
} from "./validate.js";
import { autoPermitFor } from "./permit-helper.js";

export const payDirectTool: Tool = {
  definition: {
    name: "pay_direct",
    description:
      "Send a direct USDC payment to another agent or wallet. Use for tips, simple transfers, and one-off payments.",
    inputSchema: {
      type: "object",
      properties: {
        to: { type: "string", description: "Recipient wallet address (0x...)" },
        amount: { type: "number", description: "Amount in USD (e.g. 1.50)" },
        memo: { type: "string", description: "Optional payment memo or note" },
      },
      required: ["to", "amount"],
    },
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
    inputSchema: {
      type: "object",
      properties: {
        to: { type: "string", description: "Recipient wallet address (0x...)" },
        amount: { type: "number", description: "Total amount in USD to escrow" },
        task: { type: "string", description: "Description of the task or service" },
        timeout: {
          type: "number",
          description: "Seconds until escrow auto-cancels if unclaimed (e.g. 86400 = 1 day)",
        },
        milestones: {
          type: "array",
          description: "Optional milestone breakdown. If omitted, full amount is released at once.",
          items: {
            type: "object",
            properties: {
              amount: { type: "number" },
              description: { type: "string" },
            },
            required: ["amount", "description"],
          },
        },
      },
      required: ["to", "amount", "task", "timeout"],
    },
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
    inputSchema: {
      type: "object",
      properties: {
        invoice_id: { type: "string", description: "Invoice ID of the escrow to release" },
      },
      required: ["invoice_id"],
    },
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
    inputSchema: {
      type: "object",
      properties: {
        invoice_id: { type: "string", description: "Invoice ID of the escrow to cancel" },
      },
      required: ["invoice_id"],
    },
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
    inputSchema: {
      type: "object",
      properties: {
        invoice_id: { type: "string", description: "Invoice ID of the escrow to claim" },
      },
      required: ["invoice_id"],
    },
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
