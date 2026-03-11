import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ALL_TOOLS, callTool, toolRegistry } from "../src/tools/index.js";
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
  RemitEvent,
  Invoice,
} from "../src/types.js";

// ─── Test fixture ─────────────────────────────────────────────────────────────

const ADDR = "0xaaaa000000000000000000000000000000000001";
const OTHER = "0xbbbb000000000000000000000000000000000002";

const TX: Transaction = { txHash: "0x1234", chain: "base", status: "confirmed", createdAt: 1_000_000 };

function makeMock(): WalletLike {
  return {
    address: ADDR,
    payDirect: async () => TX,
    pay: async () => ({ ...TX, invoiceId: "inv-1" }),
    claimStart: async () => TX,
    releaseEscrow: async () => TX,
    cancelEscrow: async () => TX,
    openTab: async () =>
      ({ tabId: "tab-1", to: OTHER, limit: 100, perUnit: 1, used: 0, status: "open", expiresAt: 9_999_999 } as Tab),
    closeTab: async () => TX,
    openStream: async () =>
      ({
        streamId: "stream-1",
        to: OTHER,
        rate: 0.001,
        maxDuration: 3600,
        totalStreamed: 0,
        status: "active",
        startedAt: 1_000_000,
      } as Stream),
    closeStream: async () => TX,
    postBounty: async () =>
      ({ bountyId: "bounty-1", task: "test", amount: 50, status: "open", deadline: 9_999_999 } as Bounty),
    awardBounty: async () => TX,
    placeDeposit: async () =>
      ({ depositId: "dep-1", to: OTHER, amount: 25, status: "locked", expiresAt: 9_999_999 } as Deposit),
    balance: async () => 500.0,
    status: async () =>
      ({
        address: ADDR,
        usdcBalance: 500.0,
        tier: "standard",
        totalVolume: 1000,
        escrowsActive: 1,
        openTabs: 2,
        activeStreams: 1,
      } as WalletStatus),
    getStatus: async (addr) =>
      ({
        address: addr,
        usdcBalance: 100,
        tier: "standard",
        totalVolume: 500,
        escrowsActive: 0,
        openTabs: 0,
        activeStreams: 0,
      } as WalletStatus),
    getInvoice: async () => ({ to: OTHER, amount: 100, type: "escrow", memo: "test" } as Invoice),
    getEscrow: async (id) =>
      ({ invoiceId: id, from: ADDR, to: OTHER, amount: 100, status: "funded", timeout: 86400 } as Escrow),
    getTab: async (id) =>
      ({ tabId: id, to: OTHER, limit: 100, perUnit: 1, used: 25, status: "open", expiresAt: 9_999_999 } as Tab),
    getBounty: async (id) =>
      ({ bountyId: id, task: "test", amount: 50, status: "open", deadline: 9_999_999 } as Bounty),
    getReputation: async (addr) =>
      ({ address: addr, score: 92, completedPayments: 150, tier: "premium" } as Reputation),
    getEvents: async () => [] as RemitEvent[],
  };
}

// ─── Schema tests ─────────────────────────────────────────────────────────────

describe("tool registry", () => {
  it("has exactly 12 tools", () => {
    assert.equal(ALL_TOOLS.length, 12);
  });

  it("all tool names are unique", () => {
    const names = ALL_TOOLS.map((t) => t.definition.name);
    assert.equal(new Set(names).size, names.length);
  });

  it("contains all expected tool names", () => {
    const expected = [
      "pay_direct",
      "create_escrow",
      "release_escrow",
      "open_tab",
      "close_tab",
      "open_stream",
      "close_stream",
      "post_bounty",
      "award_bounty",
      "place_deposit",
      "check_balance",
      "get_status",
    ];
    for (const name of expected) {
      assert.ok(toolRegistry.has(name), `Missing tool: ${name}`);
    }
  });

  it("every tool has a non-empty description", () => {
    for (const tool of ALL_TOOLS) {
      assert.ok(
        tool.definition.description.length > 10,
        `Short description on: ${tool.definition.name}`,
      );
    }
  });

  it("every tool inputSchema is type:object with properties", () => {
    for (const tool of ALL_TOOLS) {
      const schema = tool.definition.inputSchema;
      assert.equal(schema.type, "object", `${tool.definition.name} schema type`);
      assert.ok(
        typeof schema.properties === "object",
        `${tool.definition.name} missing properties`,
      );
    }
  });
});

// ─── Handler tests ─────────────────────────────────────────────────────────────

describe("pay_direct handler", () => {
  it("returns success with txHash", async () => {
    const result = await callTool("pay_direct", { to: OTHER, amount: 10, memo: "test" }, makeMock()) as Record<string, unknown>;
    assert.equal(result["success"], true);
    assert.equal(result["txHash"], "0x1234");
    assert.equal(result["status"], "confirmed");
  });

  it("key never appears in result", async () => {
    const result = JSON.stringify(await callTool("pay_direct", { to: OTHER, amount: 1 }, makeMock()));
    assert.ok(!result.includes("REMITMD_KEY"), "Key in result");
    assert.ok(!result.includes("privateKey"), "Private key in result");
  });
});

describe("create_escrow handler", () => {
  it("returns invoiceId and txHash", async () => {
    const result = await callTool(
      "create_escrow",
      { to: OTHER, amount: 100, task: "write code", timeout: 86400 },
      makeMock(),
    ) as Record<string, unknown>;
    assert.equal(result["success"], true);
    assert.equal(result["invoiceId"], "inv-1");
    assert.ok(result["txHash"]);
  });

  it("passes milestones through", async () => {
    let capturedInvoice: unknown;
    const mock = makeMock();
    mock.pay = async (inv) => {
      capturedInvoice = inv;
      return { ...TX, invoiceId: "inv-2" };
    };
    await callTool(
      "create_escrow",
      {
        to: OTHER,
        amount: 100,
        task: "write code",
        timeout: 86400,
        milestones: [
          { amount: 50, description: "Phase 1" },
          { amount: 50, description: "Phase 2" },
        ],
      },
      mock,
    );
    const inv = capturedInvoice as Record<string, unknown>;
    assert.deepEqual(inv["milestones"], [
      { amount: 50, description: "Phase 1" },
      { amount: 50, description: "Phase 2" },
    ]);
  });
});

describe("release_escrow handler", () => {
  it("returns txHash", async () => {
    const result = await callTool("release_escrow", { invoice_id: "inv-1" }, makeMock()) as Record<string, unknown>;
    assert.equal(result["success"], true);
    assert.equal(result["txHash"], "0x1234");
  });
});

describe("open_tab handler", () => {
  it("returns tabId and limit", async () => {
    const result = await callTool("open_tab", { to: OTHER, limit: 50, per_unit: 0.5 }, makeMock()) as Record<string, unknown>;
    assert.equal(result["success"], true);
    assert.equal(result["tabId"], "tab-1");
    assert.equal(result["limit"], 100);
  });
});

describe("close_tab handler", () => {
  it("returns txHash", async () => {
    const result = await callTool("close_tab", { tab_id: "tab-1" }, makeMock()) as Record<string, unknown>;
    assert.equal(result["success"], true);
  });
});

describe("open_stream handler", () => {
  it("returns streamId and rate", async () => {
    const result = await callTool("open_stream", { to: OTHER, rate: 0.001 }, makeMock()) as Record<string, unknown>;
    assert.equal(result["success"], true);
    assert.equal(result["streamId"], "stream-1");
    assert.equal(result["rate"], 0.001);
  });
});

describe("close_stream handler", () => {
  it("returns txHash", async () => {
    const result = await callTool("close_stream", { stream_id: "stream-1" }, makeMock()) as Record<string, unknown>;
    assert.equal(result["success"], true);
  });
});

describe("post_bounty handler", () => {
  it("returns bountyId", async () => {
    const result = await callTool(
      "post_bounty",
      { amount: 50, task: "find bug", deadline: 9_999_999 },
      makeMock(),
    ) as Record<string, unknown>;
    assert.equal(result["success"], true);
    assert.equal(result["bountyId"], "bounty-1");
  });
});

describe("award_bounty handler", () => {
  it("passes winner address through", async () => {
    let capturedWinner: string | undefined;
    const mock = makeMock();
    mock.awardBounty = async (_id, winner) => {
      capturedWinner = winner;
      return TX;
    };
    await callTool("award_bounty", { bounty_id: "bounty-1", winner: OTHER }, mock);
    assert.equal(capturedWinner, OTHER);
  });
});

describe("place_deposit handler", () => {
  it("returns depositId", async () => {
    const result = await callTool(
      "place_deposit",
      { to: OTHER, amount: 25, expires: 86400 },
      makeMock(),
    ) as Record<string, unknown>;
    assert.equal(result["success"], true);
    assert.equal(result["depositId"], "dep-1");
  });
});

describe("check_balance handler", () => {
  it("returns balance and address", async () => {
    const result = await callTool("check_balance", {}, makeMock()) as Record<string, unknown>;
    assert.equal(result["balance"], 500.0);
    assert.equal(result["currency"], "USDC");
    assert.equal(result["address"], ADDR);
  });

  it("address field is the wallet address, not a key", async () => {
    const result = JSON.stringify(await callTool("check_balance", {}, makeMock()));
    assert.ok(result.includes(ADDR));
    assert.ok(!result.includes("privateKey"));
  });
});

describe("get_status handler", () => {
  it("returns full status with tier and counters", async () => {
    const result = await callTool("get_status", {}, makeMock()) as Record<string, unknown>;
    assert.equal(result["balance"], 500.0);
    assert.equal(result["tier"], "standard");
    assert.equal(result["activeEscrows"], 1);
    assert.equal(result["openTabs"], 2);
    assert.equal(result["activeStreams"], 1);
  });
});

describe("error handling", () => {
  it("throws on unknown tool name", async () => {
    await assert.rejects(
      () => callTool("nonexistent_tool", {}, makeMock()),
      /Unknown tool: nonexistent_tool/,
    );
  });

  it("propagates wallet errors", async () => {
    const mock = makeMock();
    mock.payDirect = async () => {
      throw new Error("InsufficientBalance");
    };
    await assert.rejects(
      () => callTool("pay_direct", { to: OTHER, amount: 9999 }, mock),
      /InsufficientBalance/,
    );
  });
});
