import { z } from "zod";
import type { CloudflareClient } from "../client/cloudflare-client.js";

// ---------------------------------------------------------------------------
// Zod schemas for input validation
// ---------------------------------------------------------------------------

const ZtListAppsSchema = z.object({});

const ZtGetAppSchema = z.object({
  app_id: z.string().min(1, "App ID is required"),
});

const ZtListPoliciesSchema = z.object({
  app_id: z.string().min(1, "App ID is required"),
});

const ZtDecisionSchema = z.enum(["allow", "deny", "non_identity", "bypass"]);

const ZtCreatePolicySchema = z.object({
  app_id: z.string().min(1, "App ID is required"),
  name: z.string().min(1, "Policy name is required"),
  decision: ZtDecisionSchema,
  include: z
    .array(z.record(z.unknown()))
    .min(1, "At least one include rule is required"),
});

const ZtListIdpsSchema = z.object({});

const ZtGatewayStatusSchema = z.object({});

// ---------------------------------------------------------------------------
// Account ID helper
// ---------------------------------------------------------------------------

function requireAccountId(client: CloudflareClient): string {
  const accountId = client.getAccountId();
  if (!accountId) {
    throw new Error(
      "CLOUDFLARE_ACCOUNT_ID environment variable is required for Zero Trust operations",
    );
  }
  return accountId;
}

// ---------------------------------------------------------------------------
// Tool definitions (for ListTools)
// ---------------------------------------------------------------------------

export const zerotrustToolDefinitions = [
  {
    name: "cloudflare_zt_list_apps",
    description: "List all Zero Trust Access applications for the account.",
    inputSchema: {
      type: "object" as const,
      properties: {},
    },
  },
  {
    name: "cloudflare_zt_get_app",
    description: "Get details for a specific Zero Trust Access application by its ID.",
    inputSchema: {
      type: "object" as const,
      properties: {
        app_id: { type: "string", description: "Access application ID (UUID)" },
      },
      required: ["app_id"],
    },
  },
  {
    name: "cloudflare_zt_list_policies",
    description: "List all access policies attached to a Zero Trust Access application.",
    inputSchema: {
      type: "object" as const,
      properties: {
        app_id: { type: "string", description: "Access application ID (UUID)" },
      },
      required: ["app_id"],
    },
  },
  {
    name: "cloudflare_zt_create_policy",
    description:
      "Create an access policy for a Zero Trust Access application. Policies define who can access the application.",
    inputSchema: {
      type: "object" as const,
      properties: {
        app_id: { type: "string", description: "Access application ID (UUID)" },
        name: { type: "string", description: "Policy name" },
        decision: {
          type: "string",
          enum: ["allow", "deny", "non_identity", "bypass"],
          description:
            "Policy decision: allow (requires authentication), deny (blocks access), non_identity (bypass IdP), bypass (allow everyone)",
        },
        include: {
          type: "array",
          description:
            "Array of include rules (at least one required). Each rule is an object like { email: { email: 'user@example.com' } } or { email_domain: { domain: 'example.com' } }",
          items: { type: "object" },
        },
      },
      required: ["app_id", "name", "decision", "include"],
    },
  },
  {
    name: "cloudflare_zt_list_idps",
    description:
      "List all identity providers (IdPs) configured for Zero Trust Access on the account.",
    inputSchema: {
      type: "object" as const,
      properties: {},
    },
  },
  {
    name: "cloudflare_zt_gateway_status",
    description:
      "Get the Zero Trust Gateway (DNS/HTTP filtering) configuration status for the account.",
    inputSchema: {
      type: "object" as const,
      properties: {},
    },
  },
];

// ---------------------------------------------------------------------------
// Tool handler
// ---------------------------------------------------------------------------

export async function handleZerotrustTool(
  name: string,
  args: Record<string, unknown>,
  client: CloudflareClient,
): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  try {
    switch (name) {
      case "cloudflare_zt_list_apps": {
        ZtListAppsSchema.parse(args);
        const accountId = requireAccountId(client);
        const result = await client.get(`/accounts/${accountId}/access/apps`);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      case "cloudflare_zt_get_app": {
        const parsed = ZtGetAppSchema.parse(args);
        const accountId = requireAccountId(client);
        const result = await client.get(
          `/accounts/${accountId}/access/apps/${parsed.app_id}`,
        );
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      case "cloudflare_zt_list_policies": {
        const parsed = ZtListPoliciesSchema.parse(args);
        const accountId = requireAccountId(client);
        const result = await client.get(
          `/accounts/${accountId}/access/apps/${parsed.app_id}/policies`,
        );
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      case "cloudflare_zt_create_policy": {
        const parsed = ZtCreatePolicySchema.parse(args);
        const accountId = requireAccountId(client);
        const result = await client.post(
          `/accounts/${accountId}/access/apps/${parsed.app_id}/policies`,
          {
            name: parsed.name,
            decision: parsed.decision,
            include: parsed.include,
          },
        );
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      case "cloudflare_zt_list_idps": {
        ZtListIdpsSchema.parse(args);
        const accountId = requireAccountId(client);
        const result = await client.get(`/accounts/${accountId}/access/identity_providers`);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      case "cloudflare_zt_gateway_status": {
        ZtGatewayStatusSchema.parse(args);
        const accountId = requireAccountId(client);
        const result = await client.get(`/accounts/${accountId}/gateway/configuration`);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      default:
        return {
          content: [{ type: "text", text: `Unknown Zero Trust tool: ${name}` }],
        };
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return {
      content: [{ type: "text", text: `Error executing ${name}: ${message}` }],
    };
  }
}
