/**
 * Key management for the MCP server.
 *
 * The private key is loaded once from the environment and wrapped in a Wallet.
 * It never appears in tool responses, resource contents, or logs.
 */

// Dynamic import to avoid loading @remitmd/sdk in test environments
// that only import server/tools/resources/prompts directly.

import type { WalletLike } from "./types.js";
import { isWalletLike } from "./types.js";

/**
 * Create a WalletLike from REMITMD_KEY + REMITMD_CHAIN environment variables.
 * @throws if REMITMD_KEY is not set or SDK Wallet is missing required methods.
 */
export async function createWalletFromEnv(): Promise<WalletLike> {
  const key = process.env["REMITMD_KEY"];
  if (!key) {
    throw new Error(
      "REMITMD_KEY environment variable is required.\n" +
        "Add it to your MCP server configuration:\n\n" +
        '  "env": { "REMITMD_KEY": "0x...", "REMITMD_CHAIN": "base" }',
    );
  }

  // Lazy import: only loads @remitmd/sdk when the server actually starts.
  const { Wallet } = await import("@remitmd/sdk");
  const wallet = Wallet.fromEnv();
  if (!isWalletLike(wallet)) {
    throw new Error(
      "SDK Wallet is missing methods required by the WalletLike interface. " +
        "Check that @remitmd/sdk is up to date.",
    );
  }
  return wallet;
}
