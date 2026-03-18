/**
 * Auto-permit helper for MCP tool handlers.
 *
 * Signs an EIP-2612 USDC permit if the wallet supports it.
 * Falls back gracefully for mock wallets (no signPermit method).
 */

import type { PermitSignature, WalletLike } from "../types.js";

/**
 * Sign a USDC permit for the given spender contract.
 *
 * Returns undefined if the wallet doesn't support signPermit
 * (e.g. mock wallets in unit tests).
 */
export async function autoPermit(
  wallet: WalletLike,
  spender: string,
  amount: number,
): Promise<PermitSignature | undefined> {
  if (!wallet.signPermit) return undefined;
  return wallet.signPermit(spender, amount);
}

/**
 * Get the spender address for a given contract type.
 * Returns undefined if the wallet doesn't support getContracts.
 */
export async function getSpender(
  wallet: WalletLike,
  contract: "router" | "escrow" | "tab" | "stream" | "bounty" | "deposit",
): Promise<string | undefined> {
  if (!wallet.getContracts) return undefined;
  const contracts = await wallet.getContracts();
  switch (contract) {
    case "router":
      return contracts.router;
    case "escrow":
      return contracts.escrow;
    case "tab":
      return contracts.tab;
    case "stream":
      return contracts.stream;
    case "bounty":
      return contracts.bounty;
    case "deposit":
      return contracts.deposit;
  }
}

/**
 * Auto-sign a permit for a named contract. Returns undefined for mocks.
 */
export async function autoPermitFor(
  wallet: WalletLike,
  contract: "router" | "escrow" | "tab" | "stream" | "bounty" | "deposit",
  amount: number,
): Promise<PermitSignature | undefined> {
  const spender = await getSpender(wallet, contract);
  if (!spender) return undefined;
  return autoPermit(wallet, spender, amount);
}
