// Tests for createWalletFromEnv() - CLI signer, OWS, and raw key paths.
//
// Verifies the env-var detection priority:
//   1. CLI signer — remit on PATH + keystore + REMIT_KEY_PASSWORD
//   2. OWS_WALLET_ID → OWS signer (via Wallet.withOws)
//   3. REMITMD_KEY → raw private key (via Wallet.fromEnv)
//   4. None → clear error mentioning all three options
//   5. REMIT_CLI_PATH → custom CLI binary path

import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { createWalletFromEnv } from "../src/signer.js";

const ENV_KEYS = [
  "REMIT_CLI_PATH",
  "REMIT_KEY_PASSWORD",
  "OWS_WALLET_ID",
  "REMITMD_KEY",
  "REMITMD_CHAIN",
  "OWS_API_KEY",
] as const;

describe("createWalletFromEnv", () => {
  const saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const k of ENV_KEYS) {
      saved[k] = process.env[k];
      delete process.env[k];
    }
  });

  afterEach(() => {
    for (const k of ENV_KEYS) {
      if (saved[k] !== undefined) process.env[k] = saved[k];
      else delete process.env[k];
    }
  });

  // ── No credentials ─────────────────────────────────────────────────────────

  it("throws when no credentials are set", async () => {
    await assert.rejects(createWalletFromEnv(), (err: Error) => {
      assert.match(err.message, /No signing method/);
      return true;
    });
  });

  it("error message includes all three config examples", async () => {
    await assert.rejects(createWalletFromEnv(), (err: Error) => {
      assert.match(err.message, /REMIT_KEY_PASSWORD/);
      assert.match(err.message, /OWS_WALLET_ID/);
      assert.match(err.message, /REMITMD_KEY/);
      assert.match(err.message, /REMITMD_CHAIN/);
      assert.match(err.message, /remit\.md\/install/);
      return true;
    });
  });

  // ── CLI Signer path ────────────────────────────────────────────────────────

  it("CLI signer is not used when remit binary is missing", async () => {
    // Set password but point to non-existent CLI — should fall through
    process.env["REMIT_KEY_PASSWORD"] = "test-password";
    process.env["REMIT_CLI_PATH"] = "nonexistent-remit-binary-xyz";

    // No OWS or REMITMD_KEY set, so should get the "no signing method" error
    await assert.rejects(createWalletFromEnv(), (err: Error) => {
      assert.match(err.message, /No signing method/);
      return true;
    });
  });

  it("REMIT_CLI_PATH is respected", async () => {
    // Point to a nonexistent path — CLI detection should fail gracefully
    process.env["REMIT_CLI_PATH"] = "/nonexistent/path/to/remit";
    process.env["REMIT_KEY_PASSWORD"] = "test-password";
    process.env["REMITMD_KEY"] =
      "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
    process.env["REMITMD_CHAIN"] = "base-sepolia";

    // CLI not found, so should fall through to REMITMD_KEY
    const wallet = await createWalletFromEnv();
    assert.equal(typeof wallet.address, "string");
    assert.ok(wallet.address.startsWith("0x"));
  });

  // ── OWS path ───────────────────────────────────────────────────────────────

  it("attempts OWS path when OWS_WALLET_ID is set", async () => {
    process.env["OWS_WALLET_ID"] = "test-wallet";

    // OWS is not installed in the test env, so this should fail with
    // a clear error about the missing package.
    await assert.rejects(createWalletFromEnv(), (err: Error) => {
      assert.match(err.message, /open-wallet-standard/i);
      assert.match(err.message, /not installed/i);
      return true;
    });
  });

  it("prefers OWS over raw key when both are set", async () => {
    process.env["OWS_WALLET_ID"] = "test-wallet";
    process.env["REMITMD_KEY"] =
      "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

    // Should attempt OWS path (not fall through to raw key), so we
    // expect the OWS-not-installed error - NOT a successful wallet.
    await assert.rejects(createWalletFromEnv(), (err: Error) => {
      assert.match(err.message, /open-wallet-standard/i);
      return true;
    });
  });

  // ── Raw key path ───────────────────────────────────────────────────────────

  it("creates wallet from REMITMD_KEY", async () => {
    // Anvil default key #0 - deterministic, safe for tests.
    process.env["REMITMD_KEY"] =
      "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
    process.env["REMITMD_CHAIN"] = "base-sepolia";

    const wallet = await createWalletFromEnv();
    assert.equal(typeof wallet.address, "string");
    assert.ok(wallet.address.startsWith("0x"));
    assert.equal(typeof wallet.balance, "function");
    assert.equal(typeof wallet.payDirect, "function");
    assert.equal(typeof wallet.x402Fetch, "function");
  });
});
