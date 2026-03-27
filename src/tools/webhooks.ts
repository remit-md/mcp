import type { Tool } from "../types.js";
import { parseInput, RegisterWebhookArgs, DeleteWebhookArgs } from "./validate.js";

export const registerWebhookTool: Tool = {
  definition: {
    name: "register_webhook",
    description:
      "Register a webhook endpoint to receive real-time event notifications. " +
      "Specify which event types to subscribe to (e.g. payment.received, escrow.released). " +
      "Returns the webhook ID and a signing secret for verifying deliveries.",
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string", description: "HTTPS URL to deliver events to" },
        events: {
          type: "array",
          description:
            "Event types to subscribe to. Valid values: payment.sent, payment.received, " +
            "escrow.funded, escrow.released, escrow.cancelled, escrow.claim_started, tab.opened, tab.charged, " +
            "tab.closed, stream.opened, stream.withdrawn, stream.closed, bounty.posted, " +
            "bounty.awarded, bounty.expired, deposit.created, deposit.returned, " +
            "deposit.forfeited, x402.settled, x402.failed",
          items: { type: "string" },
        },
        chains: {
          type: "array",
          description: "Chain filter - omit to receive events from all chains",
          items: { type: "string" },
        },
      },
      required: ["url", "events"],
    },
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
    inputSchema: {
      type: "object",
      properties: {},
    },
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
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Webhook ID to delete" },
      },
      required: ["id"],
    },
  },
  handler: async (args, wallet) => {
    const { id } = parseInput(DeleteWebhookArgs, args);
    await wallet.deleteWebhook(id);
    return { success: true, id };
  },
};

export const webhookTools: Tool[] = [registerWebhookTool, listWebhooksTool, deleteWebhookTool];
