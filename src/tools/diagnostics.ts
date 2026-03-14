import { z } from "zod";
import type { CloudflareClient } from "../client/cloudflare-client.js";
import { ZoneNameOrIdSchema } from "../utils/validation.js";
import type { Zone, ZoneSetting } from "../client/types.js";

// ---------------------------------------------------------------------------
// Zod schemas for input validation
// ---------------------------------------------------------------------------

const ZoneHealthSchema = z.object({
  zone_id: ZoneNameOrIdSchema,
});

// ---------------------------------------------------------------------------
// Tool definitions (for ListTools)
// ---------------------------------------------------------------------------

export const diagnosticsToolDefinitions = [
  {
    name: "cloudflare_account_info",
    description:
      "Get Cloudflare account details (account name, ID, settings). No zone_id needed.",
    inputSchema: {
      type: "object" as const,
      properties: {},
    },
  },
  {
    name: "cloudflare_token_verify",
    description: "Validate the configured Cloudflare API token and check its permissions.",
    inputSchema: {
      type: "object" as const,
      properties: {},
    },
  },
  {
    name: "cloudflare_zone_health",
    description:
      "Check the health of a zone: combines zone status, DNSSEC configuration, and SSL mode into a single health report.",
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
    name: "cloudflare_rate_limit_status",
    description:
      "Check Cloudflare API rate limit consumption. Returns current limit, remaining requests, and reset time from response headers.",
    inputSchema: {
      type: "object" as const,
      properties: {},
    },
  },
];

// ---------------------------------------------------------------------------
// Tool handler
// ---------------------------------------------------------------------------

export async function handleDiagnosticsTool(
  name: string,
  args: Record<string, unknown>,
  client: CloudflareClient,
): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  try {
    switch (name) {
      case "cloudflare_account_info": {
        const result = await client.get("/accounts");
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      case "cloudflare_token_verify": {
        const result = await client.get("/user/tokens/verify");
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      case "cloudflare_zone_health": {
        const parsed = ZoneHealthSchema.parse(args);
        const zoneId = await client.resolveZoneId(parsed.zone_id);

        // Run all three checks in parallel
        const [zone, dnssec, sslSetting] = await Promise.all([
          client.get<Zone>(`/zones/${zoneId}`),
          client.get<Record<string, unknown>>(`/zones/${zoneId}/dnssec`).catch(() => null),
          client.get<ZoneSetting>(`/zones/${zoneId}/settings/ssl`).catch(() => null),
        ]);

        const health = {
          zone: {
            id: zone.id,
            name: zone.name,
            status: zone.status,
            paused: zone.paused,
            plan: zone.plan?.name,
            name_servers: zone.name_servers,
          },
          dnssec: dnssec ?? { error: "Could not retrieve DNSSEC status" },
          ssl: sslSetting ?? { error: "Could not retrieve SSL setting" },
          summary: {
            zone_active: zone.status === "active",
            zone_paused: zone.paused,
            dnssec_enabled:
              dnssec !== null &&
              typeof dnssec === "object" &&
              (dnssec as Record<string, unknown>)["status"] === "active",
            ssl_mode:
              sslSetting !== null
                ? (sslSetting as ZoneSetting).value
                : "unknown",
          },
        };

        return { content: [{ type: "text", text: JSON.stringify(health, null, 2) }] };
      }

      case "cloudflare_rate_limit_status": {
        const { result, headers } = await client.getWithHeaders<unknown>("/zones", {
          per_page: 1,
        });
        void result; // We only care about headers for rate limit info

        const limit = headers["x-ratelimit-limit"];
        const remaining = headers["x-ratelimit-remaining"];
        const reset = headers["x-ratelimit-reset"];

        const rateLimitInfo = {
          limit: limit !== undefined ? parseInt(limit, 10) : null,
          remaining: remaining !== undefined ? parseInt(remaining, 10) : null,
          reset_at:
            reset !== undefined
              ? new Date(parseInt(reset, 10) * 1000).toISOString()
              : null,
          reset_unix: reset !== undefined ? parseInt(reset, 10) : null,
          note: "Rate limit data is read from X-RateLimit-* response headers on the /zones endpoint.",
        };

        return {
          content: [{ type: "text", text: JSON.stringify(rateLimitInfo, null, 2) }],
        };
      }

      default:
        return {
          content: [{ type: "text", text: `Unknown diagnostics tool: ${name}` }],
        };
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return {
      content: [{ type: "text", text: `Error executing ${name}: ${message}` }],
    };
  }
}
