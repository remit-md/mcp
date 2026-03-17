import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import type { Tool } from "../types.js";
import { parseInput, X402PayArgs, X402ConfigArgs, X402PaywallSetupArgs } from "./validate.js";

/** Session-level x402 auto-pay configuration (persists for MCP server lifetime). */
interface X402Config {
  maxAutoPayUsdc: number;
  enabled: boolean;
}

const x402Config: X402Config = { maxAutoPayUsdc: 0.10, enabled: true };

export const x402PayTool: Tool = {
  definition: {
    name: "x402_pay",
    description:
      "Make an HTTP request to a URL, automatically paying any x402 Payment Required (402) response. " +
      "Use when an API charges micropayments per request. Returns the response status and body.",
    inputSchema: {
      type: "object",
      properties: {
        url: {
          type: "string",
          description: "URL to fetch. If the server returns 402, a payment will be made automatically.",
        },
        max_usdc: {
          type: "number",
          description:
            "Maximum USDC to auto-pay for this single request (overrides session config). " +
            "Defaults to the session max set by x402_config.",
        },
      },
      required: ["url"],
    },
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

export const x402ConfigTool: Tool = {
  definition: {
    name: "x402_config",
    description:
      "Configure x402 auto-pay settings for this session. " +
      "Set the maximum USDC amount to auto-pay per request, or enable/disable auto-pay entirely. " +
      "Settings persist for the duration of the MCP session.",
    inputSchema: {
      type: "object",
      properties: {
        max_auto_pay_usdc: {
          type: "number",
          description: "Maximum USDC to auto-pay per x402 request (e.g. 0.10). Must be positive.",
        },
        enabled: {
          type: "boolean",
          description: "Enable or disable x402 auto-pay. Disabled mode blocks all x402_pay calls.",
        },
      },
      required: [],
    },
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

// ─── Default addresses (Base Sepolia) ────────────────────────────────────────

const DEFAULT_USDC = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
const DEFAULT_ROUTER = "0x887536bD817B758f99F090a80F48032a24f50916";

// ─── Code-generation helpers ──────────────────────────────────────────────────

function pyV2Lines(resource?: string, description?: string, mimeType?: string): string {
  const lines: string[] = [];
  if (resource) lines.push(`    resource="${resource}",`);
  if (description) lines.push(`    description="${description}",`);
  if (mimeType) lines.push(`    mime_type="${mimeType}",`);
  return lines.length ? "\n" + lines.join("\n") : "";
}

function tsV2Lines(resource?: string, description?: string, mimeType?: string): string {
  const lines: string[] = [];
  if (resource) lines.push(`  resource: "${resource}",`);
  if (description) lines.push(`  description: "${description}",`);
  if (mimeType) lines.push(`  mimeType: "${mimeType}",`);
  return lines.length ? "\n" + lines.join("\n") : "";
}

function goV2Lines(resource?: string, description?: string, mimeType?: string): string {
  const lines: string[] = [];
  if (resource) lines.push(`        Resource: "${resource}",`);
  if (description) lines.push(`        Description: "${description}",`);
  if (mimeType) lines.push(`        MimeType: "${mimeType}",`);
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

export const x402PaywallSetupTool: Tool = {
  definition: {
    name: "x402_paywall_setup",
    description:
      "Generate the install command and code snippet to add an x402 micropayment paywall to a service endpoint. " +
      "Use when a service developer wants to charge per-request USDC micropayments. " +
      "Supports Python (FastAPI default, Flask), TypeScript (Hono default, Express), and Go (net/http). " +
      "Returns { install, code } — paste the install command, then drop the code into your server.",
    inputSchema: {
      type: "object",
      properties: {
        language: {
          type: "string",
          description: "Programming language: python, typescript, or go.",
          enum: ["python", "typescript", "go"],
        },
        wallet_address: {
          type: "string",
          description: "Ethereum wallet address that will receive payments.",
        },
        router_address: {
          type: "string",
          description:
            "RemitRouter contract address. The agent signs EIP-3009 to this address; the Router deducts the protocol fee and forwards the net amount. " +
            "Defaults to the Base Sepolia Router (0x887536bD817B758f99F090a80F48032a24f50916).",
        },
        amount_usdc: {
          type: "number",
          description: "Price per request in USDC (e.g. 0.001 = 0.1 cents).",
        },
        network: {
          type: "string",
          description:
            "CAIP-2 network string. Use eip155:84532 for Base Sepolia (testnet) or eip155:8453 for Base mainnet.",
        },
        asset: {
          type: "string",
          description:
            "USDC contract address on the target network. " +
            "Defaults to 0x036CbD53842c5426634e7929541eC2318f3dCF7e (Base Sepolia USDC) if omitted.",
        },
        framework: {
          type: "string",
          description:
            "Web framework. Python: fastapi (default) or flask. TypeScript: hono (default) or express. " +
            "Go only supports net/http.",
          enum: ["fastapi", "flask", "hono", "express", "net/http"],
        },
        resource: {
          type: "string",
          description: "V2 optional: URL path of the resource being gated (e.g. /v1/data).",
        },
        description: {
          type: "string",
          description: "V2 optional: Human-readable description of what the payment covers.",
        },
        mime_type: {
          type: "string",
          description: "V2 optional: MIME type of the resource (e.g. application/json).",
        },
      },
      required: ["language", "wallet_address", "amount_usdc", "network"],
    },
  },
  handler: async (args, _wallet) => {
    const { language, wallet_address, router_address, amount_usdc, network, asset, framework, resource, description, mime_type } =
      parseInput(X402PaywallSetupArgs, args);

    const usdcAddress = asset ?? DEFAULT_USDC;
    const routerAddr = router_address ?? DEFAULT_ROUTER;

    if (language === "python") {
      const fw = framework ?? "fastapi";
      const v2 = pyV2Lines(resource, description, mime_type);
      return buildPythonSnippet(wallet_address, routerAddr, amount_usdc, network, usdcAddress, fw, v2);
    }

    if (language === "typescript") {
      const fw = framework ?? "hono";
      const v2 = tsV2Lines(resource, description, mime_type);
      return buildTsSnippet(wallet_address, routerAddr, amount_usdc, network, usdcAddress, fw, v2);
    }

    // go
    const v2 = goV2Lines(resource, description, mime_type);
    return buildGoSnippet(wallet_address, routerAddr, amount_usdc, network, usdcAddress, v2);
  },
};

export const x402Tools: Tool[] = [x402PayTool, x402ConfigTool, x402PaywallSetupTool];
