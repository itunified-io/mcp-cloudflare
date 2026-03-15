import { describe, it, expect, vi } from 'vitest';
import { workerAnalyticsToolDefinitions, handleWorkerAnalyticsTool } from '../../src/tools/worker-analytics.js';
import type { CloudflareClient } from '../../src/client/cloudflare-client.js';

const ACCOUNT_ID = '00000000000000000000000000000001';

function mockClient(overrides: Partial<CloudflareClient> = {}): CloudflareClient {
  return {
    get: vi.fn().mockResolvedValue([]),
    post: vi.fn().mockResolvedValue({}),
    put: vi.fn().mockResolvedValue({}),
    patch: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue({}),
    resolveZoneId: vi.fn().mockResolvedValue('00000000000000000000000000000002'),
    getRaw: vi.fn().mockResolvedValue(''),
    getWithHeaders: vi.fn().mockResolvedValue({ result: [], headers: {} }),
    postForm: vi.fn().mockResolvedValue({}),
    putForm: vi.fn().mockResolvedValue({}),
    putRaw: vi.fn().mockResolvedValue(undefined),
    graphql: vi.fn().mockResolvedValue({
      viewer: {
        accounts: [{
          workersInvocationsAdaptive: [
            {
              dimensions: { scriptName: 'my-worker', datetime: '2026-03-15T00:00:00Z' },
              sum: { requests: 100, errors: 2, subrequests: 10 },
              quantiles: { cpuTimeP50: 1.5, cpuTimeP99: 8.2 },
            },
          ],
        }],
      },
    }),
    getAccountId: vi.fn().mockReturnValue(ACCOUNT_ID),
    ...overrides,
  } as unknown as CloudflareClient;
}

// ---------------------------------------------------------------------------
// Tool definitions
// ---------------------------------------------------------------------------

describe('Worker Analytics Tool Definitions', () => {
  it('exports 2 tool definitions', () => {
    expect(workerAnalyticsToolDefinitions).toHaveLength(2);
  });

  it('all tools have cloudflare_worker_ prefix', () => {
    for (const tool of workerAnalyticsToolDefinitions) {
      expect(tool.name).toMatch(/^cloudflare_worker_/);
    }
  });

  it('all tools have non-empty descriptions', () => {
    for (const tool of workerAnalyticsToolDefinitions) {
      expect(tool.description).toBeTruthy();
      expect(tool.description.length).toBeGreaterThan(10);
    }
  });

  it('all tools have inputSchema with type object', () => {
    for (const tool of workerAnalyticsToolDefinitions) {
      expect(tool.inputSchema).toBeDefined();
      expect(tool.inputSchema.type).toBe('object');
    }
  });
});

// ---------------------------------------------------------------------------
// handleWorkerAnalyticsTool
// ---------------------------------------------------------------------------

describe('handleWorkerAnalyticsTool', () => {
  describe('cloudflare_worker_analytics', () => {
    it('queries worker analytics via GraphQL', async () => {
      const client = mockClient();

      const result = await handleWorkerAnalyticsTool('cloudflare_worker_analytics', {}, client);

      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toContain('my-worker');
      expect(client.graphql).toHaveBeenCalledWith(
        expect.stringContaining('workersInvocationsAdaptive'),
        expect.objectContaining({
          accountTag: ACCOUNT_ID,
          since: expect.any(String),
          limit: 100,
        }),
      );
    });

    it('passes custom since and limit', async () => {
      const client = mockClient();

      await handleWorkerAnalyticsTool(
        'cloudflare_worker_analytics',
        { since: '2026-03-14T00:00:00Z', limit: 50 },
        client,
      );

      expect(client.graphql).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          since: '2026-03-14T00:00:00Z',
          limit: 50,
        }),
      );
    });

    it('returns error when account_id is missing', async () => {
      const client = mockClient({ getAccountId: vi.fn().mockReturnValue(undefined) });

      const result = await handleWorkerAnalyticsTool('cloudflare_worker_analytics', {}, client);

      expect(result.content[0].text).toContain('CLOUDFLARE_ACCOUNT_ID');
    });
  });

  describe('cloudflare_worker_usage', () => {
    it('queries worker usage via GraphQL', async () => {
      const client = mockClient();

      const result = await handleWorkerAnalyticsTool('cloudflare_worker_usage', {}, client);

      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toContain('my-worker');
      expect(client.graphql).toHaveBeenCalledWith(
        expect.stringContaining('workersInvocationsAdaptive'),
        expect.objectContaining({
          accountTag: ACCOUNT_ID,
        }),
      );
    });

    it('uses sum_requests_DESC ordering (different from analytics)', async () => {
      const client = mockClient();

      await handleWorkerAnalyticsTool('cloudflare_worker_usage', {}, client);

      const query = (client.graphql as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(query).toContain('sum_requests_DESC');
    });
  });

  describe('unknown tool', () => {
    it('returns unknown tool message for unrecognized tool name', async () => {
      const client = mockClient();

      const result = await handleWorkerAnalyticsTool('cloudflare_worker_unknown', {}, client);

      expect(result.content[0].text).toContain('Unknown Worker Analytics tool');
    });
  });

  describe('API error handling', () => {
    it('returns error message when GraphQL call fails', async () => {
      const client = mockClient({
        graphql: vi.fn().mockRejectedValue(new Error('GraphQL error')),
      });

      const result = await handleWorkerAnalyticsTool('cloudflare_worker_analytics', {}, client);

      expect(result.content[0].text).toContain('Error executing cloudflare_worker_analytics');
      expect(result.content[0].text).toContain('GraphQL error');
    });
  });
});
