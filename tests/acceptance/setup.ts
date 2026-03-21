/**
 * MCP acceptance test harness.
 *
 * Uses real SDK Wallet against live Base Sepolia API.
 * Tests call tool handlers directly (callTool) with real wallets.
 */

import { generatePrivateKey } from "viem/accounts";

const API_URL = process.env["ACCEPTANCE_API_URL"] ?? "https://remit.md/api/v1";
const RPC_URL = process.env["ACCEPTANCE_RPC_URL"] ?? "https://sepolia.base.org";
const USDC_ADDRESS = "0x142aD61B8d2edD6b3807D9266866D97C35Ee0317";

// ─── Dynamic SDK import ─────────────────────────────────────────────────────

let _Wallet: typeof import("@remitmd/sdk").Wallet | null = null;

async function getWalletClass() {
  if (_Wallet) return _Wallet;
  const sdk = await import("@remitmd/sdk");
  _Wallet = sdk.Wallet;
  return _Wallet;
}

let _routerAddress: string | null = null;

async function getRouterAddress(): Promise<string> {
  if (_routerAddress) return _routerAddress;
  const res = await fetch(`${API_URL}/contracts`);
  if (!res.ok) throw new Error(`GET /contracts failed: ${res.status}`);
  const data = (await res.json()) as { router: string };
  _routerAddress = data.router;
  return _routerAddress;
}

// ─── Wallet creation ────────────────────────────────────────────────────────

export interface TestContext {
  wallet: import("../src/types.js").WalletLike;
  address: string;
}

export async function createTestWallet(): Promise<TestContext> {
  const Wallet = await getWalletClass();
  const key = generatePrivateKey();
  const routerAddress = await getRouterAddress();
  const wallet = new Wallet({
    privateKey: key,
    chain: "base-sepolia",
    apiUrl: API_URL,
    rpcUrl: RPC_URL,
    routerAddress,
  });
  return {
    wallet: wallet as unknown as import("../src/types.js").WalletLike,
    address: wallet.address,
  };
}

// ─── Funding ────────────────────────────────────────────────────────────────

export async function mintUsdc(address: string, amount = 100): Promise<void> {
  const res = await fetch(`${API_URL}/mint`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ wallet: address, amount }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`POST /mint failed (${res.status}): ${text}`);
  }
}

// ─── On-chain balance via RPC ───────────────────────────────────────────────

export async function getUsdcBalance(address: string): Promise<number> {
  const padded = address.toLowerCase().replace("0x", "").padStart(64, "0");
  const data = `0x70a08231${padded}`;

  const res = await fetch(RPC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "eth_call",
      params: [{ to: USDC_ADDRESS, data }, "latest"],
    }),
  });
  const json = (await res.json()) as { result?: string; error?: { message: string } };
  if (json.error) throw new Error(`RPC balanceOf error: ${json.error.message}`);
  return Number(BigInt(json.result ?? "0x0")) / 1e6;
}

export async function waitForBalance(address: string, minBalance: number, maxWaitMs = 60000): Promise<number> {
  const start = Date.now();
  let delay = 2000;
  while (Date.now() - start < maxWaitMs) {
    const current = await getUsdcBalance(address);
    if (current >= minBalance - 0.01) return current;
    await new Promise((r) => setTimeout(r, delay));
    delay = Math.min(delay * 1.5, 10000); // backoff up to 10s
  }
  return getUsdcBalance(address);
}

/** Retry an async function with exponential backoff. */
export async function retry<T>(
  fn: () => Promise<T>,
  { attempts = 3, baseDelayMs = 2000, label = "operation" } = {},
): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (i < attempts - 1) {
        const delay = baseDelayMs * Math.pow(2, i);
        console.log(`[retry] ${label} attempt ${i + 1}/${attempts} failed, retrying in ${delay}ms...`);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }
  throw lastErr;
}
