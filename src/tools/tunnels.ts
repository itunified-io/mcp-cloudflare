import { z } from "zod";
import { randomBytes } from "crypto";
import type { CloudflareClient } from "../client/cloudflare-client.js";
import { TunnelIdSchema } from "../utils/validation.js";

// ---------------------------------------------------------------------------
// Zod schemas for input validation
// ---------------------------------------------------------------------------

const TunnelListSchema = z.object({
  page: z.number().int().min(1).optional(),
  per_page: z.number().int().min(1).max(100).optional(),
  name: z.string().optional(),
  is_deleted: z.boolean().optional(),
});

const TunnelGetSchema = z.object({
  tunnel_id: TunnelIdSchema,
});

const TunnelCreateSchema = z.object({
  name: z.string().min(1, "Tunnel name is required"),
});

const TunnelDeleteSchema = z.object({
  tunnel_id: TunnelIdSchema,
});

const TunnelConfigGetSchema = z.object({
  tunnel_id: TunnelIdSchema,
});

const TunnelConfigUpdateSchema = z.object({
  tunnel_id: TunnelIdSchema,
  config: z.object({
    ingress: z
      .array(
        z.object({
          hostname: z.string().optional(),
          path: z.string().optional(),
          service: z.string().min(1, "Ingress rule service is required"),
          origin_request: z.record(z.unknown()).optional(),
        }),
      )
      .min(1, "At least one ingress rule is required"),
  }),
});

// ---------------------------------------------------------------------------
// Account ID helper
// ---------------------------------------------------------------------------

function requireAccountId(client: CloudflareClient): string {
  const accountId = client.getAccountId();
  if (!accountId) {
    throw new Error(
      "CLOUDFLARE_ACCOUNT_ID environment variable is required for tunnel operations",
    );
  }
  return accountId;
}

// ---------------------------------------------------------------------------
// Tool definitions (for ListTools)
// ---------------------------------------------------------------------------

export const tunnelsToolDefinitions = [
  {
    name: "cloudflare_tunnel_list",
    description:
      "List Cloudflare Tunnels for the account. Optionally filter by name or deleted status.",
    inputSchema: {
      type: "object" as const,
      properties: {
        page: { type: "number", description: "Page number (default: 1)" },
        per_page: { type: "number", description: "Results per page, max 100 (default: 25)" },
        name: { type: "string", description: "Filter by tunnel name (partial match)" },
        is_deleted: {
          type: "boolean",
          description: "Filter by deleted status (false = active, true = deleted)",
        },
      },
    },
  },
  {
    name: "cloudflare_tunnel_get",
    description: "Get details for a specific Cloudflare Tunnel by its ID.",
    inputSchema: {
      type: "object" as const,
      properties: {
        tunnel_id: { type: "string", description: "Tunnel UUID" },
      },
      required: ["tunnel_id"],
    },
  },
  {
    name: "cloudflare_tunnel_create",
    description:
      "Create a new Cloudflare Tunnel. A secure 32-byte tunnel secret is automatically generated.",
    inputSchema: {
      type: "object" as const,
      properties: {
        name: { type: "string", description: "Name for the tunnel" },
      },
      required: ["name"],
    },
  },
  {
    name: "cloudflare_tunnel_delete",
    description: "Delete a Cloudflare Tunnel by its ID. This action cannot be undone.",
    inputSchema: {
      type: "object" as const,
      properties: {
        tunnel_id: { type: "string", description: "Tunnel UUID to delete" },
      },
      required: ["tunnel_id"],
    },
  },
  {
    name: "cloudflare_tunnel_config_get",
    description: "Get the ingress configuration for a Cloudflare Tunnel.",
    inputSchema: {
      type: "object" as const,
      properties: {
        tunnel_id: { type: "string", description: "Tunnel UUID" },
      },
      required: ["tunnel_id"],
    },
  },
  {
    name: "cloudflare_tunnel_config_update",
    description: "Update the ingress configuration for a Cloudflare Tunnel.",
    inputSchema: {
      type: "object" as const,
      properties: {
        tunnel_id: { type: "string", description: "Tunnel UUID" },
        config: {
          type: "object",
          description: "Tunnel ingress configuration object",
          properties: {
            ingress: {
              type: "array",
              description:
                "Array of ingress rules. The last rule must be a catch-all with no hostname (service only).",
              items: {
                type: "object",
                properties: {
                  hostname: {
                    type: "string",
                    description: "Hostname to match (omit for catch-all rule)",
                  },
                  path: { type: "string", description: "URL path prefix to match (optional)" },
                  service: {
                    type: "string",
                    description: "Backend service URL (e.g., 'http://localhost:8080')",
                  },
                  origin_request: {
                    type: "object",
                    description: "Per-rule origin request settings (optional)",
                  },
                },
                required: ["service"],
              },
            },
          },
          required: ["ingress"],
        },
      },
      required: ["tunnel_id", "config"],
    },
  },
];

// ---------------------------------------------------------------------------
// Tool handler
// ---------------------------------------------------------------------------

export async function handleTunnelsTool(
  name: string,
  args: Record<string, unknown>,
  client: CloudflareClient,
): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  try {
    switch (name) {
      case "cloudflare_tunnel_list": {
        const parsed = TunnelListSchema.parse(args);
        const accountId = requireAccountId(client);
        const params: Record<string, unknown> = {};
        if (parsed.page !== undefined) params["page"] = parsed.page;
        if (parsed.per_page !== undefined) params["per_page"] = parsed.per_page;
        if (parsed.name !== undefined) params["name"] = parsed.name;
        if (parsed.is_deleted !== undefined) params["is_deleted"] = parsed.is_deleted;
        const result = await client.get(`/accounts/${accountId}/cfd_tunnel`, params);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      case "cloudflare_tunnel_get": {
        const parsed = TunnelGetSchema.parse(args);
        const accountId = requireAccountId(client);
        const result = await client.get(
          `/accounts/${accountId}/cfd_tunnel/${parsed.tunnel_id}`,
        );
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      case "cloudflare_tunnel_create": {
        const parsed = TunnelCreateSchema.parse(args);
        const accountId = requireAccountId(client);
        const tunnelSecret = randomBytes(32).toString("base64");
        const result = await client.post(`/accounts/${accountId}/cfd_tunnel`, {
          name: parsed.name,
          tunnel_secret: tunnelSecret,
        });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      case "cloudflare_tunnel_delete": {
        const parsed = TunnelDeleteSchema.parse(args);
        const accountId = requireAccountId(client);
        const result = await client.delete(
          `/accounts/${accountId}/cfd_tunnel/${parsed.tunnel_id}`,
        );
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      case "cloudflare_tunnel_config_get": {
        const parsed = TunnelConfigGetSchema.parse(args);
        const accountId = requireAccountId(client);
        const result = await client.get(
          `/accounts/${accountId}/cfd_tunnel/${parsed.tunnel_id}/configurations`,
        );
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      case "cloudflare_tunnel_config_update": {
        const parsed = TunnelConfigUpdateSchema.parse(args);
        const accountId = requireAccountId(client);
        const result = await client.put(
          `/accounts/${accountId}/cfd_tunnel/${parsed.tunnel_id}/configurations`,
          { config: parsed.config },
        );
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      default:
        return {
          content: [{ type: "text", text: `Unknown tunnels tool: ${name}` }],
        };
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return {
      content: [{ type: "text", text: `Error executing ${name}: ${message}` }],
    };
  }
}
