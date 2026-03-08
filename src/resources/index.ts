import type { WalletLike } from "../types.js";

export interface ResourceDefinition {
  uri: string;
  name: string;
  description: string;
  mimeType: string;
}

const RESOURCE_DEFINITIONS: ResourceDefinition[] = [
  {
    uri: "remit://wallet/{address}/balance",
    name: "Wallet Balance",
    description: "Current USDC balance for any wallet address",
    mimeType: "application/json",
  },
  {
    uri: "remit://wallet/{address}/reputation",
    name: "Wallet Reputation",
    description: "Reputation score and payment history for a wallet",
    mimeType: "application/json",
  },
  {
    uri: "remit://wallet/{address}/transactions",
    name: "Transaction History",
    description: "Recent payment events for a wallet",
    mimeType: "application/json",
  },
  {
    uri: "remit://invoice/{id}",
    name: "Invoice",
    description: "Invoice details including type, amount, and status",
    mimeType: "application/json",
  },
  {
    uri: "remit://escrow/{id}/status",
    name: "Escrow Status",
    description: "Current state of an escrow payment",
    mimeType: "application/json",
  },
  {
    uri: "remit://tab/{id}/usage",
    name: "Tab Usage",
    description: "Current usage and remaining allowance for a payment tab",
    mimeType: "application/json",
  },
  {
    uri: "remit://bounty/{id}/submissions",
    name: "Bounty Submissions",
    description: "Bounty details, status, and submission information",
    mimeType: "application/json",
  },
];

export function listResources(): ResourceDefinition[] {
  return RESOURCE_DEFINITIONS;
}

type ParsedUri =
  | { type: "balance"; address: string }
  | { type: "reputation"; address: string }
  | { type: "transactions"; address: string }
  | { type: "invoice"; id: string }
  | { type: "escrow_status"; id: string }
  | { type: "tab_usage"; id: string }
  | { type: "bounty_submissions"; id: string };

function parseUri(uri: string): ParsedUri | null {
  const walletMatch = /^remit:\/\/wallet\/([^/]+)\/(balance|reputation|transactions)$/.exec(uri);
  if (walletMatch) {
    const subtype = walletMatch[2] as "balance" | "reputation" | "transactions";
    return { type: subtype, address: walletMatch[1] as string };
  }

  const invoiceMatch = /^remit:\/\/invoice\/([^/]+)$/.exec(uri);
  if (invoiceMatch) return { type: "invoice", id: invoiceMatch[1] as string };

  const escrowMatch = /^remit:\/\/escrow\/([^/]+)\/status$/.exec(uri);
  if (escrowMatch) return { type: "escrow_status", id: escrowMatch[1] as string };

  const tabMatch = /^remit:\/\/tab\/([^/]+)\/usage$/.exec(uri);
  if (tabMatch) return { type: "tab_usage", id: tabMatch[1] as string };

  const bountyMatch = /^remit:\/\/bounty\/([^/]+)\/submissions$/.exec(uri);
  if (bountyMatch) return { type: "bounty_submissions", id: bountyMatch[1] as string };

  return null;
}

export async function readResource(
  uri: string,
  wallet: WalletLike,
): Promise<{ mimeType: string; text: string }> {
  const parsed = parseUri(uri);
  if (!parsed) throw new Error(`Unknown resource URI: ${uri}`);

  let data: unknown;

  switch (parsed.type) {
    case "balance": {
      const s = await wallet.getStatus(parsed.address);
      data = { address: parsed.address, balance: s.usdcBalance, currency: "USDC" };
      break;
    }
    case "reputation": {
      data = await wallet.getReputation(parsed.address);
      break;
    }
    case "transactions": {
      data = await wallet.getEvents(parsed.address);
      break;
    }
    case "invoice": {
      data = await wallet.getInvoice(parsed.id);
      break;
    }
    case "escrow_status": {
      data = await wallet.getEscrow(parsed.id);
      break;
    }
    case "tab_usage": {
      data = await wallet.getTab(parsed.id);
      break;
    }
    case "bounty_submissions": {
      data = await wallet.getBounty(parsed.id);
      break;
    }
  }

  return { mimeType: "application/json", text: JSON.stringify(data) };
}
