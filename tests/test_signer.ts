// Tests for createWalletFromEnv() — OWS detection + raw key path.
//
// Verifies the env-var detection priority:
//   1. OWS_WALLET_ID → OWS signer (via Wallet.withOws)
//   2. REMITMD_KEY → raw private key (via Wallet.fromEnv)
//   3. Neither → clear error mentioning both options
//   4. Both set → OWS wins (SDK logs warning)

import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { createWalletFromEnv } from "../src/signer.js";

const ENV_KEYS = ["OWS_WALLET_ID", "REMITMD_KEY", "REMITMD_CHAIN", "OWS_API_KEY"] as const;

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

  it("throws when neither OWS_WALLET_ID nor REMITMD_KEY is set", async () => {
    await assert.rejects(createWalletFromEnv(), (err: Error) => {
      assert.match(err.message, /REMITMD_KEY/);
      assert.match(err.message, /OWS_WALLET_ID/);
      return true;
    });
  });

  it("creates wallet from REMITMD_KEY", async () => {
    // Anvil default key #0 — deterministic, safe for tests.
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
    // expect the OWS-not-installed error — NOT a successful wallet.
    await assert.rejects(createWalletFromEnv(), (err: Error) => {
      assert.match(err.message, /open-wallet-standard/i);
      return true;
    });
  });

  it("error message includes both config examples", async () => {
    await assert.rejects(createWalletFromEnv(), (err: Error) => {
      // Should mention both raw key and OWS config patterns.
      assert.match(err.message, /REMITMD_KEY/);
      assert.match(err.message, /OWS_WALLET_ID/);
      assert.match(err.message, /REMITMD_CHAIN/);
      return true;
    });
  });
});
