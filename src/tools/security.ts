import { z } from "zod";
import type { CloudflareClient } from "../client/cloudflare-client.js";
import {
  ZoneNameOrIdSchema,
  SecurityLevelSchema,
  IpAccessRuleTargetSchema,
} from "../utils/validation.js";

// ---------------------------------------------------------------------------
// Zod schemas for input validation
// ---------------------------------------------------------------------------

const SecurityLevelGetSchema = z.object({
  zone_id: ZoneNameOrIdSchema,
});

const SecurityLevelSetSchema = z.object({
  zone_id: ZoneNameOrIdSchema,
  value: SecurityLevelSchema,
});

const SecurityEventsSchema = z.object({
  zone_id: ZoneNameOrIdSchema,
  since: z.string().datetime({ offset: true }).optional(),
  limit: z.number().int().min(1).max(10000).optional(),
});

const DdosAnalyticsSchema = z.object({
  zone_id: ZoneNameOrIdSchema,
  since: z.string().datetime({ offset: true }).optional(),
  limit: z.number().int().min(1).max(10000).optional(),
});

const IpAccessListSchema = z.object({
  zone_id: ZoneNameOrIdSchema,
  mode: z.enum(["block", "challenge", "whitelist", "js_challenge"]).optional(),
  page: z.number().int().min(1).optional(),
  per_page: z.number().int().min(1).max(1000).optional(),
});

const IpAccessCreateSchema = z.object({
  zone_id: ZoneNameOrIdSchema,
  mode: z.enum(["block", "challenge", "whitelist", "js_challenge"]),
  target: IpAccessRuleTargetSchema,
  value: z.string().min(1, "Value is required (IP, CIDR, ASN number, or country code)"),
  notes: z.string().optional(),
});

const IpAccessDeleteSchema = z.object({
  zone_id: ZoneNameOrIdSchema,
  rule_id: z.string().min(1, "Rule ID is required"),
});

const UnderAttackStatusSchema = z.object({
  zone_id: ZoneNameOrIdSchema,
});

const SecurityInsightsSchema = z.object({
  severity: z.enum(["low", "moderate", "critical"]).optional(),
  issue_type: z
    .enum(["compliance_violation", "email_security", "exposed_infrastructure"])
    .optional(),
  dismissed: z.boolean().optional(),
  page: z.number().int().min(1).optional(),
  per_page: z.number().int().min(1).max(1000).optional(),
});

const SecurityInsightsSeverityCountSchema = z.object({});

// ---------------------------------------------------------------------------
// GraphQL query templates
// ---------------------------------------------------------------------------

const SECURITY_EVENTS_QUERY = `
query SecurityEvents($zoneTag: string!, $since: Time!, $limit: Int!) {
  viewer {
    zones(filter: { zoneTag: $zoneTag }) {
      firewallEventsAdaptive(
        filter: { datetime_gt: $since }
        limit: $limit
        orderBy: [datetime_DESC]
      ) {
        action
        clientIP
        clientAsn
        clientCountryName
        datetime
        source
        userAgent
        ruleId
        rayName
      }
    }
  }
}
`.trim();

const DDOS_ANALYTICS_QUERY = `
query DdosAnalytics($zoneTag: string!, $since: Time!, $limit: Int!) {
  viewer {
    zones(filter: { zoneTag: $zoneTag }) {
      httpRequestsAdaptiveGroups(
        filter: { datetime_gt: $since, requestSource: "attack" }
        limit: $limit
      ) {
        count
        dimensions {
          datetimeHour
          clientCountryName
          clientAsn
        }
      }
    }
  }
}
`.trim();

// ---------------------------------------------------------------------------
// Account ID helper
// ---------------------------------------------------------------------------

function requireAccountId(client: CloudflareClient): string {
  const accountId = client.getAccountId();
  if (!accountId) {
    throw new Error(
      "CLOUDFLARE_ACCOUNT_ID environment variable is required for Security Center operations",
    );
  }
  return accountId;
}

// ---------------------------------------------------------------------------
// Tool definitions (for ListTools)
// ---------------------------------------------------------------------------

export const securityToolDefinitions = [
  {
    name: "cloudflare_security_level_get",
    description:
      "Get the current security level setting for a zone (off, essentially_off, low, medium, high, under_attack).",
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
    name: "cloudflare_security_level_set",
    description:
      "DESTRUCTIVE: Update the security level for a zone. Changes affect live traffic immediately. Use 'under_attack' only during active DDoS attacks.",
    inputSchema: {
      type: "object" as const,
      properties: {
        zone_id: {
          type: "string",
          description: "Zone ID (32-char hex) or zone name (e.g., 'example.com')",
        },
        value: {
          type: "string",
          enum: ["off", "essentially_off", "low", "medium", "high", "under_attack"],
          description: "Security level to set",
        },
      },
      required: ["zone_id", "value"],
    },
  },
  {
    name: "cloudflare_security_events",
    description:
      "Query recent security/firewall events for a zone using Cloudflare GraphQL Analytics.",
    inputSchema: {
      type: "object" as const,
      properties: {
        zone_id: {
          type: "string",
          description: "Zone ID (32-char hex) or zone name (e.g., 'example.com')",
        },
        since: {
          type: "string",
          description:
            "ISO 8601 datetime to query from (default: 1 hour ago). E.g., '2026-03-13T00:00:00Z'",
        },
        limit: {
          type: "number",
          description: "Maximum number of events to return (default: 100, max: 10000)",
        },
      },
      required: ["zone_id"],
    },
  },
  {
    name: "cloudflare_ddos_analytics",
    description:
      "Query DDoS attack analytics for a zone using Cloudflare GraphQL Analytics. Returns aggregated attack traffic data.",
    inputSchema: {
      type: "object" as const,
      properties: {
        zone_id: {
          type: "string",
          description: "Zone ID (32-char hex) or zone name (e.g., 'example.com')",
        },
        since: {
          type: "string",
          description:
            "ISO 8601 datetime to query from (default: 24 hours ago). E.g., '2026-03-12T00:00:00Z'",
        },
        limit: {
          type: "number",
          description: "Maximum number of result groups to return (default: 100, max: 10000)",
        },
      },
      required: ["zone_id"],
    },
  },
  {
    name: "cloudflare_ip_access_list",
    description:
      "List IP access rules (firewall rules) for a zone. Filter by mode (block, challenge, whitelist, js_challenge).",
    inputSchema: {
      type: "object" as const,
      properties: {
        zone_id: {
          type: "string",
          description: "Zone ID (32-char hex) or zone name (e.g., 'example.com')",
        },
        mode: {
          type: "string",
          enum: ["block", "challenge", "whitelist", "js_challenge"],
          description: "Filter by rule mode",
        },
        page: { type: "number", description: "Page number (default: 1)" },
        per_page: { type: "number", description: "Results per page, max 1000 (default: 20)" },
      },
      required: ["zone_id"],
    },
  },
  {
    name: "cloudflare_ip_access_create",
    description:
      "Create an IP access rule for a zone. Targets can be a specific IP, CIDR range, ASN, or country code.",
    inputSchema: {
      type: "object" as const,
      properties: {
        zone_id: {
          type: "string",
          description: "Zone ID (32-char hex) or zone name (e.g., 'example.com')",
        },
        mode: {
          type: "string",
          enum: ["block", "challenge", "whitelist", "js_challenge"],
          description: "Action mode for the rule",
        },
        target: {
          type: "string",
          enum: ["ip", "ip_range", "asn", "country"],
          description: "Type of target to match",
        },
        value: {
          type: "string",
          description:
            "Value to match: IP address (192.0.2.1), CIDR (192.0.2.0/24), ASN number (AS12345), or 2-letter country code (US)",
        },
        notes: {
          type: "string",
          description: "Optional notes describing why the rule was created",
        },
      },
      required: ["zone_id", "mode", "target", "value"],
    },
  },
  {
    name: "cloudflare_ip_access_delete",
    description: "Delete an IP access rule from a zone by its rule ID.",
    inputSchema: {
      type: "object" as const,
      properties: {
        zone_id: {
          type: "string",
          description: "Zone ID (32-char hex) or zone name (e.g., 'example.com')",
        },
        rule_id: {
          type: "string",
          description: "Rule ID to delete",
        },
      },
      required: ["zone_id", "rule_id"],
    },
  },
  {
    name: "cloudflare_under_attack_status",
    description:
      "Check whether a zone is currently in 'Under Attack' mode. Returns the current security level and whether DDoS protection is maximized.",
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
    name: "cloudflare_security_insights",
    description:
      "List Security Center insights (configuration issues, vulnerabilities, misconfigurations) for the account. Requires CLOUDFLARE_ACCOUNT_ID.",
    inputSchema: {
      type: "object" as const,
      properties: {
        severity: {
          type: "string",
          enum: ["low", "moderate", "critical"],
          description: "Filter by severity level",
        },
        issue_type: {
          type: "string",
          enum: [
            "compliance_violation",
            "email_security",
            "exposed_infrastructure",
          ],
          description: "Filter by issue type",
        },
        dismissed: {
          type: "boolean",
          description:
            "Filter by dismissed status (default: false = active only)",
        },
        page: { type: "number", description: "Page number (default: 1)" },
        per_page: {
          type: "number",
          description: "Results per page, max 1000 (default: 25)",
        },
      },
    },
  },
  {
    name: "cloudflare_security_insights_severity_count",
    description:
      "Get Security Center insight counts grouped by severity (low, moderate, critical). Quick overview without fetching all issues. Requires CLOUDFLARE_ACCOUNT_ID.",
    inputSchema: {
      type: "object" as const,
      properties: {},
    },
  },
];

// ---------------------------------------------------------------------------
// Tool handler
// ---------------------------------------------------------------------------

export async function handleSecurityTool(
  name: string,
  args: Record<string, unknown>,
  client: CloudflareClient,
): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  try {
    switch (name) {
      case "cloudflare_security_level_get": {
        const parsed = SecurityLevelGetSchema.parse(args);
        const zoneId = await client.resolveZoneId(parsed.zone_id);
        const result = await client.get(`/zones/${zoneId}/settings/security_level`);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      case "cloudflare_security_level_set": {
        const parsed = SecurityLevelSetSchema.parse(args);
        const zoneId = await client.resolveZoneId(parsed.zone_id);
        const result = await client.patch(`/zones/${zoneId}/settings/security_level`, {
          value: parsed.value,
        });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      case "cloudflare_security_events": {
        const parsed = SecurityEventsSchema.parse(args);
        const zoneId = await client.resolveZoneId(parsed.zone_id);
        const since =
          parsed.since ?? new Date(Date.now() - 60 * 60 * 1000).toISOString();
        const limit = parsed.limit ?? 100;
        const result = await client.graphql<unknown>(SECURITY_EVENTS_QUERY, {
          zoneTag: zoneId,
          since,
          limit,
        });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      case "cloudflare_ddos_analytics": {
        const parsed = DdosAnalyticsSchema.parse(args);
        const zoneId = await client.resolveZoneId(parsed.zone_id);
        const since =
          parsed.since ?? new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const limit = parsed.limit ?? 100;
        const result = await client.graphql<unknown>(DDOS_ANALYTICS_QUERY, {
          zoneTag: zoneId,
          since,
          limit,
        });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      case "cloudflare_ip_access_list": {
        const parsed = IpAccessListSchema.parse(args);
        const zoneId = await client.resolveZoneId(parsed.zone_id);
        const params: Record<string, unknown> = {};
        if (parsed.mode !== undefined) params["mode"] = parsed.mode;
        if (parsed.page !== undefined) params["page"] = parsed.page;
        if (parsed.per_page !== undefined) params["per_page"] = parsed.per_page;
        const result = await client.get(
          `/zones/${zoneId}/firewall/access_rules/rules`,
          params,
        );
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      case "cloudflare_ip_access_create": {
        const parsed = IpAccessCreateSchema.parse(args);
        const zoneId = await client.resolveZoneId(parsed.zone_id);
        const body: Record<string, unknown> = {
          mode: parsed.mode,
          configuration: {
            target: parsed.target,
            value: parsed.value,
          },
        };
        if (parsed.notes !== undefined) body["notes"] = parsed.notes;
        const result = await client.post(
          `/zones/${zoneId}/firewall/access_rules/rules`,
          body,
        );
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      case "cloudflare_ip_access_delete": {
        const parsed = IpAccessDeleteSchema.parse(args);
        const zoneId = await client.resolveZoneId(parsed.zone_id);
        const result = await client.delete(
          `/zones/${zoneId}/firewall/access_rules/rules/${parsed.rule_id}`,
        );
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      case "cloudflare_under_attack_status": {
        const parsed = UnderAttackStatusSchema.parse(args);
        const zoneId = await client.resolveZoneId(parsed.zone_id);
        const result = await client.get<{ id: string; value: string; editable: boolean; modified_on: string }>(
          `/zones/${zoneId}/settings/security_level`,
        );
        const status = {
          zone_id: zoneId,
          security_level: result.value,
          under_attack: result.value === "under_attack",
          editable: result.editable,
          modified_on: result.modified_on,
        };
        return { content: [{ type: "text", text: JSON.stringify(status, null, 2) }] };
      }

      case "cloudflare_security_insights": {
        const parsed = SecurityInsightsSchema.parse(args);
        const accountId = requireAccountId(client);
        const params: Record<string, unknown> = {};
        if (parsed.severity !== undefined) params["severity"] = parsed.severity;
        if (parsed.issue_type !== undefined)
          params["issue_type"] = parsed.issue_type;
        if (parsed.dismissed !== undefined)
          params["dismissed"] = parsed.dismissed;
        if (parsed.page !== undefined) params["page"] = parsed.page;
        if (parsed.per_page !== undefined)
          params["per_page"] = parsed.per_page;
        const result = await client.get(
          `/accounts/${accountId}/security-center/insights`,
          params,
        );
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      case "cloudflare_security_insights_severity_count": {
        SecurityInsightsSeverityCountSchema.parse(args);
        const accountId = requireAccountId(client);
        const result = await client.get(
          `/accounts/${accountId}/security-center/insights/severity`,
        );
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      default:
        return {
          content: [{ type: "text", text: `Unknown security tool: ${name}` }],
        };
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return {
      content: [{ type: "text", text: `Error executing ${name}: ${message}` }],
    };
  }
}
