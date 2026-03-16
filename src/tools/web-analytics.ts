import { z } from "zod";
import type { CloudflareClient } from "../client/cloudflare-client.js";

// ---------------------------------------------------------------------------
// Zod schemas for input validation
// ---------------------------------------------------------------------------

const WebAnalyticsListSchema = z.object({
  order_by: z.enum(["host", "created"]).optional(),
});

const WebAnalyticsCreateSchema = z.object({
  host: z.string().min(1),
  zone_tag: z.string().optional(),
  auto_install: z.boolean().optional(),
});

const WebAnalyticsDeleteSchema = z.object({
  site_id: z.string().min(1),
});

const WebAnalyticsGetSchema = z.object({
  site_id: z.string().min(1),
});

const WebAnalyticsStatsSchema = z.object({
  zone_id: z.string().min(1),
  since: z.string().datetime({ offset: true }).optional(),
  limit: z.number().int().min(1).max(10000).optional(),
});

// ---------------------------------------------------------------------------
// GraphQL query for Web Analytics stats
// ---------------------------------------------------------------------------

const WEB_ANALYTICS_STATS_QUERY = `
query WebAnalyticsStats($zoneTag: string!, $since: Time!, $limit: Int!) {
  viewer {
    zones(filter: { zoneTag: $zoneTag }) {
      httpRequestsAdaptiveGroups(
        filter: { datetime_gt: $since }
        limit: $limit
        orderBy: [datetime_DESC]
      ) {
        dimensions { datetime }
        count
        sum { visits edgeResponseBytes }
        avg { sampleInterval }
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
      "CLOUDFLARE_ACCOUNT_ID environment variable is required for Web Analytics operations",
    );
  }
  return accountId;
}

// ---------------------------------------------------------------------------
// Tool definitions (for ListTools)
// ---------------------------------------------------------------------------

export const webAnalyticsToolDefinitions = [
  {
    name: "cloudflare_web_analytics_list",
    description:
      "List all Web Analytics (RUM) sites for the account. Returns site IDs, hostnames, and creation dates.",
    inputSchema: {
      type: "object" as const,
      properties: {
        order_by: {
          type: "string",
          enum: ["host", "created"],
          description: "Order results by field (default: host)",
        },
      },
    },
  },
  {
    name: "cloudflare_web_analytics_create",
    description:
      "Create/enable a Web Analytics (RUM) site. Enables privacy-first, cookie-free analytics beacon auto-injection for the specified hostname.",
    inputSchema: {
      type: "object" as const,
      properties: {
        host: {
          type: "string",
          description: "Hostname to enable analytics on (e.g., 'example.com')",
        },
        zone_tag: {
          type: "string",
          description:
            "Optional zone ID to link the site to (enables auto-inject at the edge). 32-char hex.",
        },
        auto_install: {
          type: "boolean",
          description: "Auto-inject the beacon script at the edge (default: true)",
        },
      },
      required: ["host"],
    },
  },
  {
    name: "cloudflare_web_analytics_get",
    description: "Get details of a specific Web Analytics (RUM) site by ID.",
    inputSchema: {
      type: "object" as const,
      properties: {
        site_id: {
          type: "string",
          description: "RUM site ID",
        },
      },
      required: ["site_id"],
    },
  },
  {
    name: "cloudflare_web_analytics_delete",
    description: "Delete a Web Analytics (RUM) site and stop collecting analytics.",
    inputSchema: {
      type: "object" as const,
      properties: {
        site_id: {
          type: "string",
          description: "RUM site ID to delete",
        },
      },
      required: ["site_id"],
    },
  },
  {
    name: "cloudflare_web_analytics_stats",
    description:
      "Query Web Analytics traffic stats for a zone. Returns page views, visits, and bandwidth grouped by time.",
    inputSchema: {
      type: "object" as const,
      properties: {
        zone_id: {
          type: "string",
          description:
            "Zone ID (32-char hex) or zone name (e.g., 'example.com')",
        },
        since: {
          type: "string",
          description:
            "ISO 8601 datetime to query from (default: 24 hours ago). E.g., '2026-03-15T00:00:00Z'",
        },
        limit: {
          type: "number",
          description:
            "Maximum number of data points to return (default: 100, max: 10000)",
        },
      },
      required: ["zone_id"],
    },
  },
];

// ---------------------------------------------------------------------------
// Tool handler
// ---------------------------------------------------------------------------

export async function handleWebAnalyticsTool(
  name: string,
  args: Record<string, unknown>,
  client: CloudflareClient,
): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  try {
    switch (name) {
      case "cloudflare_web_analytics_list": {
        const parsed = WebAnalyticsListSchema.parse(args);
        const accountId = requireAccountId(client);
        const params: Record<string, unknown> = {};
        if (parsed.order_by) params.order_by = parsed.order_by;
        const result = await client.get<unknown>(
          `/accounts/${accountId}/rum/site_info/list`,
          params,
        );
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      case "cloudflare_web_analytics_create": {
        const parsed = WebAnalyticsCreateSchema.parse(args);
        const accountId = requireAccountId(client);
        const body: Record<string, unknown> = {
          host: parsed.host,
          auto_install: parsed.auto_install ?? true,
        };
        if (parsed.zone_tag) body.zone_tag = parsed.zone_tag;
        const result = await client.post<unknown>(
          `/accounts/${accountId}/rum/site_info`,
          body,
        );
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      case "cloudflare_web_analytics_get": {
        const parsed = WebAnalyticsGetSchema.parse(args);
        const accountId = requireAccountId(client);
        const result = await client.get<unknown>(
          `/accounts/${accountId}/rum/site_info/${parsed.site_id}`,
        );
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      case "cloudflare_web_analytics_delete": {
        const parsed = WebAnalyticsDeleteSchema.parse(args);
        const accountId = requireAccountId(client);
        const result = await client.delete<unknown>(
          `/accounts/${accountId}/rum/site_info/${parsed.site_id}`,
        );
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      case "cloudflare_web_analytics_stats": {
        const parsed = WebAnalyticsStatsSchema.parse(args);
        const zoneId = await client.resolveZoneId(parsed.zone_id);
        const since =
          parsed.since ?? new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const limit = parsed.limit ?? 100;
        const result = await client.graphql<unknown>(WEB_ANALYTICS_STATS_QUERY, {
          zoneTag: zoneId,
          since,
          limit,
        });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      default:
        return {
          content: [{ type: "text", text: `Unknown Web Analytics tool: ${name}` }],
        };
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return {
      content: [{ type: "text", text: `Error executing ${name}: ${message}` }],
    };
  }
}
