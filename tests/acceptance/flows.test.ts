/**
 * MCP acceptance tests — payment tool flows against live Base Sepolia.
 *
 * Run with: npm run test:acceptance
 * These tests are NOT included in the normal test suite.
 */

import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { callTool } from "../../src/tools/index.js";
import { createTestWallet, mintUsdc, waitForBalance, getUsdcBalance, type TestContext } from "./setup.js";

describe("MCP acceptance: pay_direct", () => {
  let payer: TestContext;
  let recipient: TestContext;

  before(async () => {
    payer = await createTestWallet();
    recipient = await createTestWallet();
    await mintUsdc(payer.address, 100);
    await waitForBalance(payer.address, 99);
  });

  it("sends payment and returns txHash", async () => {
    const result = (await callTool(
      "pay_direct",
      { to: recipient.address, amount: 10, memo: "MCP acceptance test" },
      payer.wallet,
    )) as Record<string, unknown>;

    assert.equal(result["success"], true, "should succeed");
    assert.ok(result["txHash"], "should have txHash");
    assert.equal(result["status"], "confirmed", "status should be confirmed");
  });
});

describe("MCP acceptance: escrow lifecycle", () => {
  let payer: TestContext;
  let payee: TestContext;

  before(async () => {
    payer = await createTestWallet();
    payee = await createTestWallet();
    await mintUsdc(payer.address, 100);
    await waitForBalance(payer.address, 99);
  });

  it("create → release", async () => {
    // Create escrow
    const create = (await callTool(
      "create_escrow",
      { to: payee.address, amount: 5, task: "MCP test escrow", timeout: 86400 },
      payer.wallet,
    )) as Record<string, unknown>;
    assert.equal(create["success"], true);
    assert.ok(create["invoiceId"], "should have invoiceId");

    // Release escrow
    const release = (await callTool(
      "release_escrow",
      { invoice_id: create["invoiceId"] },
      payer.wallet,
    )) as Record<string, unknown>;
    assert.equal(release["success"], true);
    assert.ok(release["txHash"], "should have txHash");
  });
});

describe("MCP acceptance: open_tab + close_tab", () => {
  let payer: TestContext;
  let provider: TestContext;

  before(async () => {
    payer = await createTestWallet();
    provider = await createTestWallet();
    await mintUsdc(payer.address, 100);
    await waitForBalance(payer.address, 99);
  });

  it("opens and closes a tab", async () => {
    const open = (await callTool(
      "open_tab",
      { to: provider.address, limit: 20, per_unit: 1 },
      payer.wallet,
    )) as Record<string, unknown>;
    assert.ok(open["tabId"], "should have tabId");

    const close = (await callTool(
      "close_tab",
      { tab_id: open["tabId"] },
      provider.wallet,
    )) as Record<string, unknown>;
    assert.equal(close["success"], true);
  });
});

describe("MCP acceptance: open_stream + close_stream", () => {
  let payer: TestContext;
  let payee: TestContext;

  before(async () => {
    payer = await createTestWallet();
    payee = await createTestWallet();
    await mintUsdc(payer.address, 100);
    await waitForBalance(payer.address, 99);
  });

  it("opens and closes a stream", async () => {
    const open = (await callTool(
      "open_stream",
      { to: payee.address, rate: 0.01, max_total: 5 },
      payer.wallet,
    )) as Record<string, unknown>;
    assert.ok(open["streamId"], "should have streamId");
    assert.equal(open["status"], "active");

    // Wait briefly for some accrual
    await new Promise((r) => setTimeout(r, 3000));

    const close = (await callTool(
      "close_stream",
      { stream_id: open["streamId"] },
      payer.wallet,
    )) as Record<string, unknown>;
    assert.equal(close["success"], true);
  });
});

describe("MCP acceptance: post_bounty + award_bounty", () => {
  let poster: TestContext;
  let submitter: TestContext;

  before(async () => {
    poster = await createTestWallet();
    submitter = await createTestWallet();
    await mintUsdc(poster.address, 100);
    await waitForBalance(poster.address, 99);
  });

  it("posts bounty and awards it", async () => {
    const deadline = Math.floor(Date.now() / 1000) + 86400;
    const post = (await callTool(
      "post_bounty",
      { amount: 10, task: "MCP acceptance test bounty", deadline },
      poster.wallet,
    )) as Record<string, unknown>;
    assert.ok(post["bountyId"], "should have bountyId");
    assert.equal(post["status"], "open");

    const award = (await callTool(
      "award_bounty",
      { bounty_id: post["bountyId"], winner: submitter.address },
      poster.wallet,
    )) as Record<string, unknown>;
    assert.equal(award["success"], true);
  });
});

describe("MCP acceptance: place_deposit", () => {
  let depositor: TestContext;
  let provider: TestContext;

  before(async () => {
    depositor = await createTestWallet();
    provider = await createTestWallet();
    await mintUsdc(depositor.address, 100);
    await waitForBalance(depositor.address, 99);
  });

  it("places a deposit", async () => {
    const result = (await callTool(
      "place_deposit",
      { to: provider.address, amount: 15, expires: 86400 },
      depositor.wallet,
    )) as Record<string, unknown>;
    assert.ok(result["depositId"], "should have depositId");
    assert.equal(result["status"], "active");
  });
});

describe("MCP acceptance: check_balance", () => {
  let wallet: TestContext;

  before(async () => {
    wallet = await createTestWallet();
    await mintUsdc(wallet.address, 50);
    await waitForBalance(wallet.address, 49);
  });

  it("returns balance > 0 after mint", async () => {
    const result = (await callTool("check_balance", {}, wallet.wallet)) as Record<string, unknown>;
    assert.ok(typeof result["balance"] === "number", "balance should be a number");
    assert.ok((result["balance"] as number) >= 49, "balance should be >= 49");
  });
});
