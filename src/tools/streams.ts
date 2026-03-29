import type { Tool } from "../types.js";
import { parseInput, OpenStreamArgs, CloseStreamArgs } from "./validate.js";
import { zodToMcpSchema } from "./schema.js";
import { autoPermitFor } from "./permit-helper.js";

export const openStreamTool: Tool = {
  definition: {
    name: "open_stream",
    description:
      "Start a continuous streaming payment to another wallet. Funds flow in real-time, second by second. Use for ongoing services, rent, or time-based work.",
    inputSchema: zodToMcpSchema(OpenStreamArgs),
  },
  handler: async (args, wallet) => {
    const { to, rate, max_duration, max_total } = parseInput(OpenStreamArgs, args);
    const maxTotal = max_total ?? rate * (max_duration ?? 3600);
    const permit = await autoPermitFor(wallet, "stream", maxTotal);
    const stream = await wallet.openStream({ to, rate, maxDuration: max_duration, maxTotal: max_total, ...(permit ? { permit } : {}) });
    return {
      success: true,
      streamId: stream.id,
      rate: stream.ratePerSecond,
      status: stream.status,
    };
  },
};

export const closeStreamTool: Tool = {
  definition: {
    name: "close_stream",
    description: "Stop a streaming payment and settle the final amount.",
    inputSchema: zodToMcpSchema(CloseStreamArgs),
  },
  handler: async (args, wallet) => {
    const { stream_id } = parseInput(CloseStreamArgs, args);
    const tx = await wallet.closeStream(stream_id);
    return { success: true, txHash: tx.txHash, status: tx.status };
  },
};

export const streamTools: Tool[] = [openStreamTool, closeStreamTool];
