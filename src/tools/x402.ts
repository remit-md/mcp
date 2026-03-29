import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import type { Tool, WalletLike } from "../types.js";
import { parseInput, X402PayArgs, X402ConfigArgs, X402PaywallSetupArgs } from "./validate.js";
import { zodToMcpSchema } from "./schema.js";

/** Session-level x402 auto-pay configuration (persists for MCP server lifetime). */
export interface X402Config {
  maxAutoPayUsdc: number;
  enabled: boolean;
}

/** Create x402 tools with config captured in closure (no module-level singleton). */
export function createX402Tools(x402Config: X402Config): Tool[] {

const x402PayTool: Tool = {
  definition: {
    name: "x402_pay",
    description:
      "Make an HTTP request to a URL, automatically paying any x402 Payment Required (402) response. " +
      "Use when an API charges micropayments per request. Returns the response status and body.",
    inputSchema: zodToMcpSchema(X402PayArgs),
  },
  handler: async (args, wallet) => {
    if (!x402Config.enabled) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        "x402 auto-pay is disabled. Call x402_config with enabled=true to re-enable.",
      );
    }
    const { url, max_usdc } = parseInput(X402PayArgs, args);
    const limit = max_usdc ?? x402Config.maxAutoPayUsdc;
    const { response, lastPayment } = await wallet.x402Fetch(url, limit);
    const body = await response.text();
    const result: Record<string, unknown> = { status: response.status, ok: response.ok, body };
    if (lastPayment !== null) {
      const payment: Record<string, unknown> = {
        amount: lastPayment.amount,
        network: lastPayment.network,
      };
      if (lastPayment.resource !== undefined) payment["resource"] = lastPayment.resource;
      if (lastPayment.description !== undefined) payment["description"] = lastPayment.description;
      if (lastPayment.mimeType !== undefined) payment["mimeType"] = lastPayment.mimeType;
      result["payment"] = payment;
    }
    return result;
  },
};

const x402ConfigTool: Tool = {
  definition: {
    name: "x402_config",
    description:
      "Configure x402 auto-pay settings for this session. " +
      "Set the maximum USDC amount to auto-pay per request, or enable/disable auto-pay entirely. " +
      "Settings persist for the duration of the MCP session.",
    inputSchema: zodToMcpSchema(X402ConfigArgs),
  },
  handler: async (args, _wallet) => {
    const { max_auto_pay_usdc, enabled } = parseInput(X402ConfigArgs, args);
    if (max_auto_pay_usdc !== undefined) {
      x402Config.maxAutoPayUsdc = max_auto_pay_usdc;
    }
    if (enabled !== undefined) {
      x402Config.enabled = enabled;
    }
    return { success: true, config: { maxAutoPayUsdc: x402Config.maxAutoPayUsdc, enabled: x402Config.enabled } };
  },
};

// ─── Contract address resolution ────────────────────────────────────────────

/** Fetch USDC and router addresses from the wallet's getContracts() API. */
async function fetchContractDefaults(wallet: WalletLike): Promise<{ usdc: string; router: string }> {
  if (!wallet.getContracts) {
    throw new McpError(
      ErrorCode.InvalidRequest,
      "Wallet does not support getContracts(). Provide explicit asset and router_address.",
    );
  }
  const contracts = await wallet.getContracts();
  if (!contracts.usdc || !contracts.router) {
    throw new McpError(
      ErrorCode.InternalError,
      "Server returned incomplete contract addresses (missing usdc or router).",
    );
  }
  return { usdc: contracts.usdc, router: contracts.router };
}

// ─── Per-language string escaping (prevents code injection in generated snippets) ─

/** Escape a string for Python string literals (matches repr() for simple strings). */
function escapePy(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n").replace(/\r/g, "\\r");
}

/** Escape a string for TypeScript/JavaScript string literals (JSON.stringify without outer quotes). */
function escapeTs(s: string): string {
  return JSON.stringify(s).slice(1, -1);
}

/** Escape a string for Go string literals (double-quoted). */
function escapeGo(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n").replace(/\r/g, "\\r");
}

// ─── Code-generation helpers ──────────────────────────────────────────────────

function pyV2Lines(resource?: string, description?: string, mimeType?: string): string {
  const lines: string[] = [];
  if (resource) lines.push(`    resource="${escapePy(resource)}",`);
  if (description) lines.push(`    description="${escapePy(description)}",`);
  if (mimeType) lines.push(`    mime_type="${escapePy(mimeType)}",`);
  return lines.length ? "\n" + lines.join("\n") : "";
}

function tsV2Lines(resource?: string, description?: string, mimeType?: string): string {
  const lines: string[] = [];
  if (resource) lines.push(`  resource: "${escapeTs(resource)}",`);
  if (description) lines.push(`  description: "${escapeTs(description)}",`);
  if (mimeType) lines.push(`  mimeType: "${escapeTs(mimeType)}",`);
  return lines.length ? "\n" + lines.join("\n") : "";
}

function goV2Lines(resource?: string, description?: string, mimeType?: string): string {
  const lines: string[] = [];
  if (resource) lines.push(`        Resource: "${escapeGo(resource)}",`);
  if (description) lines.push(`        Description: "${escapeGo(description)}",`);
  if (mimeType) lines.push(`        MimeType: "${escapeGo(mimeType)}",`);
  return lines.length ? "\n" + lines.join("\n") : "";
}

function buildPythonSnippet(
  walletAddress: string, routerAddress: string, amountUsdc: number, network: string, asset: string,
  framework: string, v2: string,
): { install: string; code: string } {
  if (framework === "flask") {
    return {
      install: "pip install remitmd flask",
      code: `from remitmd.provider import X402Paywall
from flask import Flask, jsonify

paywall = X402Paywall(
    wallet_address="${walletAddress}",
    router_address="${routerAddress}",
    amount_usdc=${amountUsdc},
    network="${network}",
    asset="${asset}",
    facilitator_url="https://remit.md",${v2}
)

app = Flask(__name__)

@app.route("/your-endpoint")
@paywall.flask_route()
def your_endpoint():
    return jsonify({"data": "..."})`,
    };
  }
  // default: fastapi
  return {
    install: "pip install remitmd fastapi uvicorn",
    code: `from remitmd.provider import X402Paywall
from fastapi import FastAPI, Depends

paywall = X402Paywall(
    wallet_address="${walletAddress}",
    router_address="${routerAddress}",
    amount_usdc=${amountUsdc},
    network="${network}",
    asset="${asset}",
    facilitator_url="https://remit.md",${v2}
)

app = FastAPI()

@app.get("/your-endpoint")
async def your_endpoint(payment=Depends(paywall.fastapi_dependency)):
    return {"data": "..."}`,
  };
}

function buildTsSnippet(
  walletAddress: string, routerAddress: string, amountUsdc: number, network: string, asset: string,
  framework: string, v2: string,
): { install: string; code: string } {
  if (framework === "express") {
    return {
      install: "npm install @remitmd/sdk express",
      code: `import { X402Paywall } from "@remitmd/sdk";
import express from "express";

const paywall = new X402Paywall({
  walletAddress: "${walletAddress}",
  routerAddress: "${routerAddress}",
  amountUsdc: ${amountUsdc},
  network: "${network}",
  asset: "${asset}",
  facilitatorUrl: "https://remit.md",${v2}
});

const app = express();

app.get("/your-endpoint", async (req, res) => {
  const { isValid, invalidReason } = await paywall.check(
    (req.headers["payment-signature"] as string) ?? null,
  );
  if (!isValid) {
    res.set("PAYMENT-REQUIRED", paywall.paymentRequiredHeader());
    res.status(402).json({ error: "Payment required", invalidReason });
    return;
  }
  res.json({ data: "..." });
});`,
    };
  }
  // default: hono
  return {
    install: "npm install @remitmd/sdk hono",
    code: `import { X402Paywall } from "@remitmd/sdk";
import { Hono } from "hono";

const paywall = new X402Paywall({
  walletAddress: "${walletAddress}",
  routerAddress: "${routerAddress}",
  amountUsdc: ${amountUsdc},
  network: "${network}",
  asset: "${asset}",
  facilitatorUrl: "https://remit.md",${v2}
});

const app = new Hono();
app.use("/your-endpoint", paywall.honoMiddleware());
app.get("/your-endpoint", (c) => c.json({ data: "..." }));`,
  };
}

function buildGoSnippet(
  walletAddress: string, routerAddress: string, amountUsdc: number, network: string, asset: string,
  v2: string,
): { install: string; code: string } {
  return {
    install: "go get github.com/remit-md/sdk-go",
    code: `package main

import (
\t"net/http"
\tremitmd "github.com/remit-md/sdk-go"
)

func main() {
\tpaywall, err := remitmd.NewX402Paywall(remitmd.PaywallOptions{
\t\tWalletAddress:  "${walletAddress}",
\t\tRouterAddress:  "${routerAddress}",
\t\tAmountUsdc:     ${amountUsdc},
\t\tNetwork:        "${network}",
\t\tAsset:          "${asset}",
\t\tFacilitatorURL: "https://remit.md",${v2}
\t})
\tif err != nil {
\t\tpanic(err)
\t}

\thttp.Handle("/your-endpoint", paywall.Middleware()(http.HandlerFunc(yourHandler)))
\thttp.ListenAndServe(":8080", nil)
}`,
  };
}

const x402PaywallSetupTool: Tool = {
  definition: {
    name: "x402_paywall_setup",
    description:
      "Generate the install command and code snippet to add an x402 micropayment paywall to a service endpoint. " +
      "Use when a service developer wants to charge per-request USDC micropayments. " +
      "Supports Python (FastAPI default, Flask), TypeScript (Hono default, Express), and Go (net/http). " +
      "Returns { install, code } - paste the install command, then drop the code into your server.",
    inputSchema: zodToMcpSchema(X402PaywallSetupArgs),
  },
  handler: async (args, wallet) => {
    const { language, wallet_address, router_address, amount_usdc, network, asset, framework, resource, description, mime_type } =
      parseInput(X402PaywallSetupArgs, args);

    // Resolve defaults from /contracts API when asset/router not explicitly provided
    const needDefaults = !asset || !router_address;
    const defaults = needDefaults ? await fetchContractDefaults(wallet) : undefined;
    const usdcAddress = asset ?? defaults!.usdc;
    const routerAddr = router_address ?? defaults!.router;

    if (language === "python") {
      const fw = framework ?? "fastapi";
      const v2 = pyV2Lines(resource, description, mime_type);
      return buildPythonSnippet(wallet_address, routerAddr, amount_usdc, escapePy(network), usdcAddress, fw, v2);
    }

    if (language === "typescript") {
      const fw = framework ?? "hono";
      const v2 = tsV2Lines(resource, description, mime_type);
      return buildTsSnippet(wallet_address, routerAddr, amount_usdc, escapeTs(network), usdcAddress, fw, v2);
    }

    // go
    const v2 = goV2Lines(resource, description, mime_type);
    return buildGoSnippet(wallet_address, routerAddr, amount_usdc, escapeGo(network), usdcAddress, v2);
  },
};

return [x402PayTool, x402ConfigTool, x402PaywallSetupTool];

} // end createX402Tools

/** Default x402 tools using a shared module-level config (backward compat for tests). */
export const x402Tools: Tool[] = createX402Tools({ maxAutoPayUsdc: 0.10, enabled: false });
