// Unit tests for Zod input validation schemas (src/tools/validate.ts).
//
// Verifies that:
//   - Valid input passes through unchanged
//   - Invalid input throws McpError with ErrorCode.InvalidParams
//   - Error messages mention the offending field

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import {
  parseInput,
  PayDirectArgs,
  CreateEscrowArgs,
  ReleaseEscrowArgs,
  OpenTabArgs,
  CloseTabArgs,
  OpenStreamArgs,
  CloseStreamArgs,
  PostBountyArgs,
  AwardBountyArgs,
  PlaceDepositArgs,
  RegisterWebhookArgs,
  DeleteWebhookArgs,
  X402PayArgs,
  X402ConfigArgs,
} from "../src/tools/validate.js";

const ADDR = "0xaaaa000000000000000000000000000000000001";

function expectInvalidParams(fn: () => unknown, fieldHint?: string): void {
  try {
    fn();
    assert.fail("Expected McpError(InvalidParams) to be thrown");
  } catch (err: unknown) {
    assert.ok(err instanceof McpError, `Expected McpError, got ${String(err)}`);
    assert.equal((err as McpError).code, ErrorCode.InvalidParams, "Error code must be InvalidParams");
    if (fieldHint) {
      assert.ok(
        (err as McpError).message.includes(fieldHint),
        `Error message "${(err as McpError).message}" must mention "${fieldHint}"`,
      );
    }
  }
}

// ── PayDirectArgs ─────────────────────────────────────────────────────────────

describe("PayDirectArgs", () => {
  it("accepts valid args", () => {
    const result = parseInput(PayDirectArgs, { to: ADDR, amount: 5.0, memo: "hi" });
    assert.equal(result.to, ADDR);
    assert.equal(result.amount, 5.0);
    assert.equal(result.memo, "hi");
  });

  it("accepts args without optional memo", () => {
    const result = parseInput(PayDirectArgs, { to: ADDR, amount: 1.0 });
    assert.equal(result.memo, undefined);
  });

  it("rejects non-address 'to'", () => {
    expectInvalidParams(() => parseInput(PayDirectArgs, { to: "not-an-address", amount: 1 }), "to");
  });

  it("rejects missing 'to'", () => {
    expectInvalidParams(() => parseInput(PayDirectArgs, { amount: 1 }), "to");
  });

  it("rejects zero amount", () => {
    expectInvalidParams(() => parseInput(PayDirectArgs, { to: ADDR, amount: 0 }), "amount");
  });

  it("rejects negative amount", () => {
    expectInvalidParams(() => parseInput(PayDirectArgs, { to: ADDR, amount: -5 }), "amount");
  });
});

// ── CreateEscrowArgs ──────────────────────────────────────────────────────────

describe("CreateEscrowArgs", () => {
  it("accepts valid args", () => {
    const result = parseInput(CreateEscrowArgs, { to: ADDR, amount: 100, task: "Build it", timeout: 86400 });
    assert.equal(result.timeout, 86400);
  });

  it("rejects empty task", () => {
    expectInvalidParams(
      () => parseInput(CreateEscrowArgs, { to: ADDR, amount: 100, task: "", timeout: 86400 }),
      "task",
    );
  });

  it("rejects non-integer timeout", () => {
    expectInvalidParams(
      () => parseInput(CreateEscrowArgs, { to: ADDR, amount: 100, task: "x", timeout: 1.5 }),
      "timeout",
    );
  });
});

// ── ReleaseEscrowArgs ─────────────────────────────────────────────────────────

describe("ReleaseEscrowArgs", () => {
  it("accepts valid invoice_id", () => {
    const result = parseInput(ReleaseEscrowArgs, { invoice_id: "inv-123" });
    assert.equal(result.invoice_id, "inv-123");
  });

  it("rejects empty invoice_id", () => {
    expectInvalidParams(() => parseInput(ReleaseEscrowArgs, { invoice_id: "" }), "invoice_id");
  });

  it("rejects missing invoice_id", () => {
    expectInvalidParams(() => parseInput(ReleaseEscrowArgs, {}), "invoice_id");
  });
});

// ── OpenTabArgs ───────────────────────────────────────────────────────────────

describe("OpenTabArgs", () => {
  it("accepts valid args", () => {
    const result = parseInput(OpenTabArgs, { to: ADDR, limit: 10, per_unit: 0.01 });
    assert.equal(result.per_unit, 0.01);
  });

  it("rejects zero per_unit", () => {
    expectInvalidParams(() => parseInput(OpenTabArgs, { to: ADDR, limit: 10, per_unit: 0 }), "per_unit");
  });

  it("rejects non-address 'to'", () => {
    expectInvalidParams(() => parseInput(OpenTabArgs, { to: "bad", limit: 10, per_unit: 0.01 }), "to");
  });
});

// ── CloseTabArgs ──────────────────────────────────────────────────────────────

describe("CloseTabArgs", () => {
  it("accepts valid tab_id", () => {
    const result = parseInput(CloseTabArgs, { tab_id: "tab-abc" });
    assert.equal(result.tab_id, "tab-abc");
  });

  it("rejects empty tab_id", () => {
    expectInvalidParams(() => parseInput(CloseTabArgs, { tab_id: "" }), "tab_id");
  });
});

// ── OpenStreamArgs ────────────────────────────────────────────────────────────

describe("OpenStreamArgs", () => {
  it("accepts valid args", () => {
    const result = parseInput(OpenStreamArgs, { to: ADDR, rate: 0.001 });
    assert.equal(result.max_duration, undefined);
  });

  it("rejects non-positive rate", () => {
    expectInvalidParams(() => parseInput(OpenStreamArgs, { to: ADDR, rate: 0 }), "rate");
  });
});

// ── CloseStreamArgs ───────────────────────────────────────────────────────────

describe("CloseStreamArgs", () => {
  it("accepts valid stream_id", () => {
    const result = parseInput(CloseStreamArgs, { stream_id: "s-1" });
    assert.equal(result.stream_id, "s-1");
  });

  it("rejects empty stream_id", () => {
    expectInvalidParams(() => parseInput(CloseStreamArgs, { stream_id: "" }), "stream_id");
  });
});

// ── PostBountyArgs ────────────────────────────────────────────────────────────

describe("PostBountyArgs", () => {
  it("accepts valid args including validation enum", () => {
    const result = parseInput(PostBountyArgs, {
      amount: 100,
      task: "Do the thing",
      deadline: 9_999_999,
      validation: "oracle",
    });
    assert.equal(result.validation, "oracle");
  });

  it("rejects invalid validation enum value", () => {
    expectInvalidParams(
      () => parseInput(PostBountyArgs, { amount: 100, task: "x", deadline: 999, validation: "unknown" }),
      "validation",
    );
  });

  it("rejects zero amount", () => {
    expectInvalidParams(() => parseInput(PostBountyArgs, { amount: 0, task: "x", deadline: 999 }), "amount");
  });
});

// ── AwardBountyArgs ───────────────────────────────────────────────────────────

describe("AwardBountyArgs", () => {
  it("accepts valid args", () => {
    const result = parseInput(AwardBountyArgs, { bounty_id: "b-1", submission_id: 0 });
    assert.equal(result.submission_id, 0);
  });

  it("rejects negative submission_id", () => {
    expectInvalidParams(() => parseInput(AwardBountyArgs, { bounty_id: "b-1", submission_id: -1 }), "submission_id");
  });

  it("rejects non-integer submission_id", () => {
    expectInvalidParams(() => parseInput(AwardBountyArgs, { bounty_id: "b-1", submission_id: 1.5 }), "submission_id");
  });
});

// ── PlaceDepositArgs ──────────────────────────────────────────────────────────

describe("PlaceDepositArgs", () => {
  it("accepts valid args", () => {
    const result = parseInput(PlaceDepositArgs, { to: ADDR, amount: 50, expires: 3600 });
    assert.equal(result.expires, 3600);
  });

  it("rejects non-integer expires", () => {
    expectInvalidParams(() => parseInput(PlaceDepositArgs, { to: ADDR, amount: 50, expires: 3600.5 }), "expires");
  });
});

// ── RegisterWebhookArgs ─────────────────────────────────────────────────────

describe("RegisterWebhookArgs", () => {
  it("accepts valid args", () => {
    const result = parseInput(RegisterWebhookArgs, {
      url: "https://example.com/webhook",
      events: ["payment.sent", "escrow.funded"],
    });
    assert.equal(result.url, "https://example.com/webhook");
    assert.deepEqual(result.events, ["payment.sent", "escrow.funded"]);
  });

  it("accepts optional chains", () => {
    const result = parseInput(RegisterWebhookArgs, {
      url: "https://example.com/webhook",
      events: ["payment.sent"],
      chains: ["base"],
    });
    assert.deepEqual(result.chains, ["base"]);
  });

  it("rejects HTTP URL (requires HTTPS)", () => {
    expectInvalidParams(
      () => parseInput(RegisterWebhookArgs, { url: "http://example.com/webhook", events: ["payment.sent"] }),
      "url",
    );
  });

  it("rejects non-URL string", () => {
    expectInvalidParams(
      () => parseInput(RegisterWebhookArgs, { url: "not-a-url", events: ["payment.sent"] }),
      "url",
    );
  });

  it("rejects empty events array", () => {
    expectInvalidParams(
      () => parseInput(RegisterWebhookArgs, { url: "https://example.com/webhook", events: [] }),
      "events",
    );
  });

  it("rejects invalid event type", () => {
    expectInvalidParams(
      () => parseInput(RegisterWebhookArgs, { url: "https://example.com/webhook", events: ["invalid.event"] }),
      "events",
    );
  });

  it("rejects missing url", () => {
    expectInvalidParams(
      () => parseInput(RegisterWebhookArgs, { events: ["payment.sent"] }),
      "url",
    );
  });

  it("rejects missing events", () => {
    expectInvalidParams(
      () => parseInput(RegisterWebhookArgs, { url: "https://example.com/webhook" }),
      "events",
    );
  });
});

// ── DeleteWebhookArgs ───────────────────────────────────────────────────────

describe("DeleteWebhookArgs", () => {
  it("accepts valid id", () => {
    const result = parseInput(DeleteWebhookArgs, { id: "wh-123" });
    assert.equal(result.id, "wh-123");
  });

  it("rejects empty id", () => {
    expectInvalidParams(() => parseInput(DeleteWebhookArgs, { id: "" }), "id");
  });

  it("rejects missing id", () => {
    expectInvalidParams(() => parseInput(DeleteWebhookArgs, {}), "id");
  });
});

// ── X402PayArgs ─────────────────────────────────────────────────────────────

describe("X402PayArgs", () => {
  it("accepts valid HTTPS URL", () => {
    const result = parseInput(X402PayArgs, { url: "https://example.com/resource" });
    assert.equal(result.url, "https://example.com/resource");
  });

  it("accepts optional max_usdc", () => {
    const result = parseInput(X402PayArgs, { url: "https://example.com/resource", max_usdc: 0.5 });
    assert.equal(result.max_usdc, 0.5);
  });

  it("rejects HTTP URL", () => {
    expectInvalidParams(
      () => parseInput(X402PayArgs, { url: "http://example.com/resource" }),
      "url",
    );
  });

  it("rejects non-URL string", () => {
    expectInvalidParams(
      () => parseInput(X402PayArgs, { url: "not-a-url" }),
      "url",
    );
  });
});

// ── X402ConfigArgs ──────────────────────────────────────────────────────────

describe("X402ConfigArgs", () => {
  it("accepts valid args", () => {
    const result = parseInput(X402ConfigArgs, { max_auto_pay_usdc: 0.5, enabled: true });
    assert.equal(result.max_auto_pay_usdc, 0.5);
    assert.equal(result.enabled, true);
  });

  it("accepts empty args (all optional)", () => {
    const result = parseInput(X402ConfigArgs, {});
    assert.equal(result.max_auto_pay_usdc, undefined);
    assert.equal(result.enabled, undefined);
  });

  it("rejects negative max_auto_pay_usdc", () => {
    expectInvalidParams(
      () => parseInput(X402ConfigArgs, { max_auto_pay_usdc: -1 }),
      "max_auto_pay_usdc",
    );
  });
});

