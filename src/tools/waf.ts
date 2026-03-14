import { z } from "zod";
import type { CloudflareClient } from "../client/cloudflare-client.js";
import { ZoneNameOrIdSchema } from "../utils/validation.js";

// ---------------------------------------------------------------------------
// Zod schemas for input validation
// ---------------------------------------------------------------------------

const WafListRulesetsSchema = z.object({
  zone_id: ZoneNameOrIdSchema,
});

const WafGetRulesetSchema = z.object({
  zone_id: ZoneNameOrIdSchema,
  ruleset_id: z.string().min(1, "Ruleset ID is required"),
});

const WafListCustomRulesSchema = z.object({
  zone_id: ZoneNameOrIdSchema,
});

const WafActionSchema = z.enum([
  "block",
  "challenge",
  "js_challenge",
  "managed_challenge",
  "skip",
  "log",
]);

const WafCreateCustomRuleSchema = z.object({
  zone_id: ZoneNameOrIdSchema,
  expression: z.string().min(1, "Firewall expression is required"),
  action: WafActionSchema,
  description: z.string().optional(),
});

const WafDeleteCustomRuleSchema = z.object({
  zone_id: ZoneNameOrIdSchema,
  ruleset_id: z.string().min(1, "Ruleset ID is required"),
  rule_id: z.string().min(1, "Rule ID is required"),
});

// ---------------------------------------------------------------------------
// Tool definitions (for ListTools)
// ---------------------------------------------------------------------------

export const wafToolDefinitions = [
  {
    name: "cloudflare_waf_list_rulesets",
    description: "List all WAF rulesets for a zone (managed, custom, rate-limiting, etc.).",
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
  {
    name: "cloudflare_waf_get_ruleset",
    description:
      "Get a specific WAF ruleset by ID, including all rules within the ruleset.",
    inputSchema: {
      type: "object" as const,
      properties: {
        zone_id: {
          type: "string",
          description: "Zone ID (32-char hex) or zone name (e.g., 'example.com')",
        },
        ruleset_id: {
          type: "string",
          description: "Ruleset ID",
        },
      },
      required: ["zone_id", "ruleset_id"],
    },
  },
  {
    name: "cloudflare_waf_list_custom_rules",
    description:
      "List all custom WAF firewall rules for a zone (http_request_firewall_custom phase entrypoint).",
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
  {
    name: "cloudflare_waf_create_custom_rule",
    description:
      "Add a new custom WAF firewall rule to a zone. Uses Cloudflare Rules Language for the expression.",
    inputSchema: {
      type: "object" as const,
      properties: {
        zone_id: {
          type: "string",
          description: "Zone ID (32-char hex) or zone name (e.g., 'example.com')",
        },
        expression: {
          type: "string",
          description:
            "Cloudflare Rules Language expression (e.g., '(ip.src eq 192.0.2.1)')",
        },
        action: {
          type: "string",
          enum: ["block", "challenge", "js_challenge", "managed_challenge", "skip", "log"],
          description: "Action to take when the rule matches",
        },
        description: {
          type: "string",
          description: "Optional human-readable description for the rule",
        },
      },
      required: ["zone_id", "expression", "action"],
    },
  },
  {
    name: "cloudflare_waf_delete_custom_rule",
    description: "Delete a custom WAF firewall rule from a zone ruleset.",
    inputSchema: {
      type: "object" as const,
      properties: {
        zone_id: {
          type: "string",
          description: "Zone ID (32-char hex) or zone name (e.g., 'example.com')",
        },
        ruleset_id: {
          type: "string",
          description: "Ruleset ID containing the rule",
        },
        rule_id: {
          type: "string",
          description: "Rule ID to delete",
        },
      },
      required: ["zone_id", "ruleset_id", "rule_id"],
    },
  },
];

// ---------------------------------------------------------------------------
// Tool handler
// ---------------------------------------------------------------------------

export async function handleWafTool(
  name: string,
  args: Record<string, unknown>,
  client: CloudflareClient,
): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  try {
    switch (name) {
      case "cloudflare_waf_list_rulesets": {
        const parsed = WafListRulesetsSchema.parse(args);
        const zoneId = await client.resolveZoneId(parsed.zone_id);
        const result = await client.get(`/zones/${zoneId}/rulesets`);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      case "cloudflare_waf_get_ruleset": {
        const parsed = WafGetRulesetSchema.parse(args);
        const zoneId = await client.resolveZoneId(parsed.zone_id);
        const result = await client.get(`/zones/${zoneId}/rulesets/${parsed.ruleset_id}`);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      case "cloudflare_waf_list_custom_rules": {
        const parsed = WafListCustomRulesSchema.parse(args);
        const zoneId = await client.resolveZoneId(parsed.zone_id);
        const result = await client.get(
          `/zones/${zoneId}/rulesets/phases/http_request_firewall_custom/entrypoint`,
        );
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      case "cloudflare_waf_create_custom_rule": {
        const parsed = WafCreateCustomRuleSchema.parse(args);
        const zoneId = await client.resolveZoneId(parsed.zone_id);
        const body: Record<string, unknown> = {
          expression: parsed.expression,
          action: parsed.action,
        };
        if (parsed.description !== undefined) body["description"] = parsed.description;
        const result = await client.post(
          `/zones/${zoneId}/rulesets/phases/http_request_firewall_custom/entrypoint/rules`,
          body,
        );
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      case "cloudflare_waf_delete_custom_rule": {
        const parsed = WafDeleteCustomRuleSchema.parse(args);
        const zoneId = await client.resolveZoneId(parsed.zone_id);
        const result = await client.delete(
          `/zones/${zoneId}/rulesets/${parsed.ruleset_id}/rules/${parsed.rule_id}`,
        );
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      default:
        return {
          content: [{ type: "text", text: `Unknown WAF tool: ${name}` }],
        };
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return {
      content: [{ type: "text", text: `Error executing ${name}: ${message}` }],
    };
  }
}
