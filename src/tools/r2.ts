import { z } from "zod";
import type { CloudflareClient } from "../client/cloudflare-client.js";
import { R2BucketNameSchema, R2ObjectKeySchema, R2LocationHintSchema } from "../utils/validation.js";

// ---------------------------------------------------------------------------
// Zod schemas for input validation
// ---------------------------------------------------------------------------

const R2BucketListSchema = z.object({
  name_contains: z.string().optional(),
  cursor: z.string().optional(),
  per_page: z.number().int().min(1).max(1000).optional(),
  direction: z.enum(["asc", "desc"]).optional(),
  order: z.enum(["name"]).optional(),
});

const R2BucketCreateSchema = z.object({
  name: R2BucketNameSchema,
  location_hint: R2LocationHintSchema.optional(),
});

const R2BucketGetSchema = z.object({
  bucket_name: R2BucketNameSchema,
});

const R2BucketDeleteSchema = z.object({
  bucket_name: R2BucketNameSchema,
});

const R2ObjectListSchema = z.object({
  bucket_name: R2BucketNameSchema,
  prefix: z.string().optional(),
  delimiter: z.string().optional(),
  cursor: z.string().optional(),
  per_page: z.number().int().min(1).max(1000).optional(),
});

const R2ObjectGetSchema = z.object({
  bucket_name: R2BucketNameSchema,
  object_key: R2ObjectKeySchema,
});

const R2ObjectDeleteSchema = z.object({
  bucket_name: R2BucketNameSchema,
  object_key: R2ObjectKeySchema,
});

// ---------------------------------------------------------------------------
// Account ID helper
// ---------------------------------------------------------------------------

function requireAccountId(client: CloudflareClient): string {
  const accountId = client.getAccountId();
  if (!accountId) {
    throw new Error(
      "CLOUDFLARE_ACCOUNT_ID environment variable is required for R2 operations",
    );
  }
  return accountId;
}

// ---------------------------------------------------------------------------
// Tool definitions (for ListTools)
// ---------------------------------------------------------------------------

export const r2ToolDefinitions = [
  {
    name: "cloudflare_r2_bucket_list",
    description: "List all R2 buckets in the account. Supports filtering by name and pagination.",
    inputSchema: {
      type: "object" as const,
      properties: {
        name_contains: { type: "string", description: "Filter buckets whose name contains this string" },
        cursor: { type: "string", description: "Pagination cursor from a previous request" },
        per_page: { type: "number", description: "Results per page (1-1000, default: 1000)" },
        direction: { type: "string", enum: ["asc", "desc"], description: "Sort direction (default: asc)" },
        order: { type: "string", enum: ["name"], description: "Sort field" },
      },
    },
  },
  {
    name: "cloudflare_r2_bucket_create",
    description: "Create a new R2 storage bucket. Name must be 3-63 lowercase alphanumeric characters with hyphens.",
    inputSchema: {
      type: "object" as const,
      properties: {
        name: { type: "string", description: "Bucket name (3-63 chars, lowercase alphanumeric and hyphens)" },
        location_hint: {
          type: "string",
          enum: ["apac", "eeur", "enam", "weur", "wnam"],
          description: "Location hint for bucket placement (apac=Asia Pacific, eeur=Eastern Europe, enam=Eastern North America, weur=Western Europe, wnam=Western North America)",
        },
      },
      required: ["name"],
    },
  },
  {
    name: "cloudflare_r2_bucket_get",
    description: "Get details of an R2 bucket including creation date and location.",
    inputSchema: {
      type: "object" as const,
      properties: {
        bucket_name: { type: "string", description: "Name of the R2 bucket" },
      },
      required: ["bucket_name"],
    },
  },
  {
    name: "cloudflare_r2_bucket_delete",
    description: "DESTRUCTIVE: Delete an R2 bucket. The bucket must be empty before deletion.",
    inputSchema: {
      type: "object" as const,
      properties: {
        bucket_name: { type: "string", description: "Name of the R2 bucket to delete" },
      },
      required: ["bucket_name"],
    },
  },
  {
    name: "cloudflare_r2_object_list",
    description: "List objects in an R2 bucket. Supports prefix filtering, delimiter for directory-like listing, and pagination.",
    inputSchema: {
      type: "object" as const,
      properties: {
        bucket_name: { type: "string", description: "Name of the R2 bucket" },
        prefix: { type: "string", description: "Filter objects by key prefix (e.g., 'brand/' to list only brand assets)" },
        delimiter: { type: "string", description: "Delimiter for directory-like listing (e.g., '/' to group by folder)" },
        cursor: { type: "string", description: "Pagination cursor from a previous request" },
        per_page: { type: "number", description: "Maximum objects to return (1-1000)" },
      },
      required: ["bucket_name"],
    },
  },
  {
    name: "cloudflare_r2_object_get",
    description: "Get metadata of an object in an R2 bucket (size, etag, content type, last modified). Does not return object body.",
    inputSchema: {
      type: "object" as const,
      properties: {
        bucket_name: { type: "string", description: "Name of the R2 bucket" },
        object_key: { type: "string", description: "Key (path) of the object" },
      },
      required: ["bucket_name", "object_key"],
    },
  },
  {
    name: "cloudflare_r2_object_delete",
    description: "Delete an object from an R2 bucket.",
    inputSchema: {
      type: "object" as const,
      properties: {
        bucket_name: { type: "string", description: "Name of the R2 bucket" },
        object_key: { type: "string", description: "Key (path) of the object to delete" },
      },
      required: ["bucket_name", "object_key"],
    },
  },
];

// ---------------------------------------------------------------------------
// Tool handler
// ---------------------------------------------------------------------------

export async function handleR2Tool(
  name: string,
  args: Record<string, unknown>,
  client: CloudflareClient,
): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  try {
    switch (name) {
      case "cloudflare_r2_bucket_list": {
        const parsed = R2BucketListSchema.parse(args);
        const accountId = requireAccountId(client);
        const params: Record<string, unknown> = {};
        if (parsed.name_contains !== undefined) params["name_contains"] = parsed.name_contains;
        if (parsed.cursor !== undefined) params["cursor"] = parsed.cursor;
        if (parsed.per_page !== undefined) params["per_page"] = parsed.per_page;
        if (parsed.direction !== undefined) params["direction"] = parsed.direction;
        if (parsed.order !== undefined) params["order"] = parsed.order;
        const result = await client.get(
          `/accounts/${accountId}/r2/buckets`,
          params,
        );
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      case "cloudflare_r2_bucket_create": {
        const parsed = R2BucketCreateSchema.parse(args);
        const accountId = requireAccountId(client);
        const body: Record<string, unknown> = { name: parsed.name };
        if (parsed.location_hint !== undefined) body["locationHint"] = parsed.location_hint;
        const result = await client.post(
          `/accounts/${accountId}/r2/buckets`,
          body,
        );
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      case "cloudflare_r2_bucket_get": {
        const parsed = R2BucketGetSchema.parse(args);
        const accountId = requireAccountId(client);
        const result = await client.get(
          `/accounts/${accountId}/r2/buckets/${parsed.bucket_name}`,
        );
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      case "cloudflare_r2_bucket_delete": {
        const parsed = R2BucketDeleteSchema.parse(args);
        const accountId = requireAccountId(client);
        const result = await client.delete(
          `/accounts/${accountId}/r2/buckets/${parsed.bucket_name}`,
        );
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      case "cloudflare_r2_object_list": {
        const parsed = R2ObjectListSchema.parse(args);
        const accountId = requireAccountId(client);
        const params: Record<string, unknown> = {};
        if (parsed.prefix !== undefined) params["prefix"] = parsed.prefix;
        if (parsed.delimiter !== undefined) params["delimiter"] = parsed.delimiter;
        if (parsed.cursor !== undefined) params["cursor"] = parsed.cursor;
        if (parsed.per_page !== undefined) params["per_page"] = parsed.per_page;
        const result = await client.get(
          `/accounts/${accountId}/r2/buckets/${parsed.bucket_name}/objects`,
          params,
        );
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      case "cloudflare_r2_object_get": {
        const parsed = R2ObjectGetSchema.parse(args);
        const accountId = requireAccountId(client);
        const result = await client.get(
          `/accounts/${accountId}/r2/buckets/${parsed.bucket_name}/objects/${parsed.object_key}`,
        );
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      case "cloudflare_r2_object_delete": {
        const parsed = R2ObjectDeleteSchema.parse(args);
        const accountId = requireAccountId(client);
        const result = await client.delete(
          `/accounts/${accountId}/r2/buckets/${parsed.bucket_name}/objects/${parsed.object_key}`,
        );
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      default:
        return {
          content: [{ type: "text", text: `Unknown R2 tool: ${name}` }],
        };
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return {
      content: [{ type: "text", text: `Error executing ${name}: ${message}` }],
    };
  }
}
