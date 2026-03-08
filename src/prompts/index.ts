export interface PromptArgument {
  name: string;
  description: string;
  required?: boolean;
}

export interface PromptDefinition {
  name: string;
  description: string;
  arguments?: PromptArgument[];
}

export interface PromptMessage {
  role: "user" | "assistant";
  content: { type: "text"; text: string };
}

const PROMPT_DEFINITIONS: PromptDefinition[] = [
  {
    name: "hire_agent",
    description: "Guide you through hiring and paying an agent for a task using escrow",
    arguments: [
      { name: "task", description: "Description of the work needed", required: true },
      { name: "budget", description: "Your budget in USD", required: true },
    ],
  },
  {
    name: "negotiate_price",
    description: "Help you evaluate and negotiate a fair price with a service provider",
    arguments: [
      { name: "service", description: "Service or task being negotiated", required: true },
      { name: "initial_price", description: "Initial price quoted in USD", required: true },
    ],
  },
  {
    name: "verify_delivery",
    description: "Guide you through verifying work completion and releasing escrow payment",
    arguments: [
      {
        name: "invoice_id",
        description: "Invoice ID of the escrow to verify and release",
        required: true,
      },
    ],
  },
];

export function listPrompts(): PromptDefinition[] {
  return PROMPT_DEFINITIONS;
}

export function getPrompt(
  name: string,
  args: Record<string, string>,
): PromptMessage[] {
  const task = args["task"] ?? "";
  const budget = args["budget"] ?? "";
  const service = args["service"] ?? "";
  const initialPrice = args["initial_price"] ?? "";
  const invoiceId = args["invoice_id"] ?? "";

  switch (name) {
    case "hire_agent":
      return [
        {
          role: "user",
          content: {
            type: "text",
            text: `I need help hiring an agent for the following task:\n\nTask: ${task}\nBudget: $${budget} USD\n\nPlease guide me through safely hiring and paying an agent using remit.md.`,
          },
        },
        {
          role: "assistant",
          content: {
            type: "text",
            text: [
              `I'll help you hire an agent for this task. Here's the recommended process:\n`,
              `**1. Find and evaluate agents**`,
              `Check candidate reputation with \`get_status\`. Agents with a score of 90+ and low dispute rates are preferred.\n`,
              `**2. Agree on scope**`,
              `Confirm deliverables, timeline, and payment structure before committing funds.\n`,
              `**3. Create escrow** (use \`create_escrow\`)`,
              `- To: agent's wallet address`,
              `- Amount: $${budget}`,
              `- Task: "${task}"`,
              `- Timeout: 86400 (1 day) or longer for complex work`,
              `- Milestones: optional, for phased payment\n`,
              `**4. Monitor progress**`,
              `The agent will call \`claim_start\`. You'll receive events as work progresses.\n`,
              `**5. Verify and release**`,
              `Once satisfied, use \`release_escrow\` with the invoice ID. If there's an issue, use \`file_dispute\`.\n`,
              `Shall I help you create the escrow now?`,
            ].join("\n"),
          },
        },
      ];

    case "negotiate_price":
      return [
        {
          role: "user",
          content: {
            type: "text",
            text: `I need help negotiating the price for: ${service}\n\nInitial quoted price: $${initialPrice} USD. Is this fair? How should I negotiate?`,
          },
        },
        {
          role: "assistant",
          content: {
            type: "text",
            text: [
              `Let me help you evaluate and negotiate this price.\n`,
              `**Initial quote:** $${initialPrice} for ${service}\n`,
              `**Step 1: Evaluate the provider**`,
              `Use \`get_status\` on the provider's wallet to check:`,
              `- Reputation score (90+ justifies premium pricing)`,
              `- Completed payments and dispute rate`,
              `- Total volume (indicates experience)\n`,
              `**Step 2: Negotiate structure**`,
              `Even if the total price is fair, structure reduces risk:`,
              `- Propose milestone-based escrow (25% / 75%)`,
              `- Or offer a small trial escrow ($10-20) first`,
              `- A deposit (\`place_deposit\`) signals commitment without full risk\n`,
              `**Step 3: Counter-offer**`,
              `If the price seems high, offer:`,
              `- Immediate funding (agents prefer guaranteed payment)`,
              `- Faster escrow release timeline`,
              `- In exchange for a 10-15% reduction\n`,
              `Would you like me to check the provider's reputation, or help structure a milestone-based counter-offer?`,
            ].join("\n"),
          },
        },
      ];

    case "verify_delivery":
      return [
        {
          role: "user",
          content: {
            type: "text",
            text: `I need to verify work completion for invoice ${invoiceId} and decide whether to release payment.`,
          },
        },
        {
          role: "assistant",
          content: {
            type: "text",
            text: [
              `I'll help you verify delivery for invoice \`${invoiceId}\`.\n`,
              `**Step 1: Check escrow status**`,
              `Read \`remit://escrow/${invoiceId}/status\` to see the current state, submitted evidence URI, and milestone breakdown.\n`,
              `**Step 2: Review deliverables**`,
              `Verify the submitted evidence against the agreed scope:`,
              `- Does it meet the task description?`,
              `- Is the quality acceptable?`,
              `- Were all milestones completed?\n`,
              `**Step 3: Take action**\n`,
              `✅ **Satisfied with all work:**`,
              `\`release_escrow\` with invoice_id: "${invoiceId}"\n`,
              `⚠️ **Partially satisfied (milestones):**`,
              `Release individual milestones via the API as each is completed.\n`,
              `❌ **Work not delivered or below standard:**`,
              `\`file_dispute\` with invoice_id: "${invoiceId}", specific reasons, and evidence URI.\n`,
              `Shall I look up the escrow status for invoice ${invoiceId} now?`,
            ].join("\n"),
          },
        },
      ];

    default:
      throw new Error(`Unknown prompt: ${name}`);
  }
}
