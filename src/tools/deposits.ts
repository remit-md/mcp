import type { Tool } from "../types.js";
import { parseInput, PlaceDepositArgs } from "./validate.js";
import { zodToMcpSchema } from "./schema.js";
import { autoPermitFor } from "./permit-helper.js";

export const placeDepositTool: Tool = {
  definition: {
    name: "place_deposit",
    description:
      "Place a refundable security deposit with another wallet. The deposit is returned if terms are met, or forfeited if you violate the agreement.",
    inputSchema: zodToMcpSchema(PlaceDepositArgs),
  },
  handler: async (args, wallet) => {
    const { to, amount, expires, permit } = parseInput(PlaceDepositArgs, args);
    const autoSigned = permit ?? (await autoPermitFor(wallet, "deposit", amount));
    const deposit = await wallet.placeDeposit({ to, amount, expires, permit: autoSigned });
    return { success: true, depositId: deposit.id, status: deposit.status };
  },
};

export const depositTools: Tool[] = [placeDepositTool];
