import { z } from "zod";
import type { CloudflareClient } from "../client/cloudflare-client.js";
import { ZoneNameOrIdSchema } from "../utils/validation.js";

// ---------------------------------------------------------------------------
// Zod schemas for input validation
// ---------------------------------------------------------------------------

const RateLimitListSchema = z.object({
  zone_id: ZoneNameOrIdSchema,
  page: z.number().int().min(1).optional(),
  per_page: z.number().int().min(1).max(100).optional(),
});

const RateLimitGetSchema = z.object({
  zone_id: ZoneNameOrIdSchema,
  rate_limit_id: z.string().min(1, "Rate limit ID is required"),
});

const RateLimitStatusSchema = z.object({
  zone_id: ZoneNameOrIdSchema,
});

// ---------------------------------------------------------------------------
// Tool definitions (for ListTools)
// ---------------------------------------------------------------------------

export const ratelimitingToolDefinitions = [
  {
    name: "cloudflare_rate_limit_list",
    description: "List all rate limiting rules for a zone with pagination.",
    inputSchema: {
      type: "object" as const,
      properties: {
        zone_id: {
          type: "string",
          description: "Zone ID (32-char hex) or zone name (e.g., 'example.com')",
        },
        page: { type: "number", description: "Page number (default: 1)" },
        per_page: { type: "number", description: "Results per page, max 100 (default: 20)" },
      },
      required: ["zone_id"],
    },
  },
  {
    name: "cloudflare_rate_limit_get",
    description: "Get details of a specific rate limiting rule including threshold, period, action, and match conditions.",
    inputSchema: {
      type: "object" as const,
      properties: {
        zone_id: {
          type: "string",
          description: "Zone ID (32-char hex) or zone name (e.g., 'example.com')",
        },
        rate_limit_id: {
          type: "string",
          description: "Rate limit rule ID",
        },
      },
      required: ["zone_id", "rate_limit_id"],
    },
  },
  {
    name: "cloudflare_rate_limit_status",
    description: "Get a summary of all rate limiting rules for a zone — total count, enabled/disabled breakdown, and action types.",
    inputSchema: {
      type: "object" as const,
      properties: {
        zone_id: {
          type: "string",
          description: "Zone ID (32-char hex) or zone name (e.g., 'example.com')",
        },
      },
      required: ["zone_id"],
    },
  },
];

// ---------------------------------------------------------------------------
// Rate limit types (inline — not shared across modules)
// ---------------------------------------------------------------------------

interface RateLimit {
  id: string;
  disabled: boolean;
  description: string;
  match: Record<string, unknown>;
  threshold: number;
  period: number;
  action: { mode: string; timeout?: number; response?: Record<string, unknown> };
}

// ---------------------------------------------------------------------------
// Tool handler
// ---------------------------------------------------------------------------

export async function handleRatelimitingTool(
  name: string,
  args: Record<string, unknown>,
  client: CloudflareClient,
): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  try {
    switch (name) {
      case "cloudflare_rate_limit_list": {
        const parsed = RateLimitListSchema.parse(args);
        const zoneId = await client.resolveZoneId(parsed.zone_id);
        const params: Record<string, unknown> = {};
        if (parsed.page !== undefined) params["page"] = parsed.page;
        if (parsed.per_page !== undefined) params["per_page"] = parsed.per_page;
        const result = await client.get(`/zones/${zoneId}/rate_limits`, params);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      case "cloudflare_rate_limit_get": {
        const parsed = RateLimitGetSchema.parse(args);
        const zoneId = await client.resolveZoneId(parsed.zone_id);
        const result = await client.get(`/zones/${zoneId}/rate_limits/${parsed.rate_limit_id}`);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      case "cloudflare_rate_limit_status": {
        const parsed = RateLimitStatusSchema.parse(args);
        const zoneId = await client.resolveZoneId(parsed.zone_id);
        const rules = await client.get<RateLimit[]>(`/zones/${zoneId}/rate_limits`, { per_page: 1000 });
        const all = Array.isArray(rules) ? rules : [];
        const enabled = all.filter((r) => !r.disabled).length;
        const disabled = all.filter((r) => r.disabled).length;
        const actions: Record<string, number> = {};
        for (const r of all) {
          const mode = r.action?.mode ?? "unknown";
          actions[mode] = (actions[mode] ?? 0) + 1;
        }
        const summary = {
          total: all.length,
          enabled,
          disabled,
          actions,
        };
        return { content: [{ type: "text", text: JSON.stringify(summary, null, 2) }] };
      }

      default:
        return {
          content: [{ type: "text", text: `Unknown rate limiting tool: ${name}` }],
        };
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return {
      content: [{ type: "text", text: `Error executing ${name}: ${message}` }],
    };
  }
}
