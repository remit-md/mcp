/**
 * Shared test fixtures for MCP server tests.
 *
 * Consolidates the 3 duplicate mock wallet factories into one.
 */

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
  Invoice,
  Webhook,
} from "../src/types.js";

export const ADDR = "0xaaaa000000000000000000000000000000000001";
export const OTHER = "0xbbbb000000000000000000000000000000000002";

export const TX: Transaction = {
  txHash: "0x1234",
  chain: "base",
  status: "confirmed",
  createdAt: 1_000_000,
};

export function createMockWallet(overrides?: Partial<WalletLike>): WalletLike {
  const base: WalletLike = {
    address: ADDR,
    payDirect: async () => TX,
    pay: async () =>
      ({
        invoiceId: "inv-1",
        txHash: "0x1234",
        payer: ADDR,
        payee: OTHER,
        amount: 100,
        chain: "base",
        status: "funded",
        createdAt: 1_000_000,
      }) as Escrow,
    claimStart: async () => TX,
    releaseEscrow: async () => TX,
    cancelEscrow: async () => TX,
    openTab: async () =>
      ({
        id: "tab-1",
        payer: ADDR,
        payee: OTHER,
        limit: 100,
        perUnit: 1,
        spent: 0,
        chain: "base",
        status: "open",
        createdAt: 1_000_000,
        expiresAt: 9_999_999,
      }) as Tab,
    closeTab: async () => TX,
    openStream: async () =>
      ({
        id: "stream-1",
        payer: ADDR,
        payee: OTHER,
        ratePerSecond: 0.001,
        maxDuration: 3600,
        totalStreamed: 0,
        chain: "base",
        status: "active",
        startedAt: 1_000_000,
      }) as Stream,
    closeStream: async () => TX,
    postBounty: async () =>
      ({
        id: "bounty-1",
        poster: ADDR,
        task: "test",
        amount: 50,
        chain: "base",
        status: "open",
        validation: "poster",
        maxAttempts: 10,
        submissions: [],
        deadline: 9_999_999,
        createdAt: 1_000_000,
      }) as Bounty,
    awardBounty: async () => TX,
    placeDeposit: async () =>
      ({
        id: "dep-1",
        payer: ADDR,
        payee: OTHER,
        amount: 25,
        chain: "base",
        status: "locked",
        createdAt: 1_000_000,
        expiresAt: 9_999_999,
      }) as Deposit,
    balance: async () => 500.0,
    status: async () =>
      ({
        wallet: ADDR,
        balance: "500.00",
        tier: "standard",
        monthlyVolume: "1000.00",
        feeRateBps: 100,
        activeEscrows: 1,
        activeTabs: 2,
        activeStreams: 1,
        permitNonce: null,
      }) as WalletStatus,
    getStatus: async (addr) =>
      ({
        wallet: addr,
        balance: "100.00",
        tier: "standard",
        monthlyVolume: "500.00",
        feeRateBps: 100,
        activeEscrows: 0,
        activeTabs: 0,
        activeStreams: 0,
        permitNonce: null,
      }) as WalletStatus,
    getInvoice: async (id) =>
      ({
        id,
        from: ADDR,
        to: OTHER,
        amount: 75,
        chain: "base",
        status: "pending",
        paymentType: "escrow",
        memo: `task-${id}`,
        createdAt: 1_000_000,
      }) as Invoice,
    getEscrow: async (id) =>
      ({
        invoiceId: id,
        payer: ADDR,
        payee: OTHER,
        amount: 75,
        chain: "base",
        status: "funded",
        createdAt: 1_000_000,
      }) as Escrow,
    getTab: async (id) =>
      ({
        id,
        payer: ADDR,
        payee: OTHER,
        limit: 50,
        perUnit: 0.5,
        spent: 10,
        chain: "base",
        status: "open",
        createdAt: 1_000_000,
        expiresAt: 9_999_999,
      }) as Tab,
    getStream: async (id) =>
      ({
        id,
        payer: ADDR,
        payee: OTHER,
        ratePerSecond: 0.001,
        maxDuration: 3600,
        totalStreamed: 1.5,
        chain: "base",
        status: "active",
        startedAt: 1_000_000,
      }) as Stream,
    getBounty: async (id) =>
      ({
        id,
        poster: ADDR,
        task: "find the bug",
        amount: 20,
        chain: "base",
        status: "open",
        validation: "poster",
        maxAttempts: 10,
        submissions: [],
        deadline: 9_999_999,
        createdAt: 1_000_000,
      }) as Bounty,
    getDeposit: async (id) =>
      ({
        id,
        payer: ADDR,
        payee: OTHER,
        amount: 25,
        chain: "base",
        status: "locked",
        createdAt: 1_000_000,
        expiresAt: 9_999_999,
      }) as Deposit,
    getReputation: async (addr) =>
      ({
        address: addr,
        score: 95,
        totalPaid: 10000,
        totalReceived: 8000,
        escrowsCompleted: 300,
        memberSince: 1_000_000,
      }) as Reputation,
    x402Fetch: async () => ({
      response: new Response('{"data":"paid"}', { status: 200 }),
      lastPayment: null,
    }),
    createFundLink: async () => ({
      url: "https://remit.md/fund/abc",
      token: "abc",
      expiresAt: "2099-01-01T00:00:00Z",
      walletAddress: ADDR,
    }),
    createWithdrawLink: async () => ({
      url: "https://remit.md/withdraw/xyz",
      token: "xyz",
      expiresAt: "2099-01-01T00:00:00Z",
      walletAddress: ADDR,
    }),
    registerWebhook: async (url, events, chains) =>
      ({
        id: "wh-1",
        wallet: ADDR,
        url,
        events,
        chains: chains ?? [],
        active: true,
        createdAt: 1_000_000,
      }) as Webhook,
    listWebhooks: async () => [] as Webhook[],
    deleteWebhook: async () => {},
    getContracts: async () => ({
      chainId: 84532,
      usdc: "0x2d846325766921935f37d5b4478196d3ef93707c",
      router: "0x3120f396ff6a9afc5a9d92e28796082f1429e024",
      escrow: "0x47de7cdd757e3765d36c083dab59b2c5a9d249f2",
      tab: "0x9415f510d8c6199e0f66bde927d7d88de391f5e8",
      stream: "0x20d413e0eac0f5da3c8630667fd16a94fcd7231a",
      bounty: "0xb3868471c3034280cce3a56dd37c6154c3bb0b32",
      deposit: "0x7e0ae37df62e93c1c16a5661a7998bd174331554",
      feeCalculator: "0xcce1b8cee59f860578bed3c05fe2a80eea04aafb",
      keyRegistry: "0xf5ba0baa124885eb88ad225e81a60864d5e43074",
    }),
  };

  if (overrides) {
    return { ...base, ...overrides };
  }
  return base;
}
