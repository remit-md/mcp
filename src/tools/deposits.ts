import type { Tool } from "../types.js";
import { parseInput, PlaceDepositArgs } from "./validate.js";
import { autoPermitFor } from "./permit-helper.js";

export const placeDepositTool: Tool = {
  definition: {
    name: "place_deposit",
    description:
      "Place a refundable security deposit with another wallet. The deposit is returned if terms are met, or forfeited if you violate the agreement.",
    inputSchema: {
      type: "object",
      properties: {
        to: { type: "string", description: "Deposit holder wallet address (0x...)" },
        amount: { type: "number", description: "Deposit amount in USD" },
        expires: {
          type: "number",
          description: "Seconds until deposit auto-expires and is returned to you",
        },
        permit: {
          type: "object",
          description:
            "Optional EIP-2612 permit signature for gasless USDC approval to the Deposit contract",
          properties: {
            value: { type: "number", description: "Approved amount in USDC base units" },
            deadline: { type: "number", description: "Permit deadline (Unix timestamp)" },
            v: { type: "number", description: "Recovery byte" },
            r: { type: "string", description: "Signature r component (0x-prefixed 32 bytes)" },
            s: { type: "string", description: "Signature s component (0x-prefixed 32 bytes)" },
          },
          required: ["value", "deadline", "v", "r", "s"],
        },
      },
      required: ["to", "amount", "expires"],
    },
  },
  handler: async (args, wallet) => {
    const { to, amount, expires, permit } = parseInput(PlaceDepositArgs, args);
    const autoSigned = permit ?? (await autoPermitFor(wallet, "deposit", amount));
    const deposit = await wallet.placeDeposit({ to, amount, expires, permit: autoSigned });
    return { success: true, depositId: deposit.depositId, status: deposit.status };
  },
};

export const depositTools: Tool[] = [placeDepositTool];
