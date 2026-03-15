import { z } from "zod";
import type { CloudflareClient } from "../client/cloudflare-client.js";
import { ScriptNameSchema, ZoneNameOrIdSchema } from "../utils/validation.js";

// ---------------------------------------------------------------------------
// Zod schemas for input validation
// ---------------------------------------------------------------------------

const WorkerListSchema = z.object({});

const WorkerDeploySchema = z.object({
  script_name: ScriptNameSchema,
  script_content: z.string().min(1, "Script content is required"),
  compatibility_date: z.string().min(1, "Compatibility date is required (e.g., 2026-03-15)"),
  compatibility_flags: z.array(z.string()).optional(),
  content_type: z.string().optional(),
});

const WorkerDeleteSchema = z.object({
  script_name: ScriptNameSchema,
});

const WorkerRouteListSchema = z.object({
  zone_id: ZoneNameOrIdSchema,
});

const WorkerRouteCreateSchema = z.object({
  zone_id: ZoneNameOrIdSchema,
  pattern: z.string().min(1, "Route pattern is required"),
  script: ScriptNameSchema,
});

// ---------------------------------------------------------------------------
// Account ID helper
// ---------------------------------------------------------------------------

function requireAccountId(client: CloudflareClient): string {
  const accountId = client.getAccountId();
  if (!accountId) {
    throw new Error(
      "CLOUDFLARE_ACCOUNT_ID environment variable is required for Workers operations",
    );
  }
  return accountId;
}

// ---------------------------------------------------------------------------
// Tool definitions (for ListTools)
// ---------------------------------------------------------------------------

export const workersToolDefinitions = [
  {
    name: "cloudflare_worker_list",
    description: "List all Workers scripts deployed in the account.",
    inputSchema: {
      type: "object" as const,
      properties: {},
    },
  },
  {
    name: "cloudflare_worker_deploy",
    description:
      "Deploy a Workers script. Creates or updates the named script with the provided source code.",
    inputSchema: {
      type: "object" as const,
      properties: {
        script_name: { type: "string", description: "Worker script name (lowercase alphanumeric and hyphens)" },
        script_content: { type: "string", description: "JavaScript or TypeScript source code for the Worker" },
        compatibility_date: { type: "string", description: "Compatibility date (e.g., '2026-03-15')" },
        compatibility_flags: {
          type: "array",
          items: { type: "string" },
          description: "Optional compatibility flags (e.g., ['nodejs_compat'])",
        },
        content_type: {
          type: "string",
          description: "Content type of the script (default: 'application/javascript+module')",
        },
      },
      required: ["script_name", "script_content", "compatibility_date"],
    },
  },
  {
    name: "cloudflare_worker_delete",
    description: "DESTRUCTIVE: Delete a Workers script by name. This action cannot be undone.",
    inputSchema: {
      type: "object" as const,
      properties: {
        script_name: { type: "string", description: "Worker script name to delete" },
      },
      required: ["script_name"],
    },
  },
  {
    name: "cloudflare_worker_route_list",
    description: "List all Workers routes for a zone. Routes map URL patterns to Worker scripts.",
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
    name: "cloudflare_worker_route_create",
    description: "Create a Workers route that maps a URL pattern to a Worker script for a zone.",
    inputSchema: {
      type: "object" as const,
      properties: {
        zone_id: {
          type: "string",
          description: "Zone ID (32-char hex) or zone name (e.g., 'example.com')",
        },
        pattern: { type: "string", description: "URL pattern to match (e.g., '*.example.com/api/*')" },
        script: { type: "string", description: "Worker script name to route to" },
      },
      required: ["zone_id", "pattern", "script"],
    },
  },
];

// ---------------------------------------------------------------------------
// Tool handler
// ---------------------------------------------------------------------------

export async function handleWorkersTool(
  name: string,
  args: Record<string, unknown>,
  client: CloudflareClient,
): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  try {
    switch (name) {
      case "cloudflare_worker_list": {
        WorkerListSchema.parse(args);
        const accountId = requireAccountId(client);
        const result = await client.get(
          `/accounts/${accountId}/workers/scripts`,
        );
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      case "cloudflare_worker_deploy": {
        const parsed = WorkerDeploySchema.parse(args);
        const accountId = requireAccountId(client);
        const formData = new FormData();
        const metadata = {
          main_module: "worker.js",
          compatibility_date: parsed.compatibility_date,
          compatibility_flags: parsed.compatibility_flags,
        };
        formData.append("metadata", JSON.stringify(metadata));
        formData.append("worker.js", parsed.script_content);
        const result = await client.putForm(
          `/accounts/${accountId}/workers/scripts/${parsed.script_name}`,
          formData,
        );
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      case "cloudflare_worker_delete": {
        const parsed = WorkerDeleteSchema.parse(args);
        const accountId = requireAccountId(client);
        const result = await client.delete(
          `/accounts/${accountId}/workers/scripts/${parsed.script_name}`,
        );
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      case "cloudflare_worker_route_list": {
        const parsed = WorkerRouteListSchema.parse(args);
        const zoneId = await client.resolveZoneId(parsed.zone_id);
        const result = await client.get(
          `/zones/${zoneId}/workers/routes`,
        );
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      case "cloudflare_worker_route_create": {
        const parsed = WorkerRouteCreateSchema.parse(args);
        const zoneId = await client.resolveZoneId(parsed.zone_id);
        const result = await client.post(
          `/zones/${zoneId}/workers/routes`,
          { pattern: parsed.pattern, script: parsed.script },
        );
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      default:
        return {
          content: [{ type: "text", text: `Unknown Workers tool: ${name}` }],
        };
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return {
      content: [{ type: "text", text: `Error executing ${name}: ${message}` }],
    };
  }
}
