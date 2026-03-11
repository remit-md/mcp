import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import type { Tool } from "../types.js";
import { parseInput, X402PayArgs, X402ConfigArgs } from "./validate.js";

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
    const response = await wallet.x402Fetch(url, limit);
    const body = await response.text();
    return { status: response.status, ok: response.ok, body };
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

export const x402Tools: Tool[] = [x402PayTool, x402ConfigTool];
