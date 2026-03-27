// Tests for createWalletFromEnv() - HTTP signer, OWS, and raw key paths.
//
// Verifies the env-var detection priority:
//   1. REMIT_SIGNER_URL + REMIT_SIGNER_TOKEN → HTTP signer (via Wallet.withSigner)
//   2. OWS_WALLET_ID → OWS signer (via Wallet.withOws)
//   3. REMITMD_KEY → raw private key (via Wallet.fromEnv)
//   4. None → clear error mentioning all three options
//   5. Multiple set → highest priority wins (with warning)

import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { createWalletFromEnv } from "../src/signer.js";

const ENV_KEYS = [
  "REMIT_SIGNER_URL",
  "REMIT_SIGNER_TOKEN",
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
      assert.match(err.message, /REMIT_SIGNER_URL/);
      assert.match(err.message, /OWS_WALLET_ID/);
      assert.match(err.message, /REMITMD_KEY/);
      return true;
    });
  });

  it("error message includes all three config examples", async () => {
    await assert.rejects(createWalletFromEnv(), (err: Error) => {
      assert.match(err.message, /REMIT_SIGNER_URL/);
      assert.match(err.message, /REMIT_SIGNER_TOKEN/);
      assert.match(err.message, /OWS_WALLET_ID/);
      assert.match(err.message, /REMITMD_KEY/);
      assert.match(err.message, /REMITMD_CHAIN/);
      return true;
    });
  });

  // ── HTTP Signer path ───────────────────────────────────────────────────────

  it("throws when REMIT_SIGNER_URL is set without REMIT_SIGNER_TOKEN", async () => {
    process.env["REMIT_SIGNER_URL"] = "http://127.0.0.1:7402";

    await assert.rejects(createWalletFromEnv(), (err: Error) => {
      assert.match(err.message, /REMIT_SIGNER_TOKEN/);
      assert.match(err.message, /required/i);
      return true;
    });
  });

  it("attempts HTTP signer path when REMIT_SIGNER_URL + TOKEN are set", async () => {
    process.env["REMIT_SIGNER_URL"] = "http://127.0.0.1:19999";
    process.env["REMIT_SIGNER_TOKEN"] = "rmit_sk_test";

    // No signer server is running, so this should fail with a connection error
    // from HttpSigner.create - proving it took the withSigner path.
    await assert.rejects(createWalletFromEnv(), (err: Error) => {
      assert.match(err.message, /cannot reach signer server|ECONNREFUSED|fetch failed/i);
      return true;
    });
  });

  it("REMIT_SIGNER_URL takes priority over OWS_WALLET_ID", async () => {
    process.env["REMIT_SIGNER_URL"] = "http://127.0.0.1:19999";
    process.env["REMIT_SIGNER_TOKEN"] = "rmit_sk_test";
    process.env["OWS_WALLET_ID"] = "test-wallet";

    // Should attempt HTTP signer path (not OWS), so we get a connection
    // error - NOT the OWS-not-installed error.
    await assert.rejects(createWalletFromEnv(), (err: Error) => {
      assert.match(err.message, /cannot reach signer server|ECONNREFUSED|fetch failed/i);
      assert.doesNotMatch(err.message, /open-wallet-standard/i);
      return true;
    });
  });

  it("REMIT_SIGNER_URL takes priority over REMITMD_KEY", async () => {
    process.env["REMIT_SIGNER_URL"] = "http://127.0.0.1:19999";
    process.env["REMIT_SIGNER_TOKEN"] = "rmit_sk_test";
    process.env["REMITMD_KEY"] =
      "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

    // Should attempt HTTP signer path (not raw key), so we get a connection
    // error - NOT a successful wallet from REMITMD_KEY.
    await assert.rejects(createWalletFromEnv(), (err: Error) => {
      assert.match(err.message, /cannot reach signer server|ECONNREFUSED|fetch failed/i);
      return true;
    });
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
