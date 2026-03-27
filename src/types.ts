/**
 * Type definitions for the MCP server layer.
 * Domain model types are re-exported from @remitmd/sdk for type parity.
 * MCP-specific types (x402, WalletLike, tool infra) are defined here.
 */

// ─── SDK re-exports ─────────────────────────────────────────────────────────

export type {
  Transaction,
  WalletStatus,
  Reputation,
  Webhook,
  LinkResponse,
  ContractAddresses,
} from "@remitmd/sdk";
export type { Invoice } from "@remitmd/sdk";
export type { Escrow } from "@remitmd/sdk";
export type { Tab } from "@remitmd/sdk";
export type { Stream } from "@remitmd/sdk";
export type { Bounty } from "@remitmd/sdk";
export type { Deposit } from "@remitmd/sdk";

// Import SDK types we need for WalletLike signatures
import type {
  Transaction,
  WalletStatus,
  Webhook,
  LinkResponse,
  ContractAddresses,
} from "@remitmd/sdk";
import type { Invoice } from "@remitmd/sdk";
import type { Escrow } from "@remitmd/sdk";
import type { Tab } from "@remitmd/sdk";
import type { Stream } from "@remitmd/sdk";
import type { Bounty } from "@remitmd/sdk";
import type { Deposit } from "@remitmd/sdk";
import type { Reputation } from "@remitmd/sdk";
import type { CloseTabOptions } from "@remitmd/sdk";

/** Subset of Invoice fields needed by WalletLike.pay(). */
export interface PayInvoiceInput {
  to: string;
  amount: number;
  paymentType?: Invoice["paymentType"];
  memo?: string;
  timeout?: number;
  milestones?: Array<{ amount: number; description: string }>;
}

// ─── x402 Types ──────────────────────────────────────────────────────────────

/** Decoded PAYMENT-REQUIRED header (V2). Optional fields available when server sends them. */
export interface X402PaymentRequired {
  scheme: string;
  network: string;
  amount: string;
  asset: string;
  payTo: string;
  maxTimeoutSeconds?: number;
  resource?: string;
  description?: string;
  mimeType?: string;
}

/** Return type of x402Fetch - response plus V2 metadata from the PAYMENT-REQUIRED header. */
export interface X402FetchResult {
  response: Response;
  lastPayment: X402PaymentRequired | null;
}

// ─── Options ─────────────────────────────────────────────────────────────────

export interface OpenTabOptions {
  to: string;
  limit: number;
  perUnit: number;
  expires?: number;
}

export interface OpenStreamOptions {
  to: string;
  rate: number;
  maxDuration?: number;
  maxTotal?: number;
}

/** EIP-2612 permit signature for gasless USDC approval. */
export interface PermitSignature {
  value: number;
  deadline: number;
  v: number;
  r: string;
  s: string;
}

export interface PostBountyOptions {
  amount: number;
  task: string;
  deadline: number;
  validation?: "poster" | "oracle" | "multisig";
  maxAttempts?: number;
  permit?: PermitSignature;
}

export interface PlaceDepositOptions {
  to: string;
  amount: number;
  expires: number;
  permit?: PermitSignature;
}

// ─── WalletLike ───────────────────────────────────────────────────────────────

/** Minimal interface needed by tool and resource handlers. Structurally compatible with @remitmd/sdk Wallet. */
export interface WalletLike {
  readonly address: string;

  // Write operations
  payDirect(to: string, amount: number, memo?: string, options?: { permit?: PermitSignature }): Promise<Transaction>;
  pay(invoice: PayInvoiceInput, options?: { permit?: PermitSignature }): Promise<Escrow>;
  claimStart(invoiceId: string): Promise<Transaction>;
  releaseEscrow(invoiceId: string): Promise<Transaction>;
  cancelEscrow(invoiceId: string): Promise<Transaction>;
  openTab(options: OpenTabOptions & { permit?: PermitSignature }): Promise<Tab>;
  closeTab(tabId: string, options?: CloseTabOptions): Promise<Transaction>;
  openStream(options: OpenStreamOptions & { permit?: PermitSignature }): Promise<Stream>;
  closeStream(streamId: string): Promise<Transaction>;
  postBounty(options: PostBountyOptions): Promise<Bounty>;
  awardBounty(bountyId: string, submissionId: number): Promise<Transaction>;
  placeDeposit(options: PlaceDepositOptions): Promise<Deposit>;
  balance(): Promise<number>;
  status(): Promise<WalletStatus>;
  createFundLink(): Promise<LinkResponse>;
  createWithdrawLink(): Promise<LinkResponse>;

  // Permit signing (optional - present on real SDK Wallet, absent on mocks)
  signPermit?(spender: string, amount: number): Promise<PermitSignature>;
  getContracts?(): Promise<ContractAddresses>;

  // x402 micropayment fetch
  x402Fetch(url: string, maxAutoPayUsdc?: number, init?: RequestInit): Promise<X402FetchResult>;

  // Read operations (needed for resources + status tools)
  getStatus(wallet: string): Promise<WalletStatus>;
  getInvoice(invoiceId: string): Promise<Invoice>;
  getEscrow(invoiceId: string): Promise<Escrow>;
  getTab(tabId: string): Promise<Tab>;
  getBounty(bountyId: string): Promise<Bounty>;
  getReputation(wallet: string): Promise<Reputation>;
  registerWebhook(url: string, events: string[], chains?: string[]): Promise<Webhook>;
  listWebhooks(): Promise<Webhook[]>;
  deleteWebhook(id: string): Promise<void>;
}

// ─── WalletLike runtime type guard ───────────────────────────────────────────

const WALLET_LIKE_METHODS: ReadonlyArray<keyof WalletLike> = [
  "payDirect",
  "pay",
  "claimStart",
  "releaseEscrow",
  "cancelEscrow",
  "openTab",
  "closeTab",
  "openStream",
  "closeStream",
  "postBounty",
  "awardBounty",
  "placeDeposit",
  "balance",
  "status",
  "createFundLink",
  "createWithdrawLink",
  "x402Fetch",
  "getStatus",
  "getInvoice",
  "getEscrow",
  "getTab",
  "getBounty",
  "getReputation",
  "registerWebhook",
  "listWebhooks",
  "deleteWebhook",
];

/**
 * Runtime type guard: checks that the object structurally satisfies WalletLike.
 * Use instead of `as unknown as WalletLike` when wrapping SDK wallet objects.
 */
export function isWalletLike(value: unknown): value is WalletLike {
  if (typeof value !== "object" || value === null) return false;
  const obj = value as Record<string, unknown>;
  if (typeof obj["address"] !== "string") return false;
  return WALLET_LIKE_METHODS.every((m) => typeof obj[m] === "function");
}

// ─── Tool Infrastructure ──────────────────────────────────────────────────────

export interface JsonSchemaProperty {
  type: string;
  description?: string;
  enum?: string[];
  properties?: Record<string, JsonSchemaProperty>;
  required?: string[];
  items?: {
    type: string;
    properties?: Record<string, JsonSchemaProperty>;
    required?: string[];
  };
}

export interface ToolInputSchema {
  type: "object";
  properties: Record<string, JsonSchemaProperty>;
  required?: string[];
}

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: ToolInputSchema;
}

export type ToolHandler = (
  args: Record<string, unknown>,
  wallet: WalletLike,
) => Promise<unknown>;

export interface Tool {
  definition: ToolDefinition;
  handler: ToolHandler;
}
