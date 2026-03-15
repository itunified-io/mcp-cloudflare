import { z } from "zod";
import type { CloudflareClient } from "../client/cloudflare-client.js";
import { NamespaceIdSchema, KvKeySchema } from "../utils/validation.js";

// ---------------------------------------------------------------------------
// Zod schemas for input validation
// ---------------------------------------------------------------------------

const KvNamespaceListSchema = z.object({
  page: z.number().int().min(1).optional(),
  per_page: z.number().int().min(1).max(100).optional(),
});

const KvNamespaceCreateSchema = z.object({
  title: z.string().min(1, "Namespace title is required"),
});

const KvNamespaceDeleteSchema = z.object({
  namespace_id: NamespaceIdSchema,
});

const KvListKeysSchema = z.object({
  namespace_id: NamespaceIdSchema,
  prefix: z.string().optional(),
  limit: z.number().int().min(1).max(1000).optional(),
  cursor: z.string().optional(),
});

const KvReadSchema = z.object({
  namespace_id: NamespaceIdSchema,
  key_name: KvKeySchema,
});

const KvWriteSchema = z.object({
  namespace_id: NamespaceIdSchema,
  key_name: KvKeySchema,
  value: z.string().min(0, "Value is required"),
  expiration_ttl: z.number().int().min(60, "Expiration TTL must be at least 60 seconds").optional(),
});

const KvDeleteSchema = z.object({
  namespace_id: NamespaceIdSchema,
  key_name: KvKeySchema,
});

// ---------------------------------------------------------------------------
// Account ID helper
// ---------------------------------------------------------------------------

function requireAccountId(client: CloudflareClient): string {
  const accountId = client.getAccountId();
  if (!accountId) {
    throw new Error(
      "CLOUDFLARE_ACCOUNT_ID environment variable is required for KV operations",
    );
  }
  return accountId;
}

// ---------------------------------------------------------------------------
// Tool definitions (for ListTools)
// ---------------------------------------------------------------------------

export const kvToolDefinitions = [
  {
    name: "cloudflare_kv_namespace_list",
    description: "List all Workers KV namespaces in the account.",
    inputSchema: {
      type: "object" as const,
      properties: {
        page: { type: "number", description: "Page number (default: 1)" },
        per_page: { type: "number", description: "Results per page (1-100, default: 20)" },
      },
    },
  },
  {
    name: "cloudflare_kv_namespace_create",
    description: "Create a new Workers KV namespace in the account.",
    inputSchema: {
      type: "object" as const,
      properties: {
        title: { type: "string", description: "Title for the new KV namespace" },
      },
      required: ["title"],
    },
  },
  {
    name: "cloudflare_kv_namespace_delete",
    description: "DESTRUCTIVE: Delete a Workers KV namespace by its ID. This removes all keys in the namespace.",
    inputSchema: {
      type: "object" as const,
      properties: {
        namespace_id: { type: "string", description: "KV namespace ID (32-character hex string)" },
      },
      required: ["namespace_id"],
    },
  },
  {
    name: "cloudflare_kv_list_keys",
    description: "List keys stored in a Workers KV namespace. Supports prefix filtering and cursor-based pagination.",
    inputSchema: {
      type: "object" as const,
      properties: {
        namespace_id: { type: "string", description: "KV namespace ID (32-character hex string)" },
        prefix: { type: "string", description: "Filter keys by prefix" },
        limit: { type: "number", description: "Maximum number of keys to return (1-1000, default: 1000)" },
        cursor: { type: "string", description: "Pagination cursor from a previous request" },
      },
      required: ["namespace_id"],
    },
  },
  {
    name: "cloudflare_kv_read",
    description: "Read the value of a key from a Workers KV namespace. Returns the raw string value.",
    inputSchema: {
      type: "object" as const,
      properties: {
        namespace_id: { type: "string", description: "KV namespace ID (32-character hex string)" },
        key_name: { type: "string", description: "Key name to read (max 512 characters)" },
      },
      required: ["namespace_id", "key_name"],
    },
  },
  {
    name: "cloudflare_kv_write",
    description: "Write a value to a key in a Workers KV namespace. Optionally set a TTL for automatic expiration.",
    inputSchema: {
      type: "object" as const,
      properties: {
        namespace_id: { type: "string", description: "KV namespace ID (32-character hex string)" },
        key_name: { type: "string", description: "Key name to write (max 512 characters)" },
        value: { type: "string", description: "Value to store" },
        expiration_ttl: { type: "number", description: "Time-to-live in seconds (minimum 60). Key is automatically deleted after this period." },
      },
      required: ["namespace_id", "key_name", "value"],
    },
  },
  {
    name: "cloudflare_kv_delete",
    description: "Delete a key from a Workers KV namespace.",
    inputSchema: {
      type: "object" as const,
      properties: {
        namespace_id: { type: "string", description: "KV namespace ID (32-character hex string)" },
        key_name: { type: "string", description: "Key name to delete (max 512 characters)" },
      },
      required: ["namespace_id", "key_name"],
    },
  },
];

// ---------------------------------------------------------------------------
// Tool handler
// ---------------------------------------------------------------------------

export async function handleKvTool(
  name: string,
  args: Record<string, unknown>,
  client: CloudflareClient,
): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  try {
    switch (name) {
      case "cloudflare_kv_namespace_list": {
        const parsed = KvNamespaceListSchema.parse(args);
        const accountId = requireAccountId(client);
        const params: Record<string, unknown> = {};
        if (parsed.page !== undefined) params["page"] = parsed.page;
        if (parsed.per_page !== undefined) params["per_page"] = parsed.per_page;
        const result = await client.get(
          `/accounts/${accountId}/storage/kv/namespaces`,
          params,
        );
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      case "cloudflare_kv_namespace_create": {
        const parsed = KvNamespaceCreateSchema.parse(args);
        const accountId = requireAccountId(client);
        const result = await client.post(
          `/accounts/${accountId}/storage/kv/namespaces`,
          { title: parsed.title },
        );
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      case "cloudflare_kv_namespace_delete": {
        const parsed = KvNamespaceDeleteSchema.parse(args);
        const accountId = requireAccountId(client);
        const result = await client.delete(
          `/accounts/${accountId}/storage/kv/namespaces/${parsed.namespace_id}`,
        );
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      case "cloudflare_kv_list_keys": {
        const parsed = KvListKeysSchema.parse(args);
        const accountId = requireAccountId(client);
        const params: Record<string, unknown> = {};
        if (parsed.prefix !== undefined) params["prefix"] = parsed.prefix;
        if (parsed.limit !== undefined) params["limit"] = parsed.limit;
        if (parsed.cursor !== undefined) params["cursor"] = parsed.cursor;
        const result = await client.get(
          `/accounts/${accountId}/storage/kv/namespaces/${parsed.namespace_id}/keys`,
          params,
        );
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      case "cloudflare_kv_read": {
        const parsed = KvReadSchema.parse(args);
        const accountId = requireAccountId(client);
        const result = await client.getRaw(
          `/accounts/${accountId}/storage/kv/namespaces/${parsed.namespace_id}/values/${parsed.key_name}`,
        );
        return { content: [{ type: "text", text: result }] };
      }

      case "cloudflare_kv_write": {
        const parsed = KvWriteSchema.parse(args);
        const accountId = requireAccountId(client);
        let path = `/accounts/${accountId}/storage/kv/namespaces/${parsed.namespace_id}/values/${parsed.key_name}`;
        if (parsed.expiration_ttl !== undefined) {
          path += `?expiration_ttl=${parsed.expiration_ttl}`;
        }
        await client.putRaw(path, parsed.value);
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              namespace_id: parsed.namespace_id,
              key: parsed.key_name,
              message: "Key written successfully.",
            }, null, 2),
          }],
        };
      }

      case "cloudflare_kv_delete": {
        const parsed = KvDeleteSchema.parse(args);
        const accountId = requireAccountId(client);
        const result = await client.delete(
          `/accounts/${accountId}/storage/kv/namespaces/${parsed.namespace_id}/values/${parsed.key_name}`,
        );
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      default:
        return {
          content: [{ type: "text", text: `Unknown KV tool: ${name}` }],
        };
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return {
      content: [{ type: "text", text: `Error executing ${name}: ${message}` }],
    };
  }
}
