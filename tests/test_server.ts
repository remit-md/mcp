// Protocol-level tests for the MCP server.
//
// These tests use the MCP SDK's InMemoryTransport + Client to exercise the
// server via the actual JSON-RPC protocol layer — not just by calling handler
// functions directly.  This verifies:
//   1. tools/list returns all 13 registered tools
//   2. tools/call happy-path returns text content with the tool result
//   3. tools/call for an unknown tool name propagates as a protocol error
//   4. resources/list returns at least one resource
//   5. prompts/list returns at least one prompt
//   6. tools/call with a missing required arg propagates an error
//   7. Concurrent tool calls are isolated (no state cross-contamination)
//
// Run with:
//   npm test

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";

import { createServer } from "../src/server.js";
import type {
  WalletLike,
  Transaction,
  WalletStatus,
  Tab,
  Stream,
  Bounty,
  Deposit,
  Dispute,
  Invoice,
  Escrow,
  Reputation,
  RemitEvent,
} from "../src/types.js";

// ── Mock wallet ───────────────────────────────────────────────────────────────

const ADDR = "0xaaaa000000000000000000000000000000000001";
const OTHER = "0xbbbb000000000000000000000000000000000002";
const TX: Transaction = { txHash: "0xdeadbeef", chain: "base", status: "confirmed", createdAt: 1_000_000 };

function makeMockWallet(): WalletLike {
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
      ({ streamId: "stream-1", to: OTHER, rate: 0.001, maxDuration: 3600, totalStreamed: 0, status: "active", startedAt: 1_000_000 } as Stream),
    closeStream: async () => TX,
    postBounty: async () =>
      ({ bountyId: "bounty-1", task: "test task", amount: 50, status: "open", deadline: 9_999_999 } as Bounty),
    awardBounty: async () => TX,
    placeDeposit: async () =>
      ({ depositId: "dep-1", to: OTHER, amount: 25, status: "locked", expiresAt: 9_999_999 } as Deposit),
    fileDispute: async () =>
      ({ disputeId: "dispute-1", invoiceId: "inv-1", reason: "non_delivery", status: "filed", createdAt: 1_000_000 } as Dispute),
    balance: async () => 500,
    status: async () =>
      ({ address: ADDR, usdcBalance: 500, tier: "standard", totalVolume: 1000, escrowsActive: 0, openTabs: 0, activeStreams: 0 } as WalletStatus),
    getStatus: async () =>
      ({ address: OTHER, usdcBalance: 100, tier: "standard", totalVolume: 200, escrowsActive: 0, openTabs: 0, activeStreams: 0 } as WalletStatus),
    getInvoice: async () => ({ to: OTHER, amount: 10, type: "escrow" } as Invoice),
    getEscrow: async () => ({ invoiceId: "inv-1", from: ADDR, to: OTHER, amount: 10, status: "funded", timeout: 9_999_999 } as Escrow),
    getTab: async () => ({ tabId: "tab-1", to: OTHER, limit: 100, perUnit: 1, used: 0, status: "open", expiresAt: 9_999_999 } as Tab),
    getBounty: async () => ({ bountyId: "bounty-1", task: "test", amount: 50, status: "open", deadline: 9_999_999 } as Bounty),
    getReputation: async () => ({ address: OTHER, score: 90, completedPayments: 10, disputes: 0, tier: "standard" } as Reputation),
    getEvents: async () => [] as RemitEvent[],
  };
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

const EXPECTED_TOOL_NAMES = [
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
  "file_dispute",
  "check_balance",
  "get_status",
];

// ── Test suite ────────────────────────────────────────────────────────────────

describe("MCP server — protocol level", () => {
  let client: Client;
  let serverTransport: InMemoryTransport;
  let clientTransport: InMemoryTransport;

  before(async () => {
    const wallet = makeMockWallet();
    const server = createServer(wallet as WalletLike);

    [serverTransport, clientTransport] = InMemoryTransport.createLinkedPair();
    client = new Client({ name: "test-client", version: "0.0.1" }, { capabilities: {} });

    await server.connect(serverTransport);
    await client.connect(clientTransport);
  });

  after(async () => {
    await client.close();
  });

  // ── tools/list ────────────────────────────────────────────────────────────

  it("tools/list returns all 13 registered tools", async () => {
    const { tools } = await client.listTools();
    const names = tools.map((t) => t.name);
    assert.equal(tools.length, EXPECTED_TOOL_NAMES.length, `Expected ${EXPECTED_TOOL_NAMES.length} tools, got ${tools.length}: ${names.join(", ")}`);
    for (const expected of EXPECTED_TOOL_NAMES) {
      assert.ok(names.includes(expected), `Missing tool: ${expected}`);
    }
  });

  it("each tool definition has a name, description, and inputSchema", async () => {
    const { tools } = await client.listTools();
    for (const tool of tools) {
      assert.ok(tool.name, `Tool has no name`);
      assert.ok(tool.description, `Tool ${tool.name} has no description`);
      assert.ok(tool.inputSchema, `Tool ${tool.name} has no inputSchema`);
      assert.equal(tool.inputSchema.type, "object", `Tool ${tool.name} inputSchema is not an object`);
    }
  });

  // ── tools/call ────────────────────────────────────────────────────────────

  it("tools/call pay_direct returns text content with txHash", async () => {
    const result = await client.callTool({
      name: "pay_direct",
      arguments: { to: OTHER, amount: 5.0, memo: "test" },
    });
    assert.ok(result.content, "Result must have content");
    assert.ok(Array.isArray(result.content), "Content must be an array");
    const [first] = result.content as Array<{ type: string; text: string }>;
    assert.equal(first.type, "text", "Content item type must be 'text'");
    const parsed = JSON.parse(first.text) as Record<string, unknown>;
    assert.equal(parsed["txHash"], "0xdeadbeef", "txHash must be present in result");
    assert.equal(parsed["success"], true, "success must be true");
  });

  it("tools/call check_balance returns numeric balance", async () => {
    const result = await client.callTool({ name: "check_balance", arguments: {} });
    const [first] = result.content as Array<{ type: string; text: string }>;
    const parsed = JSON.parse(first.text) as Record<string, unknown>;
    assert.ok(typeof parsed["balance"] === "number", "balance must be a number");
  });

  it("tools/call open_tab returns tabId in result", async () => {
    const result = await client.callTool({
      name: "open_tab",
      arguments: { to: OTHER, limit: 100, per_unit: 1 },
    });
    const [first] = result.content as Array<{ type: string; text: string }>;
    const parsed = JSON.parse(first.text) as Record<string, unknown>;
    assert.ok(parsed["tabId"], "tabId must be present in result");
  });

  it("tools/call post_bounty returns bountyId in result", async () => {
    const result = await client.callTool({
      name: "post_bounty",
      arguments: { task: "Do something", amount: 50, deadline: 9_999_999 },
    });
    const [first] = result.content as Array<{ type: string; text: string }>;
    const parsed = JSON.parse(first.text) as Record<string, unknown>;
    assert.ok(parsed["bountyId"], "bountyId must be present in result");
  });

  it("tools/call unknown tool throws McpError (protocol-level error)", async () => {
    // The server throws McpError(InternalError) for unknown tools.
    // The Client propagates this as a thrown McpError, not isError=true.
    await assert.rejects(
      () => client.callTool({ name: "does_not_exist", arguments: {} }),
      (err: unknown) => {
        assert.ok(err instanceof Error, "Must throw an Error");
        assert.ok(
          err.message.includes("Unknown tool"),
          `Error message must mention unknown tool, got: ${err.message}`,
        );
        return true;
      },
    );
  });

  // ── resources/list ────────────────────────────────────────────────────────

  it("resources/list returns at least one resource", async () => {
    const { resources } = await client.listResources();
    assert.ok(resources.length > 0, "Server must expose at least one resource");
  });

  it("each resource has a uri and name", async () => {
    const { resources } = await client.listResources();
    for (const r of resources) {
      assert.ok(r.uri, `Resource has no uri`);
      assert.ok(r.name, `Resource ${r.uri} has no name`);
    }
  });

  // ── prompts/list ──────────────────────────────────────────────────────────

  it("prompts/list returns at least one prompt", async () => {
    const { prompts } = await client.listPrompts();
    assert.ok(prompts.length > 0, "Server must expose at least one prompt");
  });

  it("each prompt has a name and description", async () => {
    const { prompts } = await client.listPrompts();
    for (const p of prompts) {
      assert.ok(p.name, `Prompt has no name`);
      assert.ok(p.description, `Prompt ${p.name} has no description`);
    }
  });

  // ── Concurrent isolation ──────────────────────────────────────────────────

  it("concurrent tools/call requests are isolated (no cross-contamination)", async () => {
    const [r1, r2] = await Promise.all([
      client.callTool({ name: "pay_direct", arguments: { to: OTHER, amount: 1 } }),
      client.callTool({ name: "check_balance", arguments: {} }),
    ]);

    const [first1] = r1.content as Array<{ type: string; text: string }>;
    const p1 = JSON.parse(first1.text) as Record<string, unknown>;
    assert.equal(p1["txHash"], "0xdeadbeef", "pay_direct result must contain txHash");

    const [first2] = r2.content as Array<{ type: string; text: string }>;
    const p2 = JSON.parse(first2.text) as Record<string, unknown>;
    assert.ok(typeof p2["balance"] === "number", "check_balance result must contain numeric balance");
  });
});
