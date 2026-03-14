import { z } from "zod";
import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";

/**
 * Parse and validate tool args against a Zod schema.
 * Throws McpError(InvalidParams) with a human-readable message on failure.
 */
export function parseInput<T>(schema: z.ZodType<T>, args: Record<string, unknown>): T {
  const result = schema.safeParse(args);
  if (!result.success) {
    const msg = result.error.errors
      .map((e) => `${e.path.join(".") || "(root)"}: ${e.message}`)
      .join("; ");
    throw new McpError(ErrorCode.InvalidParams, msg);
  }
  return result.data;
}

// ── Reusable primitives ───────────────────────────────────────────────────────

const address = z
  .string()
  .regex(/^0x[0-9a-fA-F]{40}$/, "must be a 0x-prefixed 20-byte address");

const positiveNumber = z.number().positive("must be positive");
const positiveInt = z.number().int("must be an integer").positive("must be positive");
const nonEmptyString = z.string().min(1, "must not be empty");

// ── Per-tool input schemas ─────────────────────────────────────────────────────

export const PayDirectArgs = z.object({
  to: address,
  amount: positiveNumber,
  memo: z.string().optional(),
});

export const CreateEscrowArgs = z.object({
  to: address,
  amount: positiveNumber,
  task: nonEmptyString,
  timeout: positiveInt,
  milestones: z
    .array(
      z.object({
        amount: positiveNumber,
        description: nonEmptyString,
      }),
    )
    .optional(),
});

export const ReleaseEscrowArgs = z.object({
  invoice_id: nonEmptyString,
});

export const OpenTabArgs = z.object({
  to: address,
  limit: positiveNumber,
  per_unit: positiveNumber,
  expires: positiveInt.optional(),
});

export const CloseTabArgs = z.object({
  tab_id: nonEmptyString,
});

export const OpenStreamArgs = z.object({
  to: address,
  rate: positiveNumber,
  max_duration: positiveInt.optional(),
  max_total: positiveNumber.optional(),
});

export const CloseStreamArgs = z.object({
  stream_id: nonEmptyString,
});

export const PostBountyArgs = z.object({
  amount: positiveNumber,
  task: nonEmptyString,
  deadline: positiveInt,
  validation: z.enum(["poster", "oracle", "multisig"]).optional(),
  max_attempts: positiveInt.optional(),
});

export const AwardBountyArgs = z.object({
  bounty_id: nonEmptyString,
  winner: address,
});

export const PlaceDepositArgs = z.object({
  to: address,
  amount: positiveNumber,
  expires: positiveInt,
});

export const X402PayArgs = z.object({
  url: z.string().url("must be a valid URL"),
  max_usdc: positiveNumber.optional(),
});

export const X402ConfigArgs = z.object({
  max_auto_pay_usdc: positiveNumber.optional(),
  enabled: z.boolean().optional(),
});

export const X402PaywallSetupArgs = z.object({
  language: z.enum(["python", "typescript", "go"]),
  wallet_address: address,
  amount_usdc: positiveNumber,
  network: nonEmptyString,
  asset: nonEmptyString.optional(),
  framework: z.enum(["fastapi", "flask", "hono", "express", "net/http"]).optional(),
  resource: z.string().optional(),
  description: z.string().optional(),
  mime_type: z.string().optional(),
});

// check_balance and get_status take no args — no schema needed.
