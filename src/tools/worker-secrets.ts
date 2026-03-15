import { z } from "zod";
import type { CloudflareClient } from "../client/cloudflare-client.js";
import { ScriptNameSchema, SecretNameSchema } from "../utils/validation.js";

// ---------------------------------------------------------------------------
// Zod schemas for input validation
// ---------------------------------------------------------------------------

const WorkerSecretListSchema = z.object({
  script_name: ScriptNameSchema,
});

const WorkerSecretSetSchema = z.object({
  script_name: ScriptNameSchema,
  secret_name: SecretNameSchema,
  secret_value: z.string().min(1, "Secret value is required"),
});

const WorkerSecretDeleteSchema = z.object({
  script_name: ScriptNameSchema,
  secret_name: SecretNameSchema,
});

// ---------------------------------------------------------------------------
// Account ID helper
// ---------------------------------------------------------------------------

function requireAccountId(client: CloudflareClient): string {
  const accountId = client.getAccountId();
  if (!accountId) {
    throw new Error(
      "CLOUDFLARE_ACCOUNT_ID environment variable is required for Worker Secrets operations",
    );
  }
  return accountId;
}

// ---------------------------------------------------------------------------
// Tool definitions (for ListTools)
// ---------------------------------------------------------------------------

export const workerSecretsToolDefinitions = [
  {
    name: "cloudflare_worker_secret_list",
    description: "List all secrets bound to a Workers script. Only secret names are returned, not values.",
    inputSchema: {
      type: "object" as const,
      properties: {
        script_name: { type: "string", description: "Worker script name (lowercase alphanumeric and hyphens)" },
      },
      required: ["script_name"],
    },
  },
  {
    name: "cloudflare_worker_secret_set",
    description:
      "Set a secret for a Workers script. Creates or updates the named secret. The secret value is NOT echoed in the response for security.",
    inputSchema: {
      type: "object" as const,
      properties: {
        script_name: { type: "string", description: "Worker script name (lowercase alphanumeric and hyphens)" },
        secret_name: { type: "string", description: "Name of the secret (e.g., 'API_KEY', 'DB_PASSWORD')" },
        secret_value: { type: "string", description: "Secret value to store" },
      },
      required: ["script_name", "secret_name", "secret_value"],
    },
  },
  {
    name: "cloudflare_worker_secret_delete",
    description: "Delete a secret from a Workers script by name.",
    inputSchema: {
      type: "object" as const,
      properties: {
        script_name: { type: "string", description: "Worker script name (lowercase alphanumeric and hyphens)" },
        secret_name: { type: "string", description: "Name of the secret to delete" },
      },
      required: ["script_name", "secret_name"],
    },
  },
];

// ---------------------------------------------------------------------------
// Tool handler
// ---------------------------------------------------------------------------

export async function handleWorkerSecretsTool(
  name: string,
  args: Record<string, unknown>,
  client: CloudflareClient,
): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  try {
    switch (name) {
      case "cloudflare_worker_secret_list": {
        const parsed = WorkerSecretListSchema.parse(args);
        const accountId = requireAccountId(client);
        const result = await client.get(
          `/accounts/${accountId}/workers/scripts/${parsed.script_name}/secrets`,
        );
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      case "cloudflare_worker_secret_set": {
        const parsed = WorkerSecretSetSchema.parse(args);
        const accountId = requireAccountId(client);
        await client.put(
          `/accounts/${accountId}/workers/scripts/${parsed.script_name}/secrets`,
          { name: parsed.secret_name, text: parsed.secret_value, type: "secret_text" },
        );
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              name: parsed.secret_name,
              type: "secret_text",
              message: "Secret set successfully. Value is not returned for security.",
            }, null, 2),
          }],
        };
      }

      case "cloudflare_worker_secret_delete": {
        const parsed = WorkerSecretDeleteSchema.parse(args);
        const accountId = requireAccountId(client);
        const result = await client.delete(
          `/accounts/${accountId}/workers/scripts/${parsed.script_name}/secrets/${parsed.secret_name}`,
        );
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      default:
        return {
          content: [{ type: "text", text: `Unknown Worker Secrets tool: ${name}` }],
        };
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return {
      content: [{ type: "text", text: `Error executing ${name}: ${message}` }],
    };
  }
}
