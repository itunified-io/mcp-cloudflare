import { z } from "zod";
import type { CloudflareClient } from "../client/cloudflare-client.js";
import type { DnsRecord } from "../client/types.js";
import { ZoneNameOrIdSchema, RecordIdSchema, DnsRecordTypeSchema, TtlSchema, CoercedBooleanSchema } from "../utils/validation.js";

// ---------------------------------------------------------------------------
// Zod schemas for input validation
// ---------------------------------------------------------------------------

const DnsListSchema = z.object({
  zone_id: ZoneNameOrIdSchema,
  type: DnsRecordTypeSchema.optional(),
  name: z.string().optional(),
  content: z.string().optional(),
  proxied: CoercedBooleanSchema.optional(),
  page: z.number().int().min(1).optional(),
  per_page: z.number().int().min(1).max(5000).optional(),
});

const DnsGetSchema = z.object({
  zone_id: ZoneNameOrIdSchema,
  record_id: RecordIdSchema,
});

const DnsCreateSchema = z.object({
  zone_id: ZoneNameOrIdSchema,
  type: DnsRecordTypeSchema,
  name: z.string().min(1, "Record name is required"),
  content: z.string().min(1, "Record content is required"),
  proxied: CoercedBooleanSchema.optional(),
  ttl: TtlSchema.optional(),
  priority: z.number().int().min(0).max(65535).optional(),
});

const DnsUpdateSchema = z.object({
  zone_id: ZoneNameOrIdSchema,
  record_id: RecordIdSchema,
  type: DnsRecordTypeSchema,
  name: z.string().min(1, "Record name is required"),
  content: z.string().min(1, "Record content is required"),
  proxied: CoercedBooleanSchema.optional(),
  ttl: TtlSchema.optional(),
  priority: z.number().int().min(0).max(65535).optional(),
});

const DnsDeleteSchema = z.object({
  zone_id: ZoneNameOrIdSchema,
  record_id: RecordIdSchema,
});

const DnsSearchSchema = z.object({
  zone_id: ZoneNameOrIdSchema,
  name: z.string().min(1, "Search pattern is required"),
  type: DnsRecordTypeSchema.optional(),
});

const DnsExportSchema = z.object({
  zone_id: ZoneNameOrIdSchema,
});

const DnsImportSchema = z.object({
  zone_id: ZoneNameOrIdSchema,
  file_content: z.string().min(1, "BIND zone file content is required"),
});

const DnssecStatusSchema = z.object({
  zone_id: ZoneNameOrIdSchema,
});

const DnssecEnableSchema = z.object({
  zone_id: ZoneNameOrIdSchema,
});

const DnssecDisableSchema = z.object({
  zone_id: ZoneNameOrIdSchema,
});

// ---------------------------------------------------------------------------
// Tool definitions (for ListTools)
// ---------------------------------------------------------------------------

export const dnsToolDefinitions = [
  {
    name: "cloudflare_dns_list",
    description:
      "List DNS records for a zone. Optionally filter by type, name, content, or proxied status.",
    inputSchema: {
      type: "object" as const,
      properties: {
        zone_id: {
          type: "string",
          description: "Zone ID (32-char hex) or zone name (e.g., 'example.com')",
        },
        type: {
          type: "string",
          enum: ["A", "AAAA", "CNAME", "MX", "TXT", "SRV", "CAA", "NS"],
          description: "Filter by record type",
        },
        name: { type: "string", description: "Filter by record name (exact match)" },
        content: { type: "string", description: "Filter by record content" },
        proxied: { type: "boolean", description: "Filter by proxied status" },
        page: { type: "number", description: "Page number (default: 1)" },
        per_page: { type: "number", description: "Results per page, max 5000 (default: 100)" },
      },
      required: ["zone_id"],
    },
  },
  {
    name: "cloudflare_dns_get",
    description: "Get a single DNS record by its record ID.",
    inputSchema: {
      type: "object" as const,
      properties: {
        zone_id: {
          type: "string",
          description: "Zone ID (32-char hex) or zone name (e.g., 'example.com')",
        },
        record_id: {
          type: "string",
          description: "DNS record ID (32-char hex)",
        },
      },
      required: ["zone_id", "record_id"],
    },
  },
  {
    name: "cloudflare_dns_create",
    description: "Create a new DNS record in a zone.",
    inputSchema: {
      type: "object" as const,
      properties: {
        zone_id: {
          type: "string",
          description: "Zone ID (32-char hex) or zone name (e.g., 'example.com')",
        },
        type: {
          type: "string",
          enum: ["A", "AAAA", "CNAME", "MX", "TXT", "SRV", "CAA", "NS"],
          description: "Record type",
        },
        name: { type: "string", description: "Record name (e.g., 'www', '@', 'mail.example.com')" },
        content: {
          type: "string",
          description: "Record content (IP for A/AAAA, hostname for CNAME/MX, text for TXT)",
        },
        proxied: {
          type: "boolean",
          description: "Whether to proxy traffic through Cloudflare (default: false)",
        },
        ttl: {
          type: "number",
          description: "TTL in seconds — 1 = auto (Cloudflare-managed), 60–86400 otherwise",
        },
        priority: {
          type: "number",
          description: "Priority (required for MX and SRV records, 0–65535)",
        },
      },
      required: ["zone_id", "type", "name", "content"],
    },
  },
  {
    name: "cloudflare_dns_update",
    description: "Update an existing DNS record (full replacement via PUT).",
    inputSchema: {
      type: "object" as const,
      properties: {
        zone_id: {
          type: "string",
          description: "Zone ID (32-char hex) or zone name (e.g., 'example.com')",
        },
        record_id: {
          type: "string",
          description: "DNS record ID (32-char hex)",
        },
        type: {
          type: "string",
          enum: ["A", "AAAA", "CNAME", "MX", "TXT", "SRV", "CAA", "NS"],
          description: "Record type",
        },
        name: { type: "string", description: "Record name" },
        content: { type: "string", description: "Record content" },
        proxied: { type: "boolean", description: "Whether to proxy through Cloudflare" },
        ttl: {
          type: "number",
          description: "TTL in seconds — 1 = auto, 60–86400 otherwise",
        },
        priority: {
          type: "number",
          description: "Priority for MX/SRV records (0–65535)",
        },
      },
      required: ["zone_id", "record_id", "type", "name", "content"],
    },
  },
  {
    name: "cloudflare_dns_delete",
    description: "Delete a DNS record from a zone.",
    inputSchema: {
      type: "object" as const,
      properties: {
        zone_id: {
          type: "string",
          description: "Zone ID (32-char hex) or zone name (e.g., 'example.com')",
        },
        record_id: {
          type: "string",
          description: "DNS record ID (32-char hex)",
        },
      },
      required: ["zone_id", "record_id"],
    },
  },
  {
    name: "cloudflare_dns_search",
    description:
      "Search DNS records by name pattern. Returns all records whose name contains the given string.",
    inputSchema: {
      type: "object" as const,
      properties: {
        zone_id: {
          type: "string",
          description: "Zone ID (32-char hex) or zone name (e.g., 'example.com')",
        },
        name: {
          type: "string",
          description: "Name pattern to search for (partial match supported)",
        },
        type: {
          type: "string",
          enum: ["A", "AAAA", "CNAME", "MX", "TXT", "SRV", "CAA", "NS"],
          description: "Filter by record type (optional)",
        },
      },
      required: ["zone_id", "name"],
    },
  },
  {
    name: "cloudflare_dns_export",
    description:
      "Export all DNS records for a zone in BIND zone file format. Returns raw text.",
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
    name: "cloudflare_dns_import",
    description:
      "Import DNS records from a BIND zone file. Sends the file content as multipart/form-data.",
    inputSchema: {
      type: "object" as const,
      properties: {
        zone_id: {
          type: "string",
          description: "Zone ID (32-char hex) or zone name (e.g., 'example.com')",
        },
        file_content: {
          type: "string",
          description: "BIND zone file content to import",
        },
      },
      required: ["zone_id", "file_content"],
    },
  },
  {
    name: "cloudflare_dnssec_status",
    description: "Get the DNSSEC status for a zone.",
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
    name: "cloudflare_dnssec_enable",
    description: "DESTRUCTIVE: Enable DNSSEC for a zone. After enabling, you must add the DS record at your domain registrar for DNSSEC to become fully active.",
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
    name: "cloudflare_dnssec_disable",
    description: "DESTRUCTIVE: Disable DNSSEC for a zone. Also remove the DS record at your domain registrar to avoid DNS resolution failures.",
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
// Tool handler
// ---------------------------------------------------------------------------

export async function handleDnsTool(
  name: string,
  args: Record<string, unknown>,
  client: CloudflareClient,
): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  try {
    switch (name) {
      case "cloudflare_dns_list": {
        const parsed = DnsListSchema.parse(args);
        const zoneId = await client.resolveZoneId(parsed.zone_id);
        const params: Record<string, unknown> = {};
        if (parsed.type !== undefined) params["type"] = parsed.type;
        if (parsed.name !== undefined) params["name"] = parsed.name;
        if (parsed.content !== undefined) params["content"] = parsed.content;
        if (parsed.proxied !== undefined) params["proxied"] = parsed.proxied;
        if (parsed.page !== undefined) params["page"] = parsed.page;
        if (parsed.per_page !== undefined) params["per_page"] = parsed.per_page;
        const result = await client.get(`/zones/${zoneId}/dns_records`, params);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      case "cloudflare_dns_get": {
        const parsed = DnsGetSchema.parse(args);
        const zoneId = await client.resolveZoneId(parsed.zone_id);
        const result = await client.get(`/zones/${zoneId}/dns_records/${parsed.record_id}`);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      case "cloudflare_dns_create": {
        const parsed = DnsCreateSchema.parse(args);
        const zoneId = await client.resolveZoneId(parsed.zone_id);
        const body: Record<string, unknown> = {
          type: parsed.type,
          name: parsed.name,
          content: parsed.content,
        };
        if (parsed.proxied !== undefined) body["proxied"] = parsed.proxied;
        if (parsed.ttl !== undefined) body["ttl"] = parsed.ttl;
        if (parsed.priority !== undefined) body["priority"] = parsed.priority;
        const result = await client.post(`/zones/${zoneId}/dns_records`, body);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      case "cloudflare_dns_update": {
        const parsed = DnsUpdateSchema.parse(args);
        const zoneId = await client.resolveZoneId(parsed.zone_id);
        const body: Record<string, unknown> = {
          type: parsed.type,
          name: parsed.name,
          content: parsed.content,
        };
        if (parsed.proxied !== undefined) body["proxied"] = parsed.proxied;
        if (parsed.ttl !== undefined) body["ttl"] = parsed.ttl;
        if (parsed.priority !== undefined) body["priority"] = parsed.priority;
        const result = await client.put(
          `/zones/${zoneId}/dns_records/${parsed.record_id}`,
          body,
        );
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      case "cloudflare_dns_delete": {
        const parsed = DnsDeleteSchema.parse(args);
        const zoneId = await client.resolveZoneId(parsed.zone_id);
        const result = await client.delete(`/zones/${zoneId}/dns_records/${parsed.record_id}`);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      case "cloudflare_dns_search": {
        const parsed = DnsSearchSchema.parse(args);
        const zoneId = await client.resolveZoneId(parsed.zone_id);
        // Fetch all records and filter client-side for partial name match,
        // since the CF API name param requires exact FQDN match.
        const params: Record<string, unknown> = { per_page: 5000 };
        if (parsed.type !== undefined) params["type"] = parsed.type;
        const allRecords = await client.get<DnsRecord[]>(`/zones/${zoneId}/dns_records`, params);
        const searchTerm = parsed.name.toLowerCase();
        const filtered = (Array.isArray(allRecords) ? allRecords : []).filter(
          (r: DnsRecord) => r.name.toLowerCase().includes(searchTerm),
        );
        return { content: [{ type: "text", text: JSON.stringify(filtered, null, 2) }] };
      }

      case "cloudflare_dns_export": {
        const parsed = DnsExportSchema.parse(args);
        const zoneId = await client.resolveZoneId(parsed.zone_id);
        const bindText = await client.getRaw(`/zones/${zoneId}/dns_records/export`);
        return { content: [{ type: "text", text: bindText }] };
      }

      case "cloudflare_dns_import": {
        const parsed = DnsImportSchema.parse(args);
        const zoneId = await client.resolveZoneId(parsed.zone_id);
        const formData = new FormData();
        formData.append(
          "file",
          new Blob([parsed.file_content], { type: "text/plain" }),
          "zone.txt",
        );
        const result = await client.postForm(`/zones/${zoneId}/dns_records/import`, formData);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      case "cloudflare_dnssec_status": {
        const parsed = DnssecStatusSchema.parse(args);
        const zoneId = await client.resolveZoneId(parsed.zone_id);
        const result = await client.get(`/zones/${zoneId}/dnssec`);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      case "cloudflare_dnssec_enable": {
        const parsed = DnssecEnableSchema.parse(args);
        const zoneId = await client.resolveZoneId(parsed.zone_id);
        const result = await client.post(`/zones/${zoneId}/dnssec`, {});
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      case "cloudflare_dnssec_disable": {
        const parsed = DnssecDisableSchema.parse(args);
        const zoneId = await client.resolveZoneId(parsed.zone_id);
        const result = await client.patch(`/zones/${zoneId}/dnssec`, { status: "disabled" });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      default:
        return {
          content: [{ type: "text", text: `Unknown DNS tool: ${name}` }],
        };
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return {
      content: [{ type: "text", text: `Error executing ${name}: ${message}` }],
    };
  }
}
