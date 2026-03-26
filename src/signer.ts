/**
 * Key management for the MCP server.
 *
 * Supports two wallet backends:
 *   1. OWS (Open Wallet Standard) — encrypted local vault, policy-gated signing.
 *      Set OWS_WALLET_ID (and optionally OWS_API_KEY).
 *   2. Raw private key — set REMITMD_KEY.
 *
 * When both are set, OWS takes priority (with a warning).
 * The key/wallet never appears in tool responses, resource contents, or logs.
 */

// Dynamic import to avoid loading @remitmd/sdk in test environments
// that only import server/tools/resources/prompts directly.

import type { WalletLike } from "./types.js";
import { isWalletLike } from "./types.js";

/**
 * Create a WalletLike from environment variables.
 *
 * Detection priority: OWS_WALLET_ID > REMITMD_KEY > error.
 * @throws if neither is set, or if the SDK Wallet is missing required methods.
 */
export async function createWalletFromEnv(): Promise<WalletLike> {
  const owsWalletId = process.env["OWS_WALLET_ID"];
  const remitKey = process.env["REMITMD_KEY"];

  if (!owsWalletId && !remitKey) {
    throw new Error(
      "REMITMD_KEY or OWS_WALLET_ID environment variable is required.\n" +
        "Add to your MCP server configuration:\n\n" +
        '  Raw key:  "env": { "REMITMD_KEY": "0x...", "REMITMD_CHAIN": "base" }\n' +
        '  OWS:      "env": { "OWS_WALLET_ID": "remit-my-agent", "REMITMD_CHAIN": "base" }',
    );
  }

  // Lazy import: only loads @remitmd/sdk when the server actually starts.
  const { Wallet } = await import("@remitmd/sdk");

  const wallet = owsWalletId
    ? await Wallet.withOws({ walletId: owsWalletId })
    : Wallet.fromEnv();

  if (!isWalletLike(wallet)) {
    throw new Error(
      "SDK Wallet is missing methods required by the WalletLike interface. " +
        "Check that @remitmd/sdk is up to date.",
    );
  }
  return wallet;
}
