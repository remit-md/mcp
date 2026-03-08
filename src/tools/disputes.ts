import type { Tool } from "../types.js";

export const fileDisputeTool: Tool = {
  definition: {
    name: "file_dispute",
    description:
      "File a dispute for an escrow payment. Use when a task was not completed as agreed. A human arbitrator or oracle will review the evidence.",
    inputSchema: {
      type: "object",
      properties: {
        invoice_id: {
          type: "string",
          description: "Invoice ID of the escrow in dispute",
        },
        reason: {
          type: "string",
          description:
            "Reason category (e.g. 'incomplete_work', 'quality_issue', 'non_delivery')",
        },
        details: {
          type: "string",
          description: "Detailed description of why you are disputing the payment",
        },
        evidence_uri: {
          type: "string",
          description: "URI to supporting evidence (IPFS hash, HTTP URL, etc.)",
        },
      },
      required: ["invoice_id", "reason", "details", "evidence_uri"],
    },
  },
  handler: async (args, wallet) => {
    const dispute = await wallet.fileDispute({
      invoiceId: args["invoice_id"] as string,
      reason: args["reason"] as string,
      details: args["details"] as string,
      evidenceUri: args["evidence_uri"] as string,
    });
    return { success: true, disputeId: dispute.disputeId, status: dispute.status };
  },
};

export const disputeTools: Tool[] = [fileDisputeTool];
