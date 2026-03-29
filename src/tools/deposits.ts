import type { Tool } from "../types.js";
import { parseInput, PlaceDepositArgs, ReturnDepositArgs, ForfeitDepositArgs } from "./validate.js";
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

export const returnDepositTool: Tool = {
  definition: {
    name: "return_deposit",
    description: "Return a deposit to the depositor (callable by the provider). Use when the depositor met all terms.",
    inputSchema: zodToMcpSchema(ReturnDepositArgs),
  },
  handler: async (args, wallet) => {
    const { deposit_id } = parseInput(ReturnDepositArgs, args);
    const tx = await wallet.returnDeposit(deposit_id);
    return { success: true, txHash: tx.txHash, status: tx.status };
  },
};

export const forfeitDepositTool: Tool = {
  definition: {
    name: "forfeit_deposit",
    description:
      "Forfeit a deposit — the provider keeps the funds. Use when the depositor violated the agreement terms.",
    inputSchema: zodToMcpSchema(ForfeitDepositArgs),
  },
  handler: async (args, wallet) => {
    const { deposit_id } = parseInput(ForfeitDepositArgs, args);
    const tx = await wallet.forfeitDeposit(deposit_id);
    return { success: true, txHash: tx.txHash, status: tx.status };
  },
};

export const depositTools: Tool[] = [placeDepositTool, returnDepositTool, forfeitDepositTool];
