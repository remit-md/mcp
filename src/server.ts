import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
  McpError,
  ErrorCode,
} from "@modelcontextprotocol/sdk/types.js";
import { ALL_TOOLS, callTool } from "./tools/index.js";
import { listResources, readResource } from "./resources/index.js";
import { listPrompts, getPrompt } from "./prompts/index.js";
import type { WalletLike } from "./types.js";

const SERVER_INFO = { name: "@remitmd/mcp-server", version: "0.1.0" };

/**
 * Create and configure the MCP server with all tools, resources, and prompts.
 * The wallet object is captured in closure - the private key never leaves this process.
 */
export function createServer(wallet: WalletLike): Server {
  const server = new Server(SERVER_INFO, {
    capabilities: { tools: {}, resources: {}, prompts: {} },
  });

  // ─── Tools ─────────────────────────────────────────────────────────────────

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: ALL_TOOLS.map((t) => t.definition),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args = {} } = request.params;
    try {
      const result = await callTool(name, args as Record<string, unknown>, wallet);
      return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new McpError(ErrorCode.InternalError, message);
    }
  });

  // ─── Resources ─────────────────────────────────────────────────────────────

  server.setRequestHandler(ListResourcesRequestSchema, async () => ({
    resources: listResources(),
  }));

  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const { uri } = request.params;
    try {
      const content = await readResource(uri, wallet);
      return {
        contents: [{ uri, mimeType: content.mimeType, text: content.text }],
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new McpError(ErrorCode.InvalidRequest, message);
    }
  });

  // ─── Prompts ───────────────────────────────────────────────────────────────

  server.setRequestHandler(ListPromptsRequestSchema, async () => ({
    prompts: listPrompts(),
  }));

  server.setRequestHandler(GetPromptRequestSchema, async (request) => {
    const { name, arguments: args = {} } = request.params;
    try {
      const messages = getPrompt(name, args as Record<string, string>);
      return { messages };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new McpError(ErrorCode.InvalidRequest, message);
    }
  });

  return server;
}
