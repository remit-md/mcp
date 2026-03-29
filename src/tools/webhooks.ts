import type { Tool } from "../types.js";
import { parseInput, RegisterWebhookArgs, DeleteWebhookArgs, EmptyArgs } from "./validate.js";
import { zodToMcpSchema } from "./schema.js";

export const registerWebhookTool: Tool = {
  definition: {
    name: "register_webhook",
    description:
      "Register a webhook endpoint to receive real-time event notifications. " +
      "Specify which event types to subscribe to (e.g. payment.received, escrow.released). " +
      "Returns the webhook ID and a signing secret for verifying deliveries.",
    inputSchema: zodToMcpSchema(RegisterWebhookArgs),
  },
  handler: async (args, wallet) => {
    const { url, events, chains } = parseInput(RegisterWebhookArgs, args);
    const webhook = await wallet.registerWebhook(url, events, chains);
    return {
      success: true,
      id: webhook.id,
      url: webhook.url,
      events: webhook.events,
      chains: webhook.chains,
      active: webhook.active,
    };
  },
};

export const listWebhooksTool: Tool = {
  definition: {
    name: "list_webhooks",
    description: "List all webhook registrations for the authenticated wallet.",
    inputSchema: zodToMcpSchema(EmptyArgs),
  },
  handler: async (_args, wallet) => {
    const webhooks = await wallet.listWebhooks();
    return { webhooks };
  },
};

export const deleteWebhookTool: Tool = {
  definition: {
    name: "delete_webhook",
    description: "Delete a webhook registration by ID.",
    inputSchema: zodToMcpSchema(DeleteWebhookArgs),
  },
  handler: async (args, wallet) => {
    const { id } = parseInput(DeleteWebhookArgs, args);
    await wallet.deleteWebhook(id);
    return { success: true, id };
  },
};

export const webhookTools: Tool[] = [registerWebhookTool, listWebhooksTool, deleteWebhookTool];
