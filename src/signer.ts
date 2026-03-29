/**
 * Key management for the MCP server.
 *
 * Supports three wallet backends (checked in this priority order):
 *   1. CLI Signer - `remit sign` subprocess.
 *      Keychain: `remit` on PATH + `~/.remit/keys/default.meta` (no password needed).
 *      Encrypted: `remit` on PATH + `~/.remit/keys/default.enc` + REMIT_SIGNER_KEY (or REMIT_KEY_PASSWORD).
 *      Override CLI path with REMIT_CLI_PATH for npx environments.
 *   2. OWS (Open Wallet Standard) - encrypted local vault, policy-gated signing.
 *      Set OWS_WALLET_ID (and optionally OWS_API_KEY).
 *   3. Raw private key - set REMITMD_KEY.
 *
 * When multiple are set, the highest-priority backend wins (with a warning).
 * The key/wallet never appears in tool responses, resource contents, or logs.
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

import type { WalletLike } from "./types.js";
import { isWalletLike } from "./types.js";

const execFileAsync = promisify(execFile);

/**
 * Check if the CLI signer is available.
 * 1. CLI binary responds to `--version`
 * 2a. Keychain: ~/.remit/keys/default.meta exists (no password needed)
 * 2b. Encrypted: ~/.remit/keys/default.enc exists + REMIT_SIGNER_KEY set (or REMIT_KEY_PASSWORD)
 */
async function isCliAvailable(cliPath: string): Promise<boolean> {
  try {
    await execFileAsync(cliPath, ["--version"], { timeout: 5000 });
    // Keychain path: .meta file exists (no password needed)
    const metaPath = join(homedir(), ".remit", "keys", "default.meta");
    if (existsSync(metaPath)) return true;
    // Encrypted file path: .enc + password
    const keystorePath = join(homedir(), ".remit", "keys", "default.enc");
    if (!existsSync(keystorePath)) return false;
    if (!(process.env["REMIT_SIGNER_KEY"] ?? process.env["REMIT_KEY_PASSWORD"])) return false;
    return true;
  } catch {
    return false;
  }
}

/**
 * Create a WalletLike from environment variables.
 *
 * Detection priority: CLI signer > OWS_WALLET_ID > REMITMD_KEY > error.
 * @throws if no credentials are set, or if the SDK Wallet is missing required methods.
 */
export async function createWalletFromEnv(): Promise<WalletLike> {
  const cliPath = process.env["REMIT_CLI_PATH"] ?? "remit";
  const owsWalletId = process.env["OWS_WALLET_ID"];
  const remitKey = process.env["REMITMD_KEY"];

  // Lazy import: only loads @remitmd/sdk when the server actually starts.
  const { Wallet } = await import("@remitmd/sdk");

  let wallet;

  // Priority 1: CLI signer (encrypted keystore — most secure)
  if (await isCliAvailable(cliPath)) {
    if (owsWalletId || remitKey) {
      console.warn(
        "[remit-mcp] CLI signer detected - ignoring " +
          (owsWalletId ? "OWS_WALLET_ID" : "REMITMD_KEY"),
      );
    }
    // Use SDK's async factory if available, otherwise fall through.
    // Dynamic check: withCli/fromEnvironment may not exist in older SDK versions.
    type WalletStatic = Record<string, ((...args: unknown[]) => Promise<unknown>) | undefined>;
    const W = Wallet as unknown as WalletStatic;
    if (typeof W["fromEnvironment"] === "function") {
      wallet = await W["fromEnvironment"]();
    } else if (typeof W["withCli"] === "function") {
      wallet = await W["withCli"]({ cliPath });
    } else {
      // SDK too old for CLI signer — inform user
      throw new Error(
        "CLI signer detected but @remitmd/sdk does not support it yet.\n" +
          "Update: npm install @remitmd/sdk@latest\n" +
          "Or set REMITMD_KEY as a fallback.",
      );
    }
  } else if (owsWalletId) {
    // Priority 2: OWS (unchanged)
    wallet = await Wallet.withOws({ walletId: owsWalletId });
  } else if (remitKey) {
    // Priority 3: Raw private key (legacy)
    // Construct directly to avoid SDK's CLI detection in fromEnv()
    wallet = new Wallet({ privateKey: remitKey as `0x${string}`, testnet: true });
  } else {
    throw new Error(
      "No signing method available.\n" +
        "Add to your MCP server configuration:\n\n" +
        '  CLI:     "env": { "REMIT_SIGNER_KEY": "...", "REMITMD_CHAIN": "base" }  (requires remit CLI installed)\n' +
        '  OWS:     "env": { "OWS_WALLET_ID": "remit-my-agent", "REMITMD_CHAIN": "base" }\n' +
        '  Raw key: "env": { "REMITMD_KEY": "0x...", "REMITMD_CHAIN": "base" }\n\n' +
        "Install CLI: https://remit.md/install",
    );
  }

  if (!isWalletLike(wallet)) {
    throw new Error(
      "SDK Wallet is missing methods required by the WalletLike interface. " +
        "Check that @remitmd/sdk is up to date.",
    );
  }
  return wallet;
}
