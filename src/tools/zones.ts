import { z } from "zod";
import type { CloudflareClient } from "../client/cloudflare-client.js";
import { ZoneNameOrIdSchema, CoercedBooleanSchema } from "../utils/validation.js";

// ---------------------------------------------------------------------------
// Zod schemas for input validation
// ---------------------------------------------------------------------------

const ZoneListSchema = z.object({
  page: z.number().int().min(1).optional(),
  per_page: z.number().int().min(1).max(50).optional(),
  status: z.enum(["active", "pending", "initializing", "moved", "deleted", "deactivated"]).optional(),
  name: z.string().optional(),
});

const ZoneGetSchema = z.object({
  zone_id: ZoneNameOrIdSchema,
});

const ZoneSettingGetSchema = z.object({
  zone_id: ZoneNameOrIdSchema,
  setting_name: z.string().min(1, "Setting name is required"),
});

const ZoneSettingUpdateSchema = z.object({
  zone_id: ZoneNameOrIdSchema,
  setting_name: z.string().min(1, "Setting name is required"),
  value: z.union([z.string(), z.number(), CoercedBooleanSchema, z.record(z.unknown()), z.array(z.unknown())]),
});

const CachePurgeSchema = z.object({
  zone_id: ZoneNameOrIdSchema,
  files: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  prefixes: z.array(z.string()).optional(),
  purge_everything: CoercedBooleanSchema.optional(),
});

// ---------------------------------------------------------------------------
// Tool definitions (for ListTools)
// ---------------------------------------------------------------------------

export const zonesToolDefinitions = [
  {
    name: "cloudflare_zone_list",
    description: "List all Cloudflare zones with pagination. Optionally filter by status or name.",
    inputSchema: {
      type: "object" as const,
      properties: {
        page: { type: "number", description: "Page number (default: 1)" },
        per_page: { type: "number", description: "Results per page, max 50 (default: 20)" },
        status: {
          type: "string",
          enum: ["active", "pending", "initializing", "moved", "deleted", "deactivated"],
          description: "Filter by zone status",
        },
        name: { type: "string", description: "Filter by zone name (exact match)" },
      },
    },
  },
  {
    name: "cloudflare_zone_get",
    description: "Get zone details including status, nameservers, and plan.",
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
    name: "cloudflare_zone_setting_get",
    description: "Get a specific zone setting by name (e.g., 'ssl', 'security_level', 'minify').",
    inputSchema: {
      type: "object" as const,
      properties: {
        zone_id: {
          type: "string",
          description: "Zone ID (32-char hex) or zone name (e.g., 'example.com')",
        },
        setting_name: {
          type: "string",
          description: "Setting name (e.g., 'ssl', 'security_level', 'always_use_https', 'minify')",
        },
      },
      required: ["zone_id", "setting_name"],
    },
  },
  {
    name: "cloudflare_zone_setting_update",
    description: "Update a specific zone setting (e.g., change SSL mode, security level).",
    inputSchema: {
      type: "object" as const,
      properties: {
        zone_id: {
          type: "string",
          description: "Zone ID (32-char hex) or zone name (e.g., 'example.com')",
        },
        setting_name: {
          type: "string",
          description: "Setting name (e.g., 'ssl', 'security_level', 'always_use_https')",
        },
        value: {
          description: "New value for the setting (type depends on the specific setting)",
        },
      },
      required: ["zone_id", "setting_name", "value"],
    },
  },
  {
    name: "cloudflare_cache_purge",
    description:
      "Purge cached files from Cloudflare's edge. Purge specific URLs (files), cache tags, URL prefixes, or everything. " +
      "CAUTION: purge_everything causes a temporary origin load spike as the entire cache is rebuilt.",
    inputSchema: {
      type: "object" as const,
      properties: {
        zone_id: {
          type: "string",
          description: "Zone ID (32-char hex) or zone name (e.g., 'example.com')",
        },
        files: {
          type: "array",
          items: { type: "string" },
          description: "Array of URLs to purge (e.g., ['https://example.com/styles.css'])",
        },
        tags: {
          type: "array",
          items: { type: "string" },
          description: "Array of cache tags to purge (Enterprise only)",
        },
        prefixes: {
          type: "array",
          items: { type: "string" },
          description: "Array of URL prefixes to purge (Enterprise only, e.g., ['example.com/assets/'])",
        },
        purge_everything: {
          type: "boolean",
          description: "Set to true to purge ALL cached content for the zone. Use with caution.",
        },
      },
      required: ["zone_id"],
    },
  },
];

// ---------------------------------------------------------------------------
// Tool handler
// ---------------------------------------------------------------------------

export async function handleZonesTool(
  name: string,
  args: Record<string, unknown>,
  client: CloudflareClient,
): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  try {
    switch (name) {
      case "cloudflare_zone_list": {
        const parsed = ZoneListSchema.parse(args);
        const params: Record<string, unknown> = {};
        if (parsed.page !== undefined) params["page"] = parsed.page;
        if (parsed.per_page !== undefined) params["per_page"] = parsed.per_page;
        if (parsed.status !== undefined) params["status"] = parsed.status;
        if (parsed.name !== undefined) params["name"] = parsed.name;
        const result = await client.get("/zones", params);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      case "cloudflare_zone_get": {
        const parsed = ZoneGetSchema.parse(args);
        const zoneId = await client.resolveZoneId(parsed.zone_id);
        const result = await client.get(`/zones/${zoneId}`);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      case "cloudflare_zone_setting_get": {
        const parsed = ZoneSettingGetSchema.parse(args);
        const zoneId = await client.resolveZoneId(parsed.zone_id);
        const result = await client.get(`/zones/${zoneId}/settings/${parsed.setting_name}`);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      case "cloudflare_zone_setting_update": {
        const parsed = ZoneSettingUpdateSchema.parse(args);
        const zoneId = await client.resolveZoneId(parsed.zone_id);
        const result = await client.patch(`/zones/${zoneId}/settings/${parsed.setting_name}`, {
          value: parsed.value,
        });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      case "cloudflare_cache_purge": {
        const parsed = CachePurgeSchema.parse(args);
        const zoneId = await client.resolveZoneId(parsed.zone_id);
        const body: Record<string, unknown> = {};
        if (parsed.purge_everything) {
          body["purge_everything"] = true;
        } else if (parsed.files?.length) {
          body["files"] = parsed.files;
        } else if (parsed.tags?.length) {
          body["tags"] = parsed.tags;
        } else if (parsed.prefixes?.length) {
          body["prefixes"] = parsed.prefixes;
        } else {
          return {
            content: [{ type: "text", text: "Error: Provide files, tags, prefixes, or purge_everything=true" }],
          };
        }
        const result = await client.post(`/zones/${zoneId}/purge_cache`, body);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      default:
        return {
          content: [{ type: "text", text: `Unknown zones tool: ${name}` }],
        };
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return {
      content: [{ type: "text", text: `Error executing ${name}: ${message}` }],
    };
  }
}
