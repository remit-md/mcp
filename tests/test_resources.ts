import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { listResources, readResource } from "../src/resources/index.js";
import type {
  WalletLike,
  Transaction,
  WalletStatus,
  Tab,
  Stream,
  Bounty,
  Deposit,
  Escrow,
  Reputation,
  Invoice,
} from "../src/types.js";

const ADDR = "0xaaaa000000000000000000000000000000000001";
const OTHER = "0xbbbb000000000000000000000000000000000002";
const TX: Transaction = { txHash: "0xabc", chain: "base", status: "confirmed", createdAt: 1_000_000 };

function makeMock(): WalletLike {
  return {
    address: ADDR,
    payDirect: async () => TX,
    pay: async () =>
      ({ invoiceId: "inv-1", txHash: "0xabc", payer: ADDR, payee: OTHER, amount: 100, chain: "base", status: "funded", createdAt: 1_000_000 } as Escrow),
    claimStart: async () => TX,
    releaseEscrow: async () => TX,
    cancelEscrow: async () => TX,
    openTab: async () => ({ id: "t1", payer: ADDR, payee: OTHER, limit: 50, perUnit: 0.5, spent: 10, chain: "base", status: "open", createdAt: 1_000_000, expiresAt: 9_999_999 } as Tab),
    closeTab: async () => TX,
    openStream: async () => ({ id: "s1", payer: ADDR, payee: OTHER, ratePerSecond: 0.001, maxDuration: 3600, totalStreamed: 1.5, chain: "base", status: "active", startedAt: 1_000_000 } as Stream),
    closeStream: async () => TX,
    postBounty: async () => ({ id: "b1", poster: ADDR, task: "test", amount: 20, chain: "base", status: "open", validation: "poster", maxAttempts: 10, submissions: [], deadline: 9_999_999, createdAt: 1_000_000 } as Bounty),
    awardBounty: async () => TX,
    placeDeposit: async () => ({ id: "d1", payer: ADDR, payee: OTHER, amount: 10, chain: "base", status: "locked", createdAt: 1_000_000, expiresAt: 9_999_999 } as Deposit),
    balance: async () => 250.0,
    status: async () => ({ wallet: ADDR, balance: "250.00", tier: "standard", monthlyVolume: "500.00", feeRateBps: 100, activeEscrows: 0, activeTabs: 1, activeStreams: 0, permitNonce: null } as WalletStatus),
    getStatus: async (addr) => ({ wallet: addr, balance: "88.50", tier: "premium", monthlyVolume: "2000.00", feeRateBps: 50, activeEscrows: 0, activeTabs: 0, activeStreams: 0, permitNonce: null } as WalletStatus),
    getInvoice: async (id) => ({ id, from: ADDR, to: OTHER, amount: 75, chain: "base", status: "pending", paymentType: "escrow", memo: `task-${id}`, createdAt: 1_000_000 } as Invoice),
    getEscrow: async (id) => ({ invoiceId: id, payer: ADDR, payee: OTHER, amount: 75, chain: "base", status: "funded", createdAt: 1_000_000 } as Escrow),
    getTab: async (id) => ({ id, payer: ADDR, payee: OTHER, limit: 50, perUnit: 0.5, spent: 10, chain: "base", status: "open", createdAt: 1_000_000, expiresAt: 9_999_999 } as Tab),
    getBounty: async (id) => ({ id, poster: ADDR, task: "find the bug", amount: 20, chain: "base", status: "open", validation: "poster", maxAttempts: 10, submissions: [], deadline: 9_999_999, createdAt: 1_000_000 } as Bounty),
    getReputation: async (addr) => ({ address: addr, score: 95, totalPaid: 10000, totalReceived: 8000, escrowsCompleted: 300, memberSince: 1_000_000 } as Reputation),
    x402Fetch: async () => ({ response: new Response('OK', { status: 200 }), lastPayment: null }),
    createFundLink: async () => ({ url: "https://remit.md/fund/tok", token: "tok", expiresAt: "2099-01-01T00:00:00Z", walletAddress: ADDR }),
    createWithdrawLink: async () => ({ url: "https://remit.md/withdraw/tok", token: "tok", expiresAt: "2099-01-01T00:00:00Z", walletAddress: ADDR }),
    registerWebhook: async () => ({ id: "wh-1", wallet: ADDR, url: "", events: [], chains: [], active: true, createdAt: 1_000_000 }),
    listWebhooks: async () => [],
    deleteWebhook: async () => {},
  };
}

// ─── listResources ────────────────────────────────────────────────────────────

describe("listResources", () => {
  it("returns exactly 6 resources", () => {
    assert.equal(listResources().length, 6);
  });

  it("all resources have uri, name, description, mimeType", () => {
    for (const r of listResources()) {
      assert.ok(r.uri, `missing uri on ${r.name}`);
      assert.ok(r.name, `missing name on ${r.uri}`);
      assert.ok(r.description, `missing description on ${r.uri}`);
      assert.equal(r.mimeType, "application/json");
    }
  });

  it("URI templates use {address} or {id} template variables", () => {
    for (const r of listResources()) {
      assert.ok(
        r.uri.includes("{address}") || r.uri.includes("{id}"),
        `No template variable in URI: ${r.uri}`,
      );
    }
  });
});

// ─── readResource ─────────────────────────────────────────────────────────────

describe("readResource - wallet/balance", () => {
  it("returns JSON with balance field", async () => {
    const { mimeType, text } = await readResource(
      `remit://wallet/${OTHER}/balance`,
      makeMock(),
    );
    assert.equal(mimeType, "application/json");
    const data = JSON.parse(text) as Record<string, unknown>;
    assert.equal(data["address"], OTHER);
    assert.equal(data["balance"], "88.50");
    assert.equal(data["currency"], "USDC");
  });
});

describe("readResource - wallet/reputation", () => {
  it("returns reputation with score", async () => {
    const { text } = await readResource(`remit://wallet/${OTHER}/reputation`, makeMock());
    const data = JSON.parse(text) as Record<string, unknown>;
    assert.equal(data["score"], 95);
  });
});

describe("readResource - invoice", () => {
  it("returns invoice data", async () => {
    const { text } = await readResource("remit://invoice/inv-42", makeMock());
    const data = JSON.parse(text) as Record<string, unknown>;
    assert.equal(data["amount"], 75);
    assert.equal(data["paymentType"], "escrow");
  });
});

describe("readResource - escrow/status", () => {
  it("returns escrow with invoiceId", async () => {
    const { text } = await readResource("remit://escrow/inv-99/status", makeMock());
    const data = JSON.parse(text) as Record<string, unknown>;
    assert.equal(data["invoiceId"], "inv-99");
    assert.equal(data["status"], "funded");
  });
});

describe("readResource - tab/usage", () => {
  it("returns tab with spent field", async () => {
    const { text } = await readResource("remit://tab/tab-55/usage", makeMock());
    const data = JSON.parse(text) as Record<string, unknown>;
    assert.equal(data["id"], "tab-55");
    assert.equal(data["spent"], 10);
  });
});

describe("readResource - bounty/submissions", () => {
  it("returns bounty data", async () => {
    const { text } = await readResource("remit://bounty/bounty-7/submissions", makeMock());
    const data = JSON.parse(text) as Record<string, unknown>;
    assert.equal(data["id"], "bounty-7");
    assert.equal(data["task"], "find the bug");
  });
});

describe("readResource - error cases", () => {
  it("throws on unknown URI scheme", async () => {
    await assert.rejects(
      () => readResource("remit://unknown/path", makeMock()),
      /Unknown resource URI/,
    );
  });

  it("throws on non-remit URI", async () => {
    await assert.rejects(
      () => readResource("https://example.com", makeMock()),
      /Unknown resource URI/,
    );
  });
});

describe("readResource - key isolation", () => {
  it("no private key material in any resource response", async () => {
    const uris = [
      `remit://wallet/${ADDR}/balance`,
      `remit://wallet/${ADDR}/reputation`,
      "remit://invoice/inv-1",
      "remit://escrow/inv-1/status",
      "remit://tab/tab-1/usage",
      "remit://bounty/b-1/submissions",
    ];
    for (const uri of uris) {
      const { text } = await readResource(uri, makeMock());
      assert.ok(!text.includes("privateKey"), `Private key in ${uri} response`);
      assert.ok(!text.includes("REMITMD_KEY"), `Env key in ${uri} response`);
    }
  });
});
