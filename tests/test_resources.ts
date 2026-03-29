import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { listResources, readResource } from "../src/resources/index.js";
import { createMockWallet, ADDR, OTHER } from "./fixtures.js";

// ─── listResources ────────────────────────────────────────────────────────────

describe("listResources", () => {
  it("returns exactly 8 resources", () => {
    assert.equal(listResources().length, 8);
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
      createMockWallet(),
    );
    assert.equal(mimeType, "application/json");
    const data = JSON.parse(text) as Record<string, unknown>;
    assert.equal(data["address"], OTHER);
    assert.equal(data["balance"], "100.00");
    assert.equal(data["currency"], "USDC");
  });
});

describe("readResource - wallet/reputation", () => {
  it("returns reputation with score", async () => {
    const { text } = await readResource(`remit://wallet/${OTHER}/reputation`, createMockWallet());
    const data = JSON.parse(text) as Record<string, unknown>;
    assert.equal(data["score"], 95);
  });
});

describe("readResource - invoice", () => {
  it("returns invoice data", async () => {
    const { text } = await readResource("remit://invoice/inv-42", createMockWallet());
    const data = JSON.parse(text) as Record<string, unknown>;
    assert.equal(data["amount"], 75);
    assert.equal(data["paymentType"], "escrow");
  });
});

describe("readResource - escrow/status", () => {
  it("returns escrow with invoiceId", async () => {
    const { text } = await readResource("remit://escrow/inv-99/status", createMockWallet());
    const data = JSON.parse(text) as Record<string, unknown>;
    assert.equal(data["invoiceId"], "inv-99");
    assert.equal(data["status"], "funded");
  });
});

describe("readResource - tab/usage", () => {
  it("returns tab with spent field", async () => {
    const { text } = await readResource("remit://tab/tab-55/usage", createMockWallet());
    const data = JSON.parse(text) as Record<string, unknown>;
    assert.equal(data["id"], "tab-55");
    assert.equal(data["spent"], 10);
  });
});

describe("readResource - stream/status", () => {
  it("returns stream with rate and total streamed", async () => {
    const { text } = await readResource("remit://stream/stream-42/status", createMockWallet());
    const data = JSON.parse(text) as Record<string, unknown>;
    assert.equal(data["id"], "stream-42");
    assert.equal(data["ratePerSecond"], 0.001);
    assert.equal(data["totalStreamed"], 1.5);
    assert.equal(data["status"], "active");
  });
});

describe("readResource - bounty/submissions", () => {
  it("returns bounty data", async () => {
    const { text } = await readResource("remit://bounty/bounty-7/submissions", createMockWallet());
    const data = JSON.parse(text) as Record<string, unknown>;
    assert.equal(data["id"], "bounty-7");
    assert.equal(data["task"], "find the bug");
  });
});

describe("readResource - deposit/status", () => {
  it("returns deposit with status", async () => {
    const { text } = await readResource("remit://deposit/dep-3/status", createMockWallet());
    const data = JSON.parse(text) as Record<string, unknown>;
    assert.equal(data["id"], "dep-3");
    assert.equal(data["status"], "locked");
    assert.equal(data["amount"], 25);
  });
});

describe("readResource - error cases", () => {
  it("throws on unknown URI scheme", async () => {
    await assert.rejects(
      () => readResource("remit://unknown/path", createMockWallet()),
      /Unknown resource URI/,
    );
  });

  it("throws on non-remit URI", async () => {
    await assert.rejects(
      () => readResource("https://example.com", createMockWallet()),
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
      "remit://stream/stream-1/status",
      "remit://bounty/b-1/submissions",
      "remit://deposit/dep-1/status",
    ];
    for (const uri of uris) {
      const { text } = await readResource(uri, createMockWallet());
      assert.ok(!text.includes("privateKey"), `Private key in ${uri} response`);
      assert.ok(!text.includes("REMITMD_KEY"), `Env key in ${uri} response`);
    }
  });
});
