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
  Dispute,
  Subscription,
  Escrow,
  Reputation,
  RemitEvent,
  Invoice,
} from "../src/types.js";

const ADDR = "0xaaaa000000000000000000000000000000000001";
const OTHER = "0xbbbb000000000000000000000000000000000002";
const TX: Transaction = { txHash: "0xabc", chain: "base", status: "confirmed", createdAt: 1_000_000 };

function makeMock(): WalletLike {
  return {
    address: ADDR,
    payDirect: async () => TX,
    pay: async () => TX,
    claimStart: async () => TX,
    releaseEscrow: async () => TX,
    cancelEscrow: async () => TX,
    openTab: async () => ({ tabId: "t1", to: OTHER, limit: 50, perUnit: 0.5, used: 10, status: "open", expiresAt: 9_999_999 } as Tab),
    closeTab: async () => TX,
    openStream: async () => ({ streamId: "s1", to: OTHER, rate: 0.001, maxDuration: 3600, totalStreamed: 1.5, status: "active", startedAt: 1_000_000 } as Stream),
    closeStream: async () => TX,
    subscribe: async () => ({ subscriptionId: "sub1", to: OTHER, amount: 5, interval: "monthly", status: "active" } as Subscription),
    cancelSubscription: async () => TX,
    postBounty: async () => ({ bountyId: "b1", task: "test", amount: 20, status: "open", deadline: 9_999_999 } as Bounty),
    awardBounty: async () => TX,
    placeDeposit: async () => ({ depositId: "d1", to: OTHER, amount: 10, status: "locked", expiresAt: 9_999_999 } as Deposit),
    fileDispute: async () => ({ disputeId: "disp1", invoiceId: "inv1", reason: "r", status: "filed", createdAt: 1_000_000 } as Dispute),
    balance: async () => 250.0,
    status: async () => ({ address: ADDR, usdcBalance: 250.0, tier: "standard", totalVolume: 500, escrowsActive: 0, openTabs: 1, activeStreams: 0 } as WalletStatus),
    getStatus: async (addr) => ({ address: addr, usdcBalance: 88.5, tier: "premium", totalVolume: 2000, escrowsActive: 0, openTabs: 0, activeStreams: 0 } as WalletStatus),
    getInvoice: async (id) => ({ to: OTHER, amount: 75, type: "escrow", memo: `task-${id}` } as Invoice),
    getEscrow: async (id) => ({ invoiceId: id, from: ADDR, to: OTHER, amount: 75, status: "funded", timeout: 86400 } as Escrow),
    getTab: async (id) => ({ tabId: id, to: OTHER, limit: 50, perUnit: 0.5, used: 10, status: "open", expiresAt: 9_999_999 } as Tab),
    getBounty: async (id) => ({ bountyId: id, task: "find the bug", amount: 20, status: "open", deadline: 9_999_999 } as Bounty),
    getReputation: async (addr) => ({ address: addr, score: 95, completedPayments: 300, disputes: 1, tier: "elite" } as Reputation),
    getEvents: async () => [{ type: "PaymentReceived", timestamp: 1_000_001, payload: { amount: 5 } }] as RemitEvent[],
  };
}

// ─── listResources ────────────────────────────────────────────────────────────

describe("listResources", () => {
  it("returns exactly 7 resources", () => {
    assert.equal(listResources().length, 7);
  });

  it("all resources have uri, name, description, mimeType", () => {
    for (const r of listResources()) {
      assert.ok(r.uri, `missing uri on ${r.name}`);
      assert.ok(r.name, `missing name on ${r.uri}`);
      assert.ok(r.description, `missing description on ${r.uri}`);
      assert.equal(r.mimeType, "application/json");
    }
  });

  it("URI templates use {address} or {id} placeholders", () => {
    for (const r of listResources()) {
      assert.ok(
        r.uri.includes("{address}") || r.uri.includes("{id}"),
        `No placeholder in URI: ${r.uri}`,
      );
    }
  });
});

// ─── readResource ─────────────────────────────────────────────────────────────

describe("readResource — wallet/balance", () => {
  it("returns JSON with balance field", async () => {
    const { mimeType, text } = await readResource(
      `remit://wallet/${OTHER}/balance`,
      makeMock(),
    );
    assert.equal(mimeType, "application/json");
    const data = JSON.parse(text) as Record<string, unknown>;
    assert.equal(data["address"], OTHER);
    assert.equal(data["balance"], 88.5);
    assert.equal(data["currency"], "USDC");
  });
});

describe("readResource — wallet/reputation", () => {
  it("returns reputation with score", async () => {
    const { text } = await readResource(`remit://wallet/${OTHER}/reputation`, makeMock());
    const data = JSON.parse(text) as Record<string, unknown>;
    assert.equal(data["score"], 95);
    assert.equal(data["tier"], "elite");
  });
});

describe("readResource — wallet/transactions", () => {
  it("returns array of events", async () => {
    const { text } = await readResource(
      `remit://wallet/${ADDR}/transactions`,
      makeMock(),
    );
    const events = JSON.parse(text) as unknown[];
    assert.ok(Array.isArray(events));
    assert.equal(events.length, 1);
  });
});

describe("readResource — invoice", () => {
  it("returns invoice data", async () => {
    const { text } = await readResource("remit://invoice/inv-42", makeMock());
    const data = JSON.parse(text) as Record<string, unknown>;
    assert.equal(data["amount"], 75);
    assert.equal(data["type"], "escrow");
  });
});

describe("readResource — escrow/status", () => {
  it("returns escrow with invoiceId", async () => {
    const { text } = await readResource("remit://escrow/inv-99/status", makeMock());
    const data = JSON.parse(text) as Record<string, unknown>;
    assert.equal(data["invoiceId"], "inv-99");
    assert.equal(data["status"], "funded");
  });
});

describe("readResource — tab/usage", () => {
  it("returns tab with used field", async () => {
    const { text } = await readResource("remit://tab/tab-55/usage", makeMock());
    const data = JSON.parse(text) as Record<string, unknown>;
    assert.equal(data["tabId"], "tab-55");
    assert.equal(data["used"], 10);
  });
});

describe("readResource — bounty/submissions", () => {
  it("returns bounty data", async () => {
    const { text } = await readResource("remit://bounty/bounty-7/submissions", makeMock());
    const data = JSON.parse(text) as Record<string, unknown>;
    assert.equal(data["bountyId"], "bounty-7");
    assert.equal(data["task"], "find the bug");
  });
});

describe("readResource — error cases", () => {
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

describe("readResource — key isolation", () => {
  it("no private key material in any resource response", async () => {
    const uris = [
      `remit://wallet/${ADDR}/balance`,
      `remit://wallet/${ADDR}/reputation`,
      `remit://wallet/${ADDR}/transactions`,
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
