import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { listPrompts, getPrompt } from "../src/prompts/index.js";
import type { PromptMessage } from "../src/prompts/index.js";

// ─── listPrompts ──────────────────────────────────────────────────────────────

describe("listPrompts", () => {
  it("returns exactly 3 prompts", () => {
    assert.equal(listPrompts().length, 3);
  });

  it("has hire_agent, negotiate_price, verify_delivery", () => {
    const names = listPrompts().map((p) => p.name);
    assert.ok(names.includes("hire_agent"), "missing hire_agent");
    assert.ok(names.includes("negotiate_price"), "missing negotiate_price");
    assert.ok(names.includes("verify_delivery"), "missing verify_delivery");
  });

  it("every prompt has a description", () => {
    for (const p of listPrompts()) {
      assert.ok(p.description && p.description.length > 5, `Short description on ${p.name}`);
    }
  });

  it("every prompt declares its arguments", () => {
    for (const p of listPrompts()) {
      assert.ok(p.arguments && p.arguments.length > 0, `No arguments on ${p.name}`);
    }
  });
});

// ─── hire_agent ───────────────────────────────────────────────────────────────

describe("hire_agent prompt", () => {
  it("returns 2 messages (user + assistant)", () => {
    const msgs = getPrompt("hire_agent", { task: "write API", budget: "100" });
    assert.equal(msgs.length, 2);
    assert.equal(msgs[0]!.role, "user");
    assert.equal(msgs[1]!.role, "assistant");
  });

  it("user message includes task and budget", () => {
    const msgs = getPrompt("hire_agent", { task: "build a website", budget: "250" });
    const userText = msgs[0]!.content.text;
    assert.ok(userText.includes("build a website"), "task not in user message");
    assert.ok(userText.includes("250"), "budget not in user message");
  });

  it("assistant message mentions create_escrow tool", () => {
    const msgs = getPrompt("hire_agent", { task: "review code", budget: "50" });
    const assistantText = msgs[1]!.content.text;
    assert.ok(assistantText.includes("create_escrow"), "create_escrow not in assistant message");
  });

  it("assistant message mentions release_escrow", () => {
    const msgs = getPrompt("hire_agent", { task: "test", budget: "10" });
    assert.ok(msgs[1]!.content.text.includes("release_escrow"));
  });

  it("all message content is type:text", () => {
    const msgs = getPrompt("hire_agent", { task: "t", budget: "1" });
    for (const msg of msgs) {
      assert.equal(msg.content.type, "text");
    }
  });

  it("key never appears in response", () => {
    const text = JSON.stringify(getPrompt("hire_agent", { task: "t", budget: "1" }));
    assert.ok(!text.includes("privateKey"));
    assert.ok(!text.includes("REMITMD_KEY"));
  });
});

// ─── negotiate_price ──────────────────────────────────────────────────────────

describe("negotiate_price prompt", () => {
  it("returns 2 messages", () => {
    const msgs = getPrompt("negotiate_price", { service: "SEO audit", initial_price: "500" });
    assert.equal(msgs.length, 2);
  });

  it("includes service and price in user message", () => {
    const msgs = getPrompt("negotiate_price", { service: "data analysis", initial_price: "200" });
    const userText = msgs[0]!.content.text;
    assert.ok(userText.includes("data analysis"));
    assert.ok(userText.includes("200"));
  });

  it("assistant message mentions get_status for reputation check", () => {
    const msgs = getPrompt("negotiate_price", { service: "writing", initial_price: "100" });
    assert.ok(msgs[1]!.content.text.includes("get_status"));
  });

  it("assistant message mentions place_deposit as risk mitigation", () => {
    const msgs = getPrompt("negotiate_price", { service: "writing", initial_price: "100" });
    assert.ok(msgs[1]!.content.text.includes("place_deposit"));
  });
});

// ─── verify_delivery ──────────────────────────────────────────────────────────

describe("verify_delivery prompt", () => {
  it("returns 2 messages", () => {
    const msgs = getPrompt("verify_delivery", { invoice_id: "inv-42" });
    assert.equal(msgs.length, 2);
  });

  it("includes invoice_id in both messages", () => {
    const msgs = getPrompt("verify_delivery", { invoice_id: "inv-42" });
    assert.ok(msgs[0]!.content.text.includes("inv-42"), "invoice_id missing from user message");
    assert.ok(msgs[1]!.content.text.includes("inv-42"), "invoice_id missing from assistant message");
  });

  it("assistant message mentions release_escrow", () => {
    const msgs = getPrompt("verify_delivery", { invoice_id: "inv-42" });
    assert.ok(msgs[1]!.content.text.includes("release_escrow"));
  });

  it("assistant message references escrow resource URI", () => {
    const msgs = getPrompt("verify_delivery", { invoice_id: "inv-42" });
    assert.ok(msgs[1]!.content.text.includes("remit://escrow/inv-42/status"));
  });
});

// ─── error handling ───────────────────────────────────────────────────────────

describe("getPrompt error handling", () => {
  it("throws on unknown prompt name", () => {
    assert.throws(
      () => getPrompt("nonexistent_prompt", {}),
      /Unknown prompt: nonexistent_prompt/,
    );
  });
});

// ─── Message structure ────────────────────────────────────────────────────────

describe("prompt message structure", () => {
  it("all messages have role and content.type=text", () => {
    const allPrompts: Array<[string, Record<string, string>]> = [
      ["hire_agent", { task: "t", budget: "10" }],
      ["negotiate_price", { service: "s", initial_price: "10" }],
      ["verify_delivery", { invoice_id: "inv-1" }],
    ];
    for (const [name, args] of allPrompts) {
      const msgs = getPrompt(name, args) as PromptMessage[];
      for (const msg of msgs) {
        assert.ok(
          msg.role === "user" || msg.role === "assistant",
          `Invalid role: ${msg.role}`,
        );
        assert.equal(msg.content.type, "text");
        assert.ok(msg.content.text.length > 0, `Empty text in ${name}`);
      }
    }
  });
});
