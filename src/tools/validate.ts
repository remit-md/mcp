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

// ── Reusable primitives ────────────────────────────���──────────────────────────

const address = z
  .string()
  .regex(/^0x[0-9a-fA-F]{40}$/, "must be a 0x-prefixed 20-byte address");

const positiveNumber = z.number().positive("must be positive");
const positiveInt = z.number().int("must be an integer").positive("must be positive");
const nonEmptyString = z.string().min(1, "must not be empty");

const hexBytes32 = z
  .string()
  .regex(/^0x[0-9a-fA-F]{64}$/, "must be a 0x-prefixed 32-byte hex string");

const permitSchema = z.object({
  value: positiveInt.describe("Approved amount in USDC base units"),
  deadline: positiveInt.describe("Permit deadline (Unix timestamp)"),
  v: z.number().int().describe("Recovery byte"),
  r: hexBytes32.describe("Signature r component (0x-prefixed 32 bytes)"),
  s: hexBytes32.describe("Signature s component (0x-prefixed 32 bytes)"),
}).describe(
  "Optional EIP-2612 permit signature for gasless USDC approval",
);

// ── Per-tool input schemas ─────────────────────────────────────────────────────

export const PayDirectArgs = z.object({
  to: address.describe("Recipient wallet address (0x...)"),
  amount: positiveNumber.describe("Amount in USD (e.g. 1.50)"),
  memo: z.string().optional().describe("Optional payment memo or note"),
});

export const CreateEscrowArgs = z.object({
  to: address.describe("Recipient wallet address (0x...)"),
  amount: positiveNumber.describe("Total amount in USD to escrow"),
  task: nonEmptyString.describe("Description of the task or service"),
  timeout: positiveInt.describe(
    "Seconds until escrow auto-cancels if unclaimed (e.g. 86400 = 1 day)",
  ),
  milestones: z
    .array(
      z.object({
        amount: positiveNumber,
        description: nonEmptyString,
      }),
    )
    .optional()
    .describe("Optional milestone breakdown. If omitted, full amount is released at once."),
});

export const ReleaseEscrowArgs = z.object({
  invoice_id: nonEmptyString.describe("Invoice ID of the escrow to release"),
});

export const CancelEscrowArgs = z.object({
  invoice_id: nonEmptyString.describe("Invoice ID of the escrow to cancel"),
});

export const ClaimStartArgs = z.object({
  invoice_id: nonEmptyString.describe("Invoice ID of the escrow to claim"),
});

export const OpenTabArgs = z.object({
  to: address.describe("Service provider wallet address (0x...)"),
  limit: positiveNumber.describe("Maximum spend limit in USD"),
  per_unit: positiveNumber.describe("Cost per unit in USD (e.g. 0.003 per API call)"),
  expires: positiveInt.optional().describe(
    "Seconds until tab expires (default: 86400 = 1 day)",
  ),
});

export const CloseTabArgs = z.object({
  tab_id: nonEmptyString.describe("Tab ID to close"),
});

export const OpenStreamArgs = z.object({
  to: address.describe("Recipient wallet address (0x...)"),
  rate: positiveNumber.describe("Payment rate in USD per second (e.g. 0.001)"),
  max_duration: positiveInt.optional().describe(
    "Maximum duration in seconds (default: 3600 = 1 hour)",
  ),
  max_total: positiveNumber.optional().describe("Optional maximum total spend in USD"),
});

export const CloseStreamArgs = z.object({
  stream_id: nonEmptyString.describe("Stream ID to close"),
});

export const PostBountyArgs = z.object({
  amount: positiveNumber.describe("Bounty reward in USD"),
  task: nonEmptyString.describe("Detailed task description"),
  deadline: positiveInt.describe("Unix timestamp deadline for submissions"),
  validation: z.enum(["poster", "oracle", "multisig"]).optional().describe(
    "Who validates completion: poster (default), oracle, or multisig",
  ),
  max_attempts: positiveInt.optional().describe(
    "Maximum submission attempts allowed (default: 10)",
  ),
  permit: permitSchema.optional().describe(
    "Optional EIP-2612 permit signature for gasless USDC approval to the Bounty contract",
  ),
});

export const AwardBountyArgs = z.object({
  bounty_id: nonEmptyString.describe("Bounty ID to award"),
  submission_id: z.number().int("must be an integer").min(0, "must be non-negative").describe(
    "Submission index to award (0-based)",
  ),
});

export const PlaceDepositArgs = z.object({
  to: address.describe("Deposit holder wallet address (0x...)"),
  amount: positiveNumber.describe("Deposit amount in USD"),
  expires: positiveInt.describe(
    "Seconds until deposit auto-expires and is returned to you",
  ),
  permit: permitSchema.optional().describe(
    "Optional EIP-2612 permit signature for gasless USDC approval to the Deposit contract",
  ),
});

export const X402PayArgs = z.object({
  url: z
    .string()
    .url("must be a valid URL")
    .refine((u) => u.startsWith("https://"), "x402 URL must use HTTPS")
    .describe("URL to fetch. If the server returns 402, a payment will be made automatically."),
  max_usdc: positiveNumber.optional().describe(
    "Maximum USDC to auto-pay for this single request (overrides session config). " +
    "Defaults to the session max set by x402_config.",
  ),
});

export const X402ConfigArgs = z.object({
  max_auto_pay_usdc: positiveNumber.optional().describe(
    "Maximum USDC to auto-pay per x402 request (e.g. 0.10). Must be positive.",
  ),
  enabled: z.boolean().optional().describe(
    "Enable or disable x402 auto-pay. Disabled mode blocks all x402_pay calls.",
  ),
});

export const X402PaywallSetupArgs = z.object({
  language: z.enum(["python", "typescript", "go"]).describe(
    "Programming language: python, typescript, or go.",
  ),
  wallet_address: address.describe(
    "Ethereum wallet address that will receive payments.",
  ),
  router_address: address.optional().describe(
    "RemitRouter contract address. The agent signs EIP-3009 to this address; the Router deducts the protocol fee and forwards the net amount. " +
    "Defaults to the current Router from /contracts API.",
  ),
  amount_usdc: positiveNumber.describe(
    "Price per request in USDC (e.g. 0.001 = 0.1 cents).",
  ),
  network: nonEmptyString.describe(
    "CAIP-2 network string. Use eip155:84532 for Base Sepolia (testnet) or eip155:8453 for Base mainnet.",
  ),
  asset: nonEmptyString.optional().describe(
    "USDC contract address on the target network. " +
    "Defaults to the current USDC from /contracts API.",
  ),
  framework: z.enum(["fastapi", "flask", "hono", "express", "net/http"]).optional().describe(
    "Web framework. Python: fastapi (default) or flask. TypeScript: hono (default) or express. " +
    "Go only supports net/http.",
  ),
  resource: z.string().optional().describe(
    "V2 optional: URL path of the resource being gated (e.g. /v1/data).",
  ),
  description: z.string().optional().describe(
    "V2 optional: Human-readable description of what the payment covers.",
  ),
  mime_type: z.string().optional().describe(
    "V2 optional: MIME type of the resource (e.g. application/json).",
  ),
});

// ── Known webhook event types ────���───────────────────────────────────────────

const WEBHOOK_EVENT_TYPES = [
  "payment.sent",
  "payment.received",
  "escrow.funded",
  "escrow.released",
  "escrow.cancelled",
  "escrow.claim_started",
  "tab.opened",
  "tab.charged",
  "tab.closed",
  "stream.opened",
  "stream.withdrawn",
  "stream.closed",
  "bounty.posted",
  "bounty.submitted",
  "bounty.awarded",
  "bounty.reclaimed",
  "bounty.expired",
  "deposit.created",
  "deposit.returned",
  "deposit.forfeited",
  "x402.settled",
  "x402.failed",
  "webhook.test",
] as const;

const webhookEventType = z.enum(WEBHOOK_EVENT_TYPES, {
  errorMap: () => ({
    message: `must be one of: ${WEBHOOK_EVENT_TYPES.join(", ")}`,
  }),
});

export const RegisterWebhookArgs = z.object({
  url: z
    .string()
    .url("must be a valid URL")
    .refine((u) => u.startsWith("https://"), "webhook URL must use HTTPS")
    .describe("HTTPS URL to deliver events to"),
  events: z.array(webhookEventType).min(1, "must specify at least one event type").describe(
    "Event types to subscribe to. Valid values: payment.sent, payment.received, " +
    "escrow.funded, escrow.released, escrow.cancelled, escrow.claim_started, tab.opened, tab.charged, " +
    "tab.closed, stream.opened, stream.withdrawn, stream.closed, bounty.posted, bounty.submitted, " +
    "bounty.awarded, bounty.reclaimed, bounty.expired, deposit.created, deposit.returned, " +
    "deposit.forfeited, x402.settled, x402.failed, webhook.test",
  ),
  chains: z.array(nonEmptyString).optional().describe(
    "Chain filter - omit to receive events from all chains",
  ),
});

export const DeleteWebhookArgs = z.object({
  id: nonEmptyString.describe("Webhook ID to delete"),
});

// ── Charge tab ───────────────────────────────────────────────────────────────

export const ChargeTabArgs = z.object({
  tab_id: nonEmptyString.describe("Tab ID to charge"),
  amount: positiveNumber.describe("Amount to charge in USD for this call"),
  cumulative: positiveNumber.describe("Cumulative amount charged so far (including this charge)"),
  call_count: positiveInt.describe("Total number of calls/charges so far"),
  provider_sig: nonEmptyString.describe("Provider's EIP-712 TabCharge signature (hex string)"),
});

// ── Withdraw stream ──────────────────────────────────────────────────────────

export const WithdrawStreamArgs = z.object({
  stream_id: nonEmptyString.describe("Stream ID to withdraw vested funds from"),
});

// ── Submit bounty ────────────────────────────────────────────────────────────

export const SubmitBountyArgs = z.object({
  bounty_id: nonEmptyString.describe("Bounty ID to submit work for"),
  evidence_hash: hexBytes32.describe("Hash of the evidence/deliverable (0x-prefixed 32 bytes)"),
  evidence_uri: z.string().optional().describe("Optional URI pointing to the evidence"),
});

// ── Reclaim bounty ───────────────────────────────────────────────────────────

export const ReclaimBountyArgs = z.object({
  bounty_id: nonEmptyString.describe("Bounty ID to reclaim (must be expired)"),
});

// ── Return deposit ───────────────────────────────────────────────────────────

export const ReturnDepositArgs = z.object({
  deposit_id: nonEmptyString.describe("Deposit ID to return to the depositor"),
});

// ── Forfeit deposit ──────────────────────────────────────────────────────────

export const ForfeitDepositArgs = z.object({
  deposit_id: nonEmptyString.describe("Deposit ID to forfeit (provider keeps the funds)"),
});

// ── Update webhook ───────────────────────────────────────────────────────────

export const UpdateWebhookArgs = z.object({
  id: nonEmptyString.describe("Webhook ID to update"),
  url: z.string().url("must be a valid URL").optional().describe("New webhook URL"),
  events: z.array(webhookEventType).optional().describe("New list of event types to subscribe to"),
  active: z.boolean().optional().describe("Enable or disable the webhook"),
});

// ── No-arg tool schemas (check_balance, get_status, create_fund_link, etc.) ──

export const EmptyArgs = z.object({});

// check_balance and get_status take no args - no schema needed.
