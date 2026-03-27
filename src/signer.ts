/**
 * Key management for the MCP server.
 *
 * Supports three wallet backends (checked in this priority order):
 *   1. HTTP Signer - local signing server.
 *      Set REMIT_SIGNER_URL and REMIT_SIGNER_TOKEN.
 *   2. OWS (Open Wallet Standard) - encrypted local vault, policy-gated signing.
 *      Set OWS_WALLET_ID (and optionally OWS_API_KEY).
 *   3. Raw private key - set REMITMD_KEY.
 *
 * When multiple are set, the highest-priority backend wins (with a warning).
 * The key/wallet never appears in tool responses, resource contents, or logs.
 */

// Dynamic import to avoid loading @remitmd/sdk in test environments
// that only import server/tools/resources/prompts directly.

import type { WalletLike } from "./types.js";
import { isWalletLike } from "./types.js";

/**
 * Create a WalletLike from environment variables.
 *
 * Detection priority: REMIT_SIGNER_URL > OWS_WALLET_ID > REMITMD_KEY > error.
 * @throws if no credentials are set, or if the SDK Wallet is missing required methods.
 */
export async function createWalletFromEnv(): Promise<WalletLike> {
  const signerUrl = process.env["REMIT_SIGNER_URL"];
  const signerToken = process.env["REMIT_SIGNER_TOKEN"];
  const owsWalletId = process.env["OWS_WALLET_ID"];
  const remitKey = process.env["REMITMD_KEY"];

  if (!signerUrl && !owsWalletId && !remitKey) {
    throw new Error(
      "REMIT_SIGNER_URL, OWS_WALLET_ID, or REMITMD_KEY environment variable is required.\n" +
        "Add to your MCP server configuration:\n\n" +
        '  Signer: "env": { "REMIT_SIGNER_URL": "http://127.0.0.1:7402", "REMIT_SIGNER_TOKEN": "rmit_sk_...", "REMITMD_CHAIN": "base" }\n' +
        '  OWS:    "env": { "OWS_WALLET_ID": "remit-my-agent", "REMITMD_CHAIN": "base" }\n' +
        '  Raw key: "env": { "REMITMD_KEY": "0x...", "REMITMD_CHAIN": "base" }',
    );
  }

  // Lazy import: only loads @remitmd/sdk when the server actually starts.
  const { Wallet } = await import("@remitmd/sdk");

  let wallet;

  if (signerUrl) {
    // HTTP Signer - highest priority.
    if (owsWalletId || remitKey) {
      console.warn(
        "[remit-mcp] REMIT_SIGNER_URL is set - ignoring " +
          (owsWalletId ? "OWS_WALLET_ID" : "REMITMD_KEY"),
      );
    }
    if (!signerToken) {
      throw new Error(
        "REMIT_SIGNER_TOKEN is required when REMIT_SIGNER_URL is set.\n" +
          "Add it to your MCP server env: " +
          '"REMIT_SIGNER_TOKEN": "rmit_sk_..."',
      );
    }
    wallet = await Wallet.withSigner({ url: signerUrl, token: signerToken });
  } else if (owsWalletId) {
    wallet = await Wallet.withOws({ walletId: owsWalletId });
  } else {
    wallet = Wallet.fromEnv();
  }

  if (!isWalletLike(wallet)) {
    throw new Error(
      "SDK Wallet is missing methods required by the WalletLike interface. " +
        "Check that @remitmd/sdk is up to date.",
    );
  }
  return wallet;
}
