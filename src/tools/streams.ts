import type { Tool } from "../types.js";
import { parseInput, OpenStreamArgs, CloseStreamArgs } from "./validate.js";

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
    const { to, rate, max_duration, max_total } = parseInput(OpenStreamArgs, args);
    const stream = await wallet.openStream({ to, rate, maxDuration: max_duration, maxTotal: max_total });
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
    const { stream_id } = parseInput(CloseStreamArgs, args);
    const tx = await wallet.closeStream(stream_id);
    return { success: true, txHash: tx.txHash, status: tx.status };
  },
};

export const streamTools: Tool[] = [openStreamTool, closeStreamTool];
