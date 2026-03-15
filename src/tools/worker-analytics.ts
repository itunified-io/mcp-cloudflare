import { z } from "zod";
import type { CloudflareClient } from "../client/cloudflare-client.js";

// ---------------------------------------------------------------------------
// Zod schemas for input validation
// ---------------------------------------------------------------------------

const WorkerAnalyticsSchema = z.object({
  since: z.string().datetime({ offset: true }).optional(),
  limit: z.number().int().min(1).max(10000).optional(),
});

const WorkerUsageSchema = z.object({
  since: z.string().datetime({ offset: true }).optional(),
  limit: z.number().int().min(1).max(10000).optional(),
});

// ---------------------------------------------------------------------------
// GraphQL query templates
// ---------------------------------------------------------------------------

const WORKER_ANALYTICS_QUERY = `
query WorkerAnalytics($accountTag: string!, $since: Time!, $limit: Int!) {
  viewer {
    accounts(filter: { accountTag: $accountTag }) {
      workersInvocationsAdaptive(
        filter: { datetime_gt: $since }
        limit: $limit
        orderBy: [datetime_DESC]
      ) {
        dimensions { scriptName datetime }
        sum { requests errors subrequests }
        quantiles { cpuTimeP50 cpuTimeP99 }
      }
    }
  }
}
`.trim();

const WORKER_USAGE_QUERY = `
query WorkerUsage($accountTag: string!, $since: Time!, $limit: Int!) {
  viewer {
    accounts(filter: { accountTag: $accountTag }) {
      workersInvocationsAdaptive(
        filter: { datetime_gt: $since }
        limit: $limit
        orderBy: [sum_requests_DESC]
      ) {
        dimensions { scriptName }
        sum { requests errors subrequests }
        quantiles { cpuTimeP50 cpuTimeP99 }
      }
    }
  }
}
`.trim();

// ---------------------------------------------------------------------------
// Account ID helper
// ---------------------------------------------------------------------------

function requireAccountId(client: CloudflareClient): string {
  const accountId = client.getAccountId();
  if (!accountId) {
    throw new Error(
      "CLOUDFLARE_ACCOUNT_ID environment variable is required for Worker Analytics operations",
    );
  }
  return accountId;
}

// ---------------------------------------------------------------------------
// Tool definitions (for ListTools)
// ---------------------------------------------------------------------------

export const workerAnalyticsToolDefinitions = [
  {
    name: "cloudflare_worker_analytics",
    description:
      "Query Workers invocation analytics (time-series). Returns per-script metrics including requests, errors, subrequests, and CPU time percentiles ordered by time.",
    inputSchema: {
      type: "object" as const,
      properties: {
        since: {
          type: "string",
          description:
            "ISO 8601 datetime to query from (default: 1 hour ago). E.g., '2026-03-15T00:00:00Z'",
        },
        limit: {
          type: "number",
          description: "Maximum number of data points to return (default: 100, max: 10000)",
        },
      },
    },
  },
  {
    name: "cloudflare_worker_usage",
    description:
      "Query Workers usage summary (per-script aggregated). Returns scripts ranked by total request count, with error rates and CPU time percentiles.",
    inputSchema: {
      type: "object" as const,
      properties: {
        since: {
          type: "string",
          description:
            "ISO 8601 datetime to query from (default: 24 hours ago). E.g., '2026-03-14T00:00:00Z'",
        },
        limit: {
          type: "number",
          description: "Maximum number of scripts to return (default: 100, max: 10000)",
        },
      },
    },
  },
];

// ---------------------------------------------------------------------------
// Tool handler
// ---------------------------------------------------------------------------

export async function handleWorkerAnalyticsTool(
  name: string,
  args: Record<string, unknown>,
  client: CloudflareClient,
): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  try {
    switch (name) {
      case "cloudflare_worker_analytics": {
        const parsed = WorkerAnalyticsSchema.parse(args);
        const accountId = requireAccountId(client);
        const since =
          parsed.since ?? new Date(Date.now() - 60 * 60 * 1000).toISOString();
        const limit = parsed.limit ?? 100;
        const result = await client.graphql<unknown>(WORKER_ANALYTICS_QUERY, {
          accountTag: accountId,
          since,
          limit,
        });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      case "cloudflare_worker_usage": {
        const parsed = WorkerUsageSchema.parse(args);
        const accountId = requireAccountId(client);
        const since =
          parsed.since ?? new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const limit = parsed.limit ?? 100;
        const result = await client.graphql<unknown>(WORKER_USAGE_QUERY, {
          accountTag: accountId,
          since,
          limit,
        });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      default:
        return {
          content: [{ type: "text", text: `Unknown Worker Analytics tool: ${name}` }],
        };
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return {
      content: [{ type: "text", text: `Error executing ${name}: ${message}` }],
    };
  }
}
