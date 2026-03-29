/**
 * Auto-permit helper for MCP tool handlers.
 *
 * Signs an EIP-2612 USDC permit via the SDK's signPermit() method,
 * which calls the server's /permits/prepare endpoint internally.
 */

import type { PermitSignature, WalletLike } from "../types.js";

/** Map contract name → flow name for /permits/prepare. */
const CONTRACT_TO_FLOW: Record<string, string> = {
  router: "direct",
  escrow: "escrow",
  tab: "tab",
  stream: "stream",
  bounty: "bounty",
  deposit: "deposit",
};

/**
 * Auto-sign a permit for a named contract. Returns undefined for mocks.
 *
 * Maps the contract name to a flow name and calls wallet.signPermit().
 * The SDK handles /permits/prepare + hash signing internally.
 */
export async function autoPermitFor(
  wallet: WalletLike,
  contract: "router" | "escrow" | "tab" | "stream" | "bounty" | "deposit",
  amount: number,
): Promise<PermitSignature | undefined> {
  if (!wallet.signPermit) return undefined;
  const flow = CONTRACT_TO_FLOW[contract];
  if (!flow) return undefined;
  return wallet.signPermit(flow, amount);
}
