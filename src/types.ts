/**
 * Inline type definitions for the MCP server layer.
 * These mirror the @remitmd/sdk types structurally so the server
 * can be tested without importing the SDK package.
 */

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

/** Return type of x402Fetch — response plus V2 metadata from the PAYMENT-REQUIRED header. */
export interface X402FetchResult {
  response: Response;
  lastPayment: X402PaymentRequired | null;
}

// ─── Domain Types ────────────────────────────────────────────────────────────

export interface Transaction {
  invoiceId?: string;
  txHash: string;
  chain: string;
  status: string;
  createdAt: number;
}

export interface WalletStatus {
  address: string;
  usdcBalance: number;
  tier: string;
  totalVolume: number;
  escrowsActive: number;
  openTabs: number;
  activeStreams: number;
}

export interface Reputation {
  address: string;
  score: number;
  completedPayments: number;
  tier: string;
}

export interface Invoice {
  to: string;
  amount: number;
  type: string;
  memo?: string;
  timeout?: number;
  milestones?: Array<{ amount: number; description: string }>;
}

export interface Escrow {
  invoiceId: string;
  from: string;
  to: string;
  amount: number;
  status: string;
  timeout: number;
}

export interface Tab {
  tabId: string;
  to: string;
  limit: number;
  perUnit: number;
  used: number;
  status: string;
  expiresAt: number;
}

export interface Stream {
  streamId: string;
  to: string;
  rate: number;
  maxDuration: number;
  totalStreamed: number;
  status: string;
  startedAt: number;
}

export interface Bounty {
  bountyId: string;
  task: string;
  amount: number;
  status: string;
  deadline: number;
  winner?: string;
}

export interface Deposit {
  depositId: string;
  to: string;
  amount: number;
  status: string;
  expiresAt: number;
}

export interface RemitEvent {
  type: string;
  timestamp: number;
  payload: unknown;
}

export interface LinkResponse {
  url: string;
  token: string;
  expiresAt: string;
  walletAddress: string;
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

export interface PostBountyOptions {
  amount: number;
  task: string;
  deadline: number;
  validation?: "poster" | "oracle" | "multisig";
  maxAttempts?: number;
}

export interface PlaceDepositOptions {
  to: string;
  amount: number;
  expires: number;
}

// ─── WalletLike ───────────────────────────────────────────────────────────────

/** Minimal interface needed by tool and resource handlers. Structurally compatible with @remitmd/sdk Wallet. */
export interface WalletLike {
  readonly address: string;

  // Write operations
  payDirect(to: string, amount: number, memo?: string): Promise<Transaction>;
  pay(invoice: Invoice): Promise<Transaction>;
  claimStart(invoiceId: string): Promise<Transaction>;
  releaseEscrow(invoiceId: string): Promise<Transaction>;
  cancelEscrow(invoiceId: string): Promise<Transaction>;
  openTab(options: OpenTabOptions): Promise<Tab>;
  closeTab(tabId: string): Promise<Transaction>;
  openStream(options: OpenStreamOptions): Promise<Stream>;
  closeStream(streamId: string): Promise<Transaction>;
  postBounty(options: PostBountyOptions): Promise<Bounty>;
  awardBounty(bountyId: string, winner: string): Promise<Transaction>;
  placeDeposit(options: PlaceDepositOptions): Promise<Deposit>;
  balance(): Promise<number>;
  status(): Promise<WalletStatus>;
  createFundLink(): Promise<LinkResponse>;
  createWithdrawLink(): Promise<LinkResponse>;

  // x402 micropayment fetch
  x402Fetch(url: string, maxAutoPayUsdc?: number, init?: RequestInit): Promise<X402FetchResult>;

  // Read operations (needed for resources + status tools)
  getStatus(wallet: string): Promise<WalletStatus>;
  getInvoice(invoiceId: string): Promise<Invoice>;
  getEscrow(invoiceId: string): Promise<Escrow>;
  getTab(tabId: string): Promise<Tab>;
  getBounty(bountyId: string): Promise<Bounty>;
  getReputation(wallet: string): Promise<Reputation>;
  getEvents(wallet: string, since?: number): Promise<RemitEvent[]>;
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
  "getEvents",
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
