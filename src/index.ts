#!/usr/bin/env node
/**
 * @remitmd/mcp-server - entry point
 *
 * Starts the MCP server on stdio transport. Configure in claude_desktop_config.json:
 *
 *   "mcpServers": {
 *     "remit": {
 *       "command": "npx",
 *       "args": ["@remitmd/mcp-server"],
 *       "env": {
 *         "REMITMD_KEY": "0x...",
 *         "REMITMD_CHAIN": "base"
 *       }
 *     }
 *   }
 *
 * Or with OWS (recommended):
 *
 *   "env": { "OWS_WALLET_ID": "remit-my-agent", "REMITMD_CHAIN": "base" }
 */

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./server.js";
import { createWalletFromEnv } from "./signer.js";

async function main(): Promise<void> {
  const wallet = await createWalletFromEnv();
  const server = createServer(wallet);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // Server runs until stdin closes
}

main().catch((err) => {
  console.error("remitmd-mcp: fatal error:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
