import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ALL_TOOLS, callTool, toolRegistry } from "../src/tools/index.js";
import { createMockWallet, ADDR, OTHER, TX } from "./fixtures.js";
import type { Escrow } from "../src/types.js";

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
    const result = await callTool("pay_direct", { to: OTHER, amount: 10, memo: "test" }, createMockWallet()) as Record<string, unknown>;
    assert.equal(result["success"], true);
    assert.equal(result["txHash"], "0x1234");
    assert.equal(result["status"], "confirmed");
  });

  it("key never appears in result", async () => {
    const result = JSON.stringify(await callTool("pay_direct", { to: OTHER, amount: 1 }, createMockWallet()));
    assert.ok(!result.includes("REMITMD_KEY"), "Key in result");
    assert.ok(!result.includes("privateKey"), "Private key in result");
  });
});

describe("create_escrow handler", () => {
  it("returns invoiceId and txHash", async () => {
    const result = await callTool(
      "create_escrow",
      { to: OTHER, amount: 100, task: "write code", timeout: 86400 },
      createMockWallet(),
    ) as Record<string, unknown>;
    assert.equal(result["success"], true);
    assert.equal(result["invoiceId"], "inv-1");
    assert.ok(result["txHash"]);
  });

  it("passes milestones through", async () => {
    let capturedInvoice: unknown;
    const mock = createMockWallet({
      pay: async (inv) => {
        capturedInvoice = inv;
        return { invoiceId: "inv-2", txHash: "0x5678", payer: ADDR, payee: OTHER, amount: 100, chain: "base", status: "funded", createdAt: 1_000_000 } as Escrow;
      },
    });
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
    const result = await callTool("release_escrow", { invoice_id: "inv-1" }, createMockWallet()) as Record<string, unknown>;
    assert.equal(result["success"], true);
    assert.equal(result["txHash"], "0x1234");
  });
});

describe("open_tab handler", () => {
  it("returns tabId and limit", async () => {
    const result = await callTool("open_tab", { to: OTHER, limit: 50, per_unit: 0.5 }, createMockWallet()) as Record<string, unknown>;
    assert.equal(result["success"], true);
    assert.equal(result["tabId"], "tab-1");
    assert.equal(result["limit"], 100);
  });
});

describe("close_tab handler", () => {
  it("returns txHash", async () => {
    const result = await callTool("close_tab", { tab_id: "tab-1" }, createMockWallet()) as Record<string, unknown>;
    assert.equal(result["success"], true);
  });
});

describe("open_stream handler", () => {
  it("returns streamId and rate", async () => {
    const result = await callTool("open_stream", { to: OTHER, rate: 0.001 }, createMockWallet()) as Record<string, unknown>;
    assert.equal(result["success"], true);
    assert.equal(result["streamId"], "stream-1");
    assert.equal(result["rate"], 0.001);
  });
});

describe("close_stream handler", () => {
  it("returns txHash", async () => {
    const result = await callTool("close_stream", { stream_id: "stream-1" }, createMockWallet()) as Record<string, unknown>;
    assert.equal(result["success"], true);
  });
});

describe("post_bounty handler", () => {
  it("returns bountyId", async () => {
    const result = await callTool(
      "post_bounty",
      { amount: 50, task: "find bug", deadline: 9_999_999 },
      createMockWallet(),
    ) as Record<string, unknown>;
    assert.equal(result["success"], true);
    assert.equal(result["bountyId"], "bounty-1");
  });
});

describe("award_bounty handler", () => {
  it("passes submission_id through", async () => {
    let capturedSubmissionId: number | undefined;
    const mock = createMockWallet({
      awardBounty: async (_id, submissionId) => {
        capturedSubmissionId = submissionId;
        return TX;
      },
    });
    await callTool("award_bounty", { bounty_id: "bounty-1", submission_id: 0 }, mock);
    assert.equal(capturedSubmissionId, 0);
  });
});

describe("place_deposit handler", () => {
  it("returns depositId", async () => {
    const result = await callTool(
      "place_deposit",
      { to: OTHER, amount: 25, expires: 86400 },
      createMockWallet(),
    ) as Record<string, unknown>;
    assert.equal(result["success"], true);
    assert.equal(result["depositId"], "dep-1");
  });
});

describe("check_balance handler", () => {
  it("returns balance and address", async () => {
    const result = await callTool("check_balance", {}, createMockWallet()) as Record<string, unknown>;
    assert.equal(result["balance"], 500.0);
    assert.equal(result["currency"], "USDC");
    assert.equal(result["address"], ADDR);
  });

  it("address field is the wallet address, not a key", async () => {
    const result = JSON.stringify(await callTool("check_balance", {}, createMockWallet()));
    assert.ok(result.includes(ADDR));
    assert.ok(!result.includes("privateKey"));
  });
});

describe("get_status handler", () => {
  it("returns full status with tier and counters", async () => {
    const result = await callTool("get_status", {}, createMockWallet()) as Record<string, unknown>;
    assert.equal(result["balance"], "500.00");
    assert.equal(result["tier"], "standard");
    assert.equal(result["activeEscrows"], 1);
    assert.equal(result["activeTabs"], 2);
    assert.equal(result["activeStreams"], 1);
    assert.equal(result["feeRateBps"], 100);
    assert.equal(result["monthlyVolume"], "1000.00");
  });
});

describe("error handling", () => {
  it("throws on unknown tool name", async () => {
    await assert.rejects(
      () => callTool("nonexistent_tool", {}, createMockWallet()),
      /Unknown tool: nonexistent_tool/,
    );
  });

  it("propagates wallet errors", async () => {
    const mock = createMockWallet({
      payDirect: async () => {
        throw new Error("InsufficientBalance");
      },
    });
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
    await callTool("x402_config", { max_auto_pay_usdc: 0.10, enabled: true }, createMockWallet());
    const result = await callTool("x402_config", {}, createMockWallet()) as Record<string, unknown>;
    assert.equal(result["success"], true);
    const config = result["config"] as Record<string, unknown>;
    assert.equal(config["enabled"], true);
    assert.equal(config["maxAutoPayUsdc"], 0.10);
  });

  it("updates maxAutoPayUsdc", async () => {
    const result = await callTool("x402_config", { max_auto_pay_usdc: 0.05 }, createMockWallet()) as Record<string, unknown>;
    const config = result["config"] as Record<string, unknown>;
    assert.equal(config["maxAutoPayUsdc"], 0.05);
    // Reset
    await callTool("x402_config", { max_auto_pay_usdc: 0.10 }, createMockWallet());
  });

  it("can disable and re-enable auto-pay", async () => {
    let result = await callTool("x402_config", { enabled: false }, createMockWallet()) as Record<string, unknown>;
    assert.equal((result["config"] as Record<string, unknown>)["enabled"], false);
    result = await callTool("x402_config", { enabled: true }, createMockWallet()) as Record<string, unknown>;
    assert.equal((result["config"] as Record<string, unknown>)["enabled"], true);
  });
});

// ─── x402_pay handler ────────────────────────────────────────────────────────

describe("x402_pay handler", () => {
  it("calls wallet.x402Fetch with url and session limit", async () => {
    await callTool("x402_config", { enabled: true, max_auto_pay_usdc: 0.10 }, createMockWallet());
    let capturedUrl: string | undefined;
    let capturedLimit: number | undefined;
    const mock = createMockWallet({
      x402Fetch: async (url, limit) => {
        capturedUrl = url;
        capturedLimit = limit;
        return { response: new Response('{"ok":true}', { status: 200 }), lastPayment: null };
      },
    });
    const result = await callTool("x402_pay", { url: "https://example.com/resource" }, mock) as Record<string, unknown>;
    assert.equal(result["status"], 200);
    assert.equal(result["ok"], true);
    assert.equal(capturedUrl, "https://example.com/resource");
    assert.equal(capturedLimit, 0.10);
  });

  it("uses per-request max_usdc when provided", async () => {
    await callTool("x402_config", { enabled: true, max_auto_pay_usdc: 0.10 }, createMockWallet());
    let capturedLimit: number | undefined;
    const mock = createMockWallet({
      x402Fetch: async (_url, limit) => {
        capturedLimit = limit;
        return { response: new Response("data", { status: 200 }), lastPayment: null };
      },
    });
    await callTool("x402_pay", { url: "https://example.com/resource", max_usdc: 0.50 }, mock);
    assert.equal(capturedLimit, 0.50);
  });

  it("returns body text from response", async () => {
    await callTool("x402_config", { enabled: true }, createMockWallet());
    const mock = createMockWallet({
      x402Fetch: async () => ({ response: new Response('{"result":"success"}', { status: 200 }), lastPayment: null }),
    });
    const result = await callTool("x402_pay", { url: "https://example.com/resource" }, mock) as Record<string, unknown>;
    assert.equal(result["body"], '{"result":"success"}');
  });

  it("includes V2 payment metadata when lastPayment is present", async () => {
    await callTool("x402_config", { enabled: true }, createMockWallet());
    const mock = createMockWallet({
      x402Fetch: async () => ({
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
      }),
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
    await callTool("x402_config", { enabled: true }, createMockWallet());
    const mock = createMockWallet({
      x402Fetch: async () => ({ response: new Response("ok", { status: 200 }), lastPayment: null }),
    });
    const result = await callTool("x402_pay", { url: "https://example.com/free" }, mock) as Record<string, unknown>;
    assert.equal(result["payment"], undefined, "payment field must be absent when no x402 occurred");
  });

  it("throws McpError when auto-pay is disabled", async () => {
    await callTool("x402_config", { enabled: false }, createMockWallet());
    await assert.rejects(
      () => callTool("x402_pay", { url: "https://example.com/resource" }, createMockWallet()),
      /disabled/,
    );
    // Re-enable for subsequent tests
    await callTool("x402_config", { enabled: true }, createMockWallet());
  });

  it("rejects invalid URL", async () => {
    await callTool("x402_config", { enabled: true }, createMockWallet());
    await assert.rejects(
      () => callTool("x402_pay", { url: "not-a-url" }, createMockWallet()),
      /InvalidParams|url/i,
    );
  });
});

// ─── create_fund_link handler ─────────────────────────────────────────────────

describe("create_fund_link handler", () => {
  it("returns url, token, expiresAt, walletAddress", async () => {
    const result = await callTool("create_fund_link", {}, createMockWallet()) as Record<string, unknown>;
    assert.equal(result["url"], "https://remit.md/fund/abc");
    assert.equal(result["token"], "abc");
    assert.equal(result["walletAddress"], ADDR);
    assert.ok(result["expiresAt"]);
  });
});

// ─── create_withdraw_link handler ────────────────────────────────────────────

describe("create_withdraw_link handler", () => {
  it("returns url, token, expiresAt, walletAddress", async () => {
    const result = await callTool("create_withdraw_link", {}, createMockWallet()) as Record<string, unknown>;
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
    const result = await callTool("x402_paywall_setup", { language: "python", ...SETUP_BASE }, createMockWallet()) as Record<string, unknown>;
    assert.ok(typeof result["install"] === "string", "install must be a string");
    assert.ok(typeof result["code"] === "string", "code must be a string");
    assert.ok((result["install"] as string).includes("remitmd"), "install must mention remitmd");
    assert.ok((result["code"] as string).includes("fastapi_dependency"), "FastAPI code must use fastapi_dependency");
    assert.ok((result["code"] as string).includes(OTHER), "code must embed wallet_address");
    assert.ok((result["code"] as string).includes("0.001"), "code must embed amount_usdc");
  });

  it("returns Flask code when framework=flask", async () => {
    const result = await callTool("x402_paywall_setup", { language: "python", framework: "flask", ...SETUP_BASE }, createMockWallet()) as Record<string, unknown>;
    assert.ok((result["code"] as string).includes("flask_route"), "Flask code must use flask_route");
    assert.ok((result["install"] as string).includes("flask"), "install must mention flask");
  });

  it("returns Hono code for TypeScript (default)", async () => {
    const result = await callTool("x402_paywall_setup", { language: "typescript", ...SETUP_BASE }, createMockWallet()) as Record<string, unknown>;
    assert.ok((result["code"] as string).includes("honoMiddleware"), "TS default must use honoMiddleware");
    assert.ok((result["install"] as string).includes("hono"), "install must mention hono");
  });

  it("returns Express code when framework=express", async () => {
    const result = await callTool("x402_paywall_setup", { language: "typescript", framework: "express", ...SETUP_BASE }, createMockWallet()) as Record<string, unknown>;
    assert.ok((result["code"] as string).includes("paywall.check"), "Express code must use paywall.check");
    assert.ok((result["install"] as string).includes("express"), "install must mention express");
  });

  it("returns Go code", async () => {
    const result = await callTool("x402_paywall_setup", { language: "go", ...SETUP_BASE }, createMockWallet()) as Record<string, unknown>;
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
    }, createMockWallet()) as Record<string, unknown>;
    const code = result["code"] as string;
    assert.ok(code.includes("/v1/data"), "code must include resource");
    assert.ok(code.includes("Market data"), "code must include description");
    assert.ok(code.includes("application/json"), "code must include mime_type");
  });

  it("uses default USDC address when asset omitted", async () => {
    const result = await callTool("x402_paywall_setup", { language: "python", ...SETUP_BASE }, createMockWallet()) as Record<string, unknown>;
    assert.ok((result["code"] as string).includes("0x2d846325766921935f37d5b4478196d3ef93707c"), "must use default USDC");
  });

  it("uses default Router address when router_address omitted", async () => {
    const result = await callTool("x402_paywall_setup", { language: "python", ...SETUP_BASE }, createMockWallet()) as Record<string, unknown>;
    assert.ok((result["code"] as string).includes("0x3120f396ff6a9afc5a9d92e28796082f1429e024"), "must use default Router");
    assert.ok((result["code"] as string).includes("router_address"), "Python code must include router_address param");
  });

  it("uses provided router_address when given", async () => {
    const customRouter = "0xABCDEF0123456789ABCDEF0123456789ABCDEF01";
    const result = await callTool("x402_paywall_setup", { language: "typescript", router_address: customRouter, ...SETUP_BASE }, createMockWallet()) as Record<string, unknown>;
    assert.ok((result["code"] as string).includes(customRouter), "must use provided router address");
  });

  it("uses provided asset address when given", async () => {
    const customUsdc = "0x1234567890123456789012345678901234567890";
    const result = await callTool("x402_paywall_setup", { language: "typescript", asset: customUsdc, ...SETUP_BASE }, createMockWallet()) as Record<string, unknown>;
    assert.ok((result["code"] as string).includes(customUsdc), "must use provided asset address");
  });

  it("rejects invalid wallet_address", async () => {
    await assert.rejects(
      () => callTool("x402_paywall_setup", { language: "python", wallet_address: "not-an-address", amount_usdc: 0.001, network: "eip155:84532" }, createMockWallet()),
      /InvalidParams|address/i,
    );
  });
});

// ─── register_webhook handler ─────────────────────────────────────────────────

describe("register_webhook handler", () => {
  it("returns webhook id and metadata", async () => {
    const result = await callTool("register_webhook", {
      url: "https://example.com/webhook",
      events: ["payment.sent", "escrow.funded"],
    }, createMockWallet()) as Record<string, unknown>;
    assert.equal(result["success"], true);
    assert.equal(result["id"], "wh-1");
    assert.equal(result["url"], "https://example.com/webhook");
    assert.deepEqual(result["events"], ["payment.sent", "escrow.funded"]);
    assert.equal(result["active"], true);
  });

  it("passes chains through", async () => {
    let capturedChains: string[] | undefined;
    const mock = createMockWallet({
      registerWebhook: async (_url, _events, chains) => {
        capturedChains = chains;
        return { id: "wh-2", wallet: ADDR, url: "", events: [], chains: chains ?? [], active: true, createdAt: 1_000_000 };
      },
    });
    await callTool("register_webhook", {
      url: "https://example.com/webhook",
      events: ["payment.sent"],
      chains: ["base"],
    }, mock);
    assert.deepEqual(capturedChains, ["base"]);
  });

  it("rejects HTTP URL", async () => {
    await assert.rejects(
      () => callTool("register_webhook", {
        url: "http://example.com/webhook",
        events: ["payment.sent"],
      }, createMockWallet()),
      /InvalidParams|url/i,
    );
  });

  it("rejects invalid event type", async () => {
    await assert.rejects(
      () => callTool("register_webhook", {
        url: "https://example.com/webhook",
        events: ["invalid.event"],
      }, createMockWallet()),
      /InvalidParams|events/i,
    );
  });

  it("rejects empty events array", async () => {
    await assert.rejects(
      () => callTool("register_webhook", {
        url: "https://example.com/webhook",
        events: [],
      }, createMockWallet()),
      /InvalidParams|events/i,
    );
  });
});

// ─── list_webhooks handler ────────────────────────────────────────────────────

describe("list_webhooks handler", () => {
  it("returns webhooks array", async () => {
    const result = await callTool("list_webhooks", {}, createMockWallet()) as Record<string, unknown>;
    assert.ok(Array.isArray(result["webhooks"]), "webhooks must be an array");
  });
});

// ─── delete_webhook handler ───────────────────────────────────────────────────

describe("delete_webhook handler", () => {
  it("returns success with id", async () => {
    const result = await callTool("delete_webhook", { id: "wh-1" }, createMockWallet()) as Record<string, unknown>;
    assert.equal(result["success"], true);
    assert.equal(result["id"], "wh-1");
  });

  it("calls wallet.deleteWebhook with correct id", async () => {
    let capturedId: string | undefined;
    const mock = createMockWallet({
      deleteWebhook: async (id) => {
        capturedId = id;
      },
    });
    await callTool("delete_webhook", { id: "wh-42" }, mock);
    assert.equal(capturedId, "wh-42");
  });

  it("rejects empty id", async () => {
    await assert.rejects(
      () => callTool("delete_webhook", { id: "" }, createMockWallet()),
      /InvalidParams|id/i,
    );
  });
});
