/**
 * Convert a Zod schema to a JSON Schema suitable for MCP tool inputSchema.
 *
 * Uses zod-to-json-schema to derive the JSON Schema, then strips
 * $schema and additionalProperties (MCP clients don't need them).
 */

import type { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import type { ToolInputSchema } from "../types.js";

export function zodToMcpSchema(schema: z.ZodType): ToolInputSchema {
  const jsonSchema = zodToJsonSchema(schema, { $refStrategy: "none" }) as Record<string, unknown>;
  delete jsonSchema["$schema"];
  delete jsonSchema["additionalProperties"];
  return jsonSchema as ToolInputSchema;
}
