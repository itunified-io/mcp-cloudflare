import { describe, it, expect, vi } from 'vitest';
import { webAnalyticsToolDefinitions, handleWebAnalyticsTool } from '../../src/tools/web-analytics.js';
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
        zones: [{
          httpRequestsAdaptiveGroups: [
            {
              dimensions: { datetime: '2026-03-15T00:00:00Z' },
              count: 500,
              sum: { visits: 200, edgeResponseBytes: 1048576 },
              avg: { sampleInterval: 1 },
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

describe('Web Analytics Tool Definitions', () => {
  it('exports 5 tool definitions', () => {
    expect(webAnalyticsToolDefinitions).toHaveLength(5);
  });

  it('all tools have cloudflare_web_analytics_ prefix', () => {
    for (const tool of webAnalyticsToolDefinitions) {
      expect(tool.name).toMatch(/^cloudflare_web_analytics_/);
    }
  });

  it('all tools have non-empty descriptions', () => {
    for (const tool of webAnalyticsToolDefinitions) {
      expect(tool.description).toBeTruthy();
      expect(tool.description.length).toBeGreaterThan(10);
    }
  });

  it('all tools have inputSchema with type object', () => {
    for (const tool of webAnalyticsToolDefinitions) {
      expect(tool.inputSchema).toBeDefined();
      expect(tool.inputSchema.type).toBe('object');
    }
  });
});

// ---------------------------------------------------------------------------
// handleWebAnalyticsTool
// ---------------------------------------------------------------------------

describe('handleWebAnalyticsTool', () => {
  describe('cloudflare_web_analytics_list', () => {
    it('lists RUM sites', async () => {
      const client = mockClient();

      const result = await handleWebAnalyticsTool('cloudflare_web_analytics_list', {}, client);

      expect(result.content[0].type).toBe('text');
      expect(client.get).toHaveBeenCalledWith(
        `/accounts/${ACCOUNT_ID}/rum/site_info/list`,
        {},
      );
    });

    it('passes order_by parameter', async () => {
      const client = mockClient();

      await handleWebAnalyticsTool('cloudflare_web_analytics_list', { order_by: 'created' }, client);

      expect(client.get).toHaveBeenCalledWith(
        `/accounts/${ACCOUNT_ID}/rum/site_info/list`,
        { order_by: 'created' },
      );
    });

    it('returns error when account_id is missing', async () => {
      const client = mockClient({ getAccountId: vi.fn().mockReturnValue(undefined) });

      const result = await handleWebAnalyticsTool('cloudflare_web_analytics_list', {}, client);

      expect(result.content[0].text).toContain('CLOUDFLARE_ACCOUNT_ID');
    });
  });

  describe('cloudflare_web_analytics_create', () => {
    it('creates a RUM site with host', async () => {
      const client = mockClient();

      await handleWebAnalyticsTool('cloudflare_web_analytics_create', { host: 'example.com' }, client);

      expect(client.post).toHaveBeenCalledWith(
        `/accounts/${ACCOUNT_ID}/rum/site_info`,
        { host: 'example.com', auto_install: true },
      );
    });

    it('passes zone_tag and auto_install', async () => {
      const client = mockClient();

      await handleWebAnalyticsTool(
        'cloudflare_web_analytics_create',
        { host: 'example.com', zone_tag: '00000000000000000000000000000003', auto_install: false },
        client,
      );

      expect(client.post).toHaveBeenCalledWith(
        `/accounts/${ACCOUNT_ID}/rum/site_info`,
        { host: 'example.com', auto_install: false, zone_tag: '00000000000000000000000000000003' },
      );
    });

    it('rejects missing host', async () => {
      const client = mockClient();

      const result = await handleWebAnalyticsTool('cloudflare_web_analytics_create', {}, client);

      expect(result.content[0].text).toContain('Error');
    });
  });

  describe('cloudflare_web_analytics_get', () => {
    it('gets a RUM site by ID', async () => {
      const client = mockClient();

      await handleWebAnalyticsTool('cloudflare_web_analytics_get', { site_id: 'site-123' }, client);

      expect(client.get).toHaveBeenCalledWith(
        `/accounts/${ACCOUNT_ID}/rum/site_info/site-123`,
      );
    });

    it('rejects missing site_id', async () => {
      const client = mockClient();

      const result = await handleWebAnalyticsTool('cloudflare_web_analytics_get', {}, client);

      expect(result.content[0].text).toContain('Error');
    });
  });

  describe('cloudflare_web_analytics_delete', () => {
    it('deletes a RUM site by ID', async () => {
      const client = mockClient();

      await handleWebAnalyticsTool('cloudflare_web_analytics_delete', { site_id: 'site-123' }, client);

      expect(client.delete).toHaveBeenCalledWith(
        `/accounts/${ACCOUNT_ID}/rum/site_info/site-123`,
      );
    });
  });

  describe('cloudflare_web_analytics_stats', () => {
    it('queries stats via GraphQL', async () => {
      const client = mockClient();

      const result = await handleWebAnalyticsTool(
        'cloudflare_web_analytics_stats',
        { zone_id: '00000000000000000000000000000002' },
        client,
      );

      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toContain('httpRequestsAdaptiveGroups');
      expect(client.resolveZoneId).toHaveBeenCalledWith('00000000000000000000000000000002');
      expect(client.graphql).toHaveBeenCalledWith(
        expect.stringContaining('httpRequestsAdaptiveGroups'),
        expect.objectContaining({
          zoneTag: '00000000000000000000000000000002',
          since: expect.any(String),
          limit: 100,
        }),
      );
    });

    it('passes custom since and limit', async () => {
      const client = mockClient();

      await handleWebAnalyticsTool(
        'cloudflare_web_analytics_stats',
        { zone_id: '00000000000000000000000000000002', since: '2026-03-14T00:00:00Z', limit: 50 },
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

    it('rejects missing zone_id', async () => {
      const client = mockClient();

      const result = await handleWebAnalyticsTool('cloudflare_web_analytics_stats', {}, client);

      expect(result.content[0].text).toContain('Error');
    });
  });

  describe('unknown tool', () => {
    it('returns unknown tool message', async () => {
      const client = mockClient();

      const result = await handleWebAnalyticsTool('cloudflare_web_analytics_unknown', {}, client);

      expect(result.content[0].text).toContain('Unknown Web Analytics tool');
    });
  });

  describe('API error handling', () => {
    it('returns error message when API call fails', async () => {
      const client = mockClient({
        get: vi.fn().mockRejectedValue(new Error('API error')),
      });

      const result = await handleWebAnalyticsTool('cloudflare_web_analytics_list', {}, client);

      expect(result.content[0].text).toContain('Error executing cloudflare_web_analytics_list');
      expect(result.content[0].text).toContain('API error');
    });

    it('returns error message when GraphQL call fails', async () => {
      const client = mockClient({
        graphql: vi.fn().mockRejectedValue(new Error('GraphQL error')),
      });

      const result = await handleWebAnalyticsTool(
        'cloudflare_web_analytics_stats',
        { zone_id: '00000000000000000000000000000002' },
        client,
      );

      expect(result.content[0].text).toContain('Error executing cloudflare_web_analytics_stats');
      expect(result.content[0].text).toContain('GraphQL error');
    });
  });
});
