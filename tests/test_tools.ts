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
    x402Fetch: async () => ({ response: new Response('{"data":"paid"}', { status: 200 }), lastPayment: null }),
    createFundLink: async () => ({ url: "https://remit.md/fund/abc", token: "abc", expiresAt: "2099-01-01T00:00:00Z", walletAddress: ADDR }),
    createWithdrawLink: async () => ({ url: "https://remit.md/withdraw/xyz", token: "xyz", expiresAt: "2099-01-01T00:00:00Z", walletAddress: ADDR }),
  };
}

// ─── Schema tests ─────────────────────────────────────────────────────────────

describe("tool registry", () => {
  it("has exactly 22 tools", () => {
    assert.equal(ALL_TOOLS.length, 22);
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
      "cancel_escrow",
      "claim_start",
      "open_tab",
      "close_tab",
      "open_stream",
      "close_stream",
      "post_bounty",
      "award_bounty",
      "place_deposit",
      "check_balance",
      "get_status",
      "x402_pay",
      "x402_config",
      "x402_paywall_setup",
      "create_fund_link",
      "create_withdraw_link",
      "register_webhook",
      "list_webhooks",
      "delete_webhook",
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

// ─── x402_config handler ─────────────────────────────────────────────────────

describe("x402_config handler", () => {
  it("returns current config with defaults", async () => {
    // Reset to defaults first
    await callTool("x402_config", { max_auto_pay_usdc: 0.10, enabled: true }, makeMock());
    const result = await callTool("x402_config", {}, makeMock()) as Record<string, unknown>;
    assert.equal(result["success"], true);
    const config = result["config"] as Record<string, unknown>;
    assert.equal(config["enabled"], true);
    assert.equal(config["maxAutoPayUsdc"], 0.10);
  });

  it("updates maxAutoPayUsdc", async () => {
    const result = await callTool("x402_config", { max_auto_pay_usdc: 0.05 }, makeMock()) as Record<string, unknown>;
    const config = result["config"] as Record<string, unknown>;
    assert.equal(config["maxAutoPayUsdc"], 0.05);
    // Reset
    await callTool("x402_config", { max_auto_pay_usdc: 0.10 }, makeMock());
  });

  it("can disable and re-enable auto-pay", async () => {
    let result = await callTool("x402_config", { enabled: false }, makeMock()) as Record<string, unknown>;
    assert.equal((result["config"] as Record<string, unknown>)["enabled"], false);
    result = await callTool("x402_config", { enabled: true }, makeMock()) as Record<string, unknown>;
    assert.equal((result["config"] as Record<string, unknown>)["enabled"], true);
  });
});

// ─── x402_pay handler ────────────────────────────────────────────────────────

describe("x402_pay handler", () => {
  it("calls wallet.x402Fetch with url and session limit", async () => {
    await callTool("x402_config", { enabled: true, max_auto_pay_usdc: 0.10 }, makeMock());
    const mock = makeMock();
    let capturedUrl: string | undefined;
    let capturedLimit: number | undefined;
    mock.x402Fetch = async (url, limit) => {
      capturedUrl = url;
      capturedLimit = limit;
      return { response: new Response('{"ok":true}', { status: 200 }), lastPayment: null };
    };
    const result = await callTool("x402_pay", { url: "https://example.com/resource" }, mock) as Record<string, unknown>;
    assert.equal(result["status"], 200);
    assert.equal(result["ok"], true);
    assert.equal(capturedUrl, "https://example.com/resource");
    assert.equal(capturedLimit, 0.10);
  });

  it("uses per-request max_usdc when provided", async () => {
    await callTool("x402_config", { enabled: true, max_auto_pay_usdc: 0.10 }, makeMock());
    const mock = makeMock();
    let capturedLimit: number | undefined;
    mock.x402Fetch = async (_url, limit) => {
      capturedLimit = limit;
      return { response: new Response("data", { status: 200 }), lastPayment: null };
    };
    await callTool("x402_pay", { url: "https://example.com/resource", max_usdc: 0.50 }, mock);
    assert.equal(capturedLimit, 0.50);
  });

  it("returns body text from response", async () => {
    await callTool("x402_config", { enabled: true }, makeMock());
    const mock = makeMock();
    mock.x402Fetch = async () => ({ response: new Response('{"result":"success"}', { status: 200 }), lastPayment: null });
    const result = await callTool("x402_pay", { url: "https://example.com/resource" }, mock) as Record<string, unknown>;
    assert.equal(result["body"], '{"result":"success"}');
  });

  it("includes V2 payment metadata when lastPayment is present", async () => {
    await callTool("x402_config", { enabled: true }, makeMock());
    const mock = makeMock();
    mock.x402Fetch = async () => ({
      response: new Response('{"ok":true}', { status: 200 }),
      lastPayment: {
        scheme: "exact",
        network: "eip155:84532",
        amount: "1000",
        asset: "0x2d846325766921935f37d5b4478196d3ef93707c",
        payTo: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
        resource: "/api/v1/premium",
        description: "Premium data feed",
        mimeType: "application/json",
      },
    });
    const result = await callTool("x402_pay", { url: "https://example.com/api/v1/premium" }, mock) as Record<string, unknown>;
    const payment = result["payment"] as Record<string, unknown>;
    assert.ok(payment, "payment field must be present");
    assert.equal(payment["amount"], "1000");
    assert.equal(payment["network"], "eip155:84532");
    assert.equal(payment["resource"], "/api/v1/premium");
    assert.equal(payment["description"], "Premium data feed");
    assert.equal(payment["mimeType"], "application/json");
  });

  it("omits payment field when no x402 payment was made (200 direct)", async () => {
    await callTool("x402_config", { enabled: true }, makeMock());
    const mock = makeMock();
    mock.x402Fetch = async () => ({ response: new Response("ok", { status: 200 }), lastPayment: null });
    const result = await callTool("x402_pay", { url: "https://example.com/free" }, mock) as Record<string, unknown>;
    assert.equal(result["payment"], undefined, "payment field must be absent when no x402 occurred");
  });

  it("throws McpError when auto-pay is disabled", async () => {
    await callTool("x402_config", { enabled: false }, makeMock());
    await assert.rejects(
      () => callTool("x402_pay", { url: "https://example.com/resource" }, makeMock()),
      /disabled/,
    );
    // Re-enable for subsequent tests
    await callTool("x402_config", { enabled: true }, makeMock());
  });

  it("rejects invalid URL", async () => {
    await callTool("x402_config", { enabled: true }, makeMock());
    await assert.rejects(
      () => callTool("x402_pay", { url: "not-a-url" }, makeMock()),
      /InvalidParams|url/i,
    );
  });
});

// ─── create_fund_link handler ─────────────────────────────────────────────────

describe("create_fund_link handler", () => {
  it("returns url, token, expiresAt, walletAddress", async () => {
    const result = await callTool("create_fund_link", {}, makeMock()) as Record<string, unknown>;
    assert.equal(result["url"], "https://remit.md/fund/abc");
    assert.equal(result["token"], "abc");
    assert.equal(result["walletAddress"], ADDR);
    assert.ok(result["expiresAt"]);
  });
});

// ─── create_withdraw_link handler ────────────────────────────────────────────

describe("create_withdraw_link handler", () => {
  it("returns url, token, expiresAt, walletAddress", async () => {
    const result = await callTool("create_withdraw_link", {}, makeMock()) as Record<string, unknown>;
    assert.equal(result["url"], "https://remit.md/withdraw/xyz");
    assert.equal(result["token"], "xyz");
    assert.equal(result["walletAddress"], ADDR);
    assert.ok(result["expiresAt"]);
  });
});

// ─── x402_paywall_setup handler ───────────────────────────────────────────────

const SETUP_BASE = {
  wallet_address: OTHER,
  amount_usdc: 0.001,
  network: "eip155:84532",
};

describe("x402_paywall_setup handler", () => {
  it("returns install + code for Python FastAPI (default)", async () => {
    const result = await callTool("x402_paywall_setup", { language: "python", ...SETUP_BASE }, makeMock()) as Record<string, unknown>;
    assert.ok(typeof result["install"] === "string", "install must be a string");
    assert.ok(typeof result["code"] === "string", "code must be a string");
    assert.ok((result["install"] as string).includes("remitmd"), "install must mention remitmd");
    assert.ok((result["code"] as string).includes("fastapi_dependency"), "FastAPI code must use fastapi_dependency");
    assert.ok((result["code"] as string).includes(OTHER), "code must embed wallet_address");
    assert.ok((result["code"] as string).includes("0.001"), "code must embed amount_usdc");
  });

  it("returns Flask code when framework=flask", async () => {
    const result = await callTool("x402_paywall_setup", { language: "python", framework: "flask", ...SETUP_BASE }, makeMock()) as Record<string, unknown>;
    assert.ok((result["code"] as string).includes("flask_route"), "Flask code must use flask_route");
    assert.ok((result["install"] as string).includes("flask"), "install must mention flask");
  });

  it("returns Hono code for TypeScript (default)", async () => {
    const result = await callTool("x402_paywall_setup", { language: "typescript", ...SETUP_BASE }, makeMock()) as Record<string, unknown>;
    assert.ok((result["code"] as string).includes("honoMiddleware"), "TS default must use honoMiddleware");
    assert.ok((result["install"] as string).includes("hono"), "install must mention hono");
  });

  it("returns Express code when framework=express", async () => {
    const result = await callTool("x402_paywall_setup", { language: "typescript", framework: "express", ...SETUP_BASE }, makeMock()) as Record<string, unknown>;
    assert.ok((result["code"] as string).includes("paywall.check"), "Express code must use paywall.check");
    assert.ok((result["install"] as string).includes("express"), "install must mention express");
  });

  it("returns Go code", async () => {
    const result = await callTool("x402_paywall_setup", { language: "go", ...SETUP_BASE }, makeMock()) as Record<string, unknown>;
    assert.ok((result["install"] as string).includes("go get"), "Go install must use go get");
    assert.ok((result["code"] as string).includes("NewX402Paywall"), "Go code must use NewX402Paywall");
    assert.ok((result["code"] as string).includes("Middleware"), "Go code must use Middleware");
  });

  it("includes V2 fields when provided", async () => {
    const result = await callTool("x402_paywall_setup", {
      language: "python",
      ...SETUP_BASE,
      resource: "/v1/data",
      description: "Market data",
      mime_type: "application/json",
    }, makeMock()) as Record<string, unknown>;
    const code = result["code"] as string;
    assert.ok(code.includes("/v1/data"), "code must include resource");
    assert.ok(code.includes("Market data"), "code must include description");
    assert.ok(code.includes("application/json"), "code must include mime_type");
  });

  it("uses default USDC address when asset omitted", async () => {
    const result = await callTool("x402_paywall_setup", { language: "python", ...SETUP_BASE }, makeMock()) as Record<string, unknown>;
    assert.ok((result["code"] as string).includes("0x2d846325766921935f37d5b4478196d3ef93707c"), "must use default USDC");
  });

  it("uses default Router address when router_address omitted", async () => {
    const result = await callTool("x402_paywall_setup", { language: "python", ...SETUP_BASE }, makeMock()) as Record<string, unknown>;
    assert.ok((result["code"] as string).includes("0x3120f396ff6a9afc5a9d92e28796082f1429e024"), "must use default Router");
    assert.ok((result["code"] as string).includes("router_address"), "Python code must include router_address param");
  });

  it("uses provided router_address when given", async () => {
    const customRouter = "0xABCDEF0123456789ABCDEF0123456789ABCDEF01";
    const result = await callTool("x402_paywall_setup", { language: "typescript", router_address: customRouter, ...SETUP_BASE }, makeMock()) as Record<string, unknown>;
    assert.ok((result["code"] as string).includes(customRouter), "must use provided router address");
  });

  it("uses provided asset address when given", async () => {
    const customUsdc = "0x1234567890123456789012345678901234567890";
    const result = await callTool("x402_paywall_setup", { language: "typescript", asset: customUsdc, ...SETUP_BASE }, makeMock()) as Record<string, unknown>;
    assert.ok((result["code"] as string).includes(customUsdc), "must use provided asset address");
  });

  it("rejects invalid wallet_address", async () => {
    await assert.rejects(
      () => callTool("x402_paywall_setup", { language: "python", wallet_address: "not-an-address", amount_usdc: 0.001, network: "eip155:84532" }, makeMock()),
      /InvalidParams|address/i,
    );
  });
});
