import type { Tool } from "../types.js";

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
    const to = args["to"] as string;
    const amount = args["amount"] as number;
    const memo = (args["memo"] as string | undefined) ?? "";
    const tx = await wallet.payDirect(to, amount, memo);
    return { success: true, txHash: tx.txHash, status: tx.status };
  },
};

export const createEscrowTool: Tool = {
  definition: {
    name: "create_escrow",
    description:
      "Fund an escrow for a task or service. Funds are held until you release them or a dispute is resolved. Use for freelance work, code review, content creation, etc.",
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
    const to = args["to"] as string;
    const amount = args["amount"] as number;
    const task = args["task"] as string;
    const timeout = args["timeout"] as number;
    const milestones = args["milestones"] as
      | Array<{ amount: number; description: string }>
      | undefined;
    const tx = await wallet.pay({ to, amount, type: "escrow", memo: task, timeout, milestones });
    return { success: true, invoiceId: tx.invoiceId, txHash: tx.txHash, status: tx.status };
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
    const invoiceId = args["invoice_id"] as string;
    const tx = await wallet.releaseEscrow(invoiceId);
    return { success: true, txHash: tx.txHash, status: tx.status };
  },
};

export const paymentTools: Tool[] = [payDirectTool, createEscrowTool, releaseEscrowTool];
