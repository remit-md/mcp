import type { Tool } from "../types.js";

export const openStreamTool: Tool = {
  definition: {
    name: "open_stream",
    description:
      "Start a continuous streaming payment to another wallet. Funds flow in real-time, second by second. Use for ongoing services, rent, or time-based work.",
    inputSchema: {
      type: "object",
      properties: {
        to: { type: "string", description: "Recipient wallet address (0x...)" },
        rate: { type: "number", description: "Payment rate in USD per second (e.g. 0.001)" },
        max_duration: {
          type: "number",
          description: "Maximum duration in seconds (default: 3600 = 1 hour)",
        },
        max_total: { type: "number", description: "Optional maximum total spend in USD" },
      },
      required: ["to", "rate"],
    },
  },
  handler: async (args, wallet) => {
    const stream = await wallet.openStream({
      to: args["to"] as string,
      rate: args["rate"] as number,
      maxDuration: args["max_duration"] as number | undefined,
      maxTotal: args["max_total"] as number | undefined,
    });
    return {
      success: true,
      streamId: stream.streamId,
      rate: stream.rate,
      status: stream.status,
    };
  },
};

export const closeStreamTool: Tool = {
  definition: {
    name: "close_stream",
    description: "Stop a streaming payment and settle the final amount.",
    inputSchema: {
      type: "object",
      properties: {
        stream_id: { type: "string", description: "Stream ID to close" },
      },
      required: ["stream_id"],
    },
  },
  handler: async (args, wallet) => {
    const tx = await wallet.closeStream(args["stream_id"] as string);
    return { success: true, txHash: tx.txHash, status: tx.status };
  },
};

export const streamTools: Tool[] = [openStreamTool, closeStreamTool];
