import { z } from "zod";
import type { CloudflareClient } from "../client/cloudflare-client.js";
import { ZoneNameOrIdSchema } from "../utils/validation.js";

// ---------------------------------------------------------------------------
// Zod schemas for input validation
// ---------------------------------------------------------------------------

const CertificateListSchema = z.object({
  zone_id: ZoneNameOrIdSchema,
  status: z.enum(["active", "pending_validation", "pending_issuance", "pending_deployment", "expired", "deleted"]).optional(),
});

const CertificateGetSchema = z.object({
  zone_id: ZoneNameOrIdSchema,
  certificate_pack_id: z.string().min(1, "Certificate pack ID is required"),
});

const SslSettingGetSchema = z.object({
  zone_id: ZoneNameOrIdSchema,
});

const SslSettingSetSchema = z.object({
  zone_id: ZoneNameOrIdSchema,
  value: z.enum(["off", "flexible", "full", "strict"]),
});

const SslVerificationSchema = z.object({
  zone_id: ZoneNameOrIdSchema,
});

const TlsSettingGetSchema = z.object({
  zone_id: ZoneNameOrIdSchema,
});

const TlsSettingSetSchema = z.object({
  zone_id: ZoneNameOrIdSchema,
  value: z.enum(["1.0", "1.1", "1.2", "1.3"]),
});

// ---------------------------------------------------------------------------
// Tool definitions (for ListTools)
// ---------------------------------------------------------------------------

export const certificatesToolDefinitions = [
  {
    name: "cloudflare_certificate_list",
    description: "List SSL/TLS certificate packs for a zone. Shows all certificates including Universal SSL, Advanced, and custom uploads.",
    inputSchema: {
      type: "object" as const,
      properties: {
        zone_id: {
          type: "string",
          description: "Zone ID (32-char hex) or zone name (e.g., 'example.com')",
        },
        status: {
          type: "string",
          enum: ["active", "pending_validation", "pending_issuance", "pending_deployment", "expired", "deleted"],
          description: "Filter by certificate status (optional)",
        },
      },
      required: ["zone_id"],
    },
  },
  {
    name: "cloudflare_certificate_get",
    description: "Get details of a specific SSL/TLS certificate pack including hosts, status, validity, and issuer.",
    inputSchema: {
      type: "object" as const,
      properties: {
        zone_id: {
          type: "string",
          description: "Zone ID (32-char hex) or zone name (e.g., 'example.com')",
        },
        certificate_pack_id: {
          type: "string",
          description: "Certificate pack ID",
        },
      },
      required: ["zone_id", "certificate_pack_id"],
    },
  },
  {
    name: "cloudflare_ssl_setting_get",
    description: "Get the current SSL/TLS encryption mode for a zone (off, flexible, full, strict).",
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
    name: "cloudflare_ssl_setting_set",
    description: "DESTRUCTIVE: Set the SSL/TLS encryption mode for a zone. Changes affect live traffic immediately. 'strict' is recommended for production.",
    inputSchema: {
      type: "object" as const,
      properties: {
        zone_id: {
          type: "string",
          description: "Zone ID (32-char hex) or zone name (e.g., 'example.com')",
        },
        value: {
          type: "string",
          enum: ["off", "flexible", "full", "strict"],
          description: "SSL/TLS encryption mode: 'off' (no encryption), 'flexible' (browser-to-CF only), 'full' (end-to-end, self-signed OK), 'strict' (end-to-end, valid cert required)",
        },
      },
      required: ["zone_id", "value"],
    },
  },
  {
    name: "cloudflare_ssl_verification",
    description: "Get SSL/TLS verification status for a zone. Shows certificate validation progress, hostname coverage, and brand check status.",
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
    name: "cloudflare_tls_setting_get",
    description: "Get the minimum TLS version setting for a zone (1.0, 1.1, 1.2, or 1.3).",
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
    name: "cloudflare_tls_setting_set",
    description: "DESTRUCTIVE: Set the minimum TLS version for a zone. Changes affect live traffic immediately. Higher versions are more secure but may break older clients.",
    inputSchema: {
      type: "object" as const,
      properties: {
        zone_id: {
          type: "string",
          description: "Zone ID (32-char hex) or zone name (e.g., 'example.com')",
        },
        value: {
          type: "string",
          enum: ["1.0", "1.1", "1.2", "1.3"],
          description: "Minimum TLS version: '1.0' (legacy), '1.1', '1.2' (recommended minimum), '1.3' (most secure)",
        },
      },
      required: ["zone_id", "value"],
    },
  },
];

// ---------------------------------------------------------------------------
// Tool handler
// ---------------------------------------------------------------------------

export async function handleCertificatesTool(
  name: string,
  args: Record<string, unknown>,
  client: CloudflareClient,
): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  try {
    switch (name) {
      case "cloudflare_certificate_list": {
        const parsed = CertificateListSchema.parse(args);
        const zoneId = await client.resolveZoneId(parsed.zone_id);
        const params: Record<string, unknown> = {};
        if (parsed.status !== undefined) params["status"] = parsed.status;
        const result = await client.get(`/zones/${zoneId}/ssl/certificate_packs`, params);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      case "cloudflare_certificate_get": {
        const parsed = CertificateGetSchema.parse(args);
        const zoneId = await client.resolveZoneId(parsed.zone_id);
        const result = await client.get(`/zones/${zoneId}/ssl/certificate_packs/${parsed.certificate_pack_id}`);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      case "cloudflare_ssl_setting_get": {
        const parsed = SslSettingGetSchema.parse(args);
        const zoneId = await client.resolveZoneId(parsed.zone_id);
        const result = await client.get(`/zones/${zoneId}/settings/ssl`);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      case "cloudflare_ssl_setting_set": {
        const parsed = SslSettingSetSchema.parse(args);
        const zoneId = await client.resolveZoneId(parsed.zone_id);
        const result = await client.patch(`/zones/${zoneId}/settings/ssl`, {
          value: parsed.value,
        });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      case "cloudflare_ssl_verification": {
        const parsed = SslVerificationSchema.parse(args);
        const zoneId = await client.resolveZoneId(parsed.zone_id);
        const result = await client.get(`/zones/${zoneId}/ssl/verification`);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      case "cloudflare_tls_setting_get": {
        const parsed = TlsSettingGetSchema.parse(args);
        const zoneId = await client.resolveZoneId(parsed.zone_id);
        const result = await client.get(`/zones/${zoneId}/settings/min_tls_version`);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      case "cloudflare_tls_setting_set": {
        const parsed = TlsSettingSetSchema.parse(args);
        const zoneId = await client.resolveZoneId(parsed.zone_id);
        const result = await client.patch(`/zones/${zoneId}/settings/min_tls_version`, {
          value: parsed.value,
        });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      default:
        return {
          content: [{ type: "text", text: `Unknown certificates tool: ${name}` }],
        };
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return {
      content: [{ type: "text", text: `Error executing ${name}: ${message}` }],
    };
  }
}
