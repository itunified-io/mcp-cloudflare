import { describe, it, expect, vi } from 'vitest';
import { ratelimitingToolDefinitions, handleRatelimitingTool } from '../../src/tools/ratelimiting.js';
import type { CloudflareClient } from '../../src/client/cloudflare-client.js';

const ZONE_ID = '00000000000000000000000000000001';
const RATE_LIMIT_ID = 'rate-limit-123';

function mockClient(overrides: Partial<CloudflareClient> = {}): CloudflareClient {
  return {
    get: vi.fn().mockResolvedValue([]),
    post: vi.fn().mockResolvedValue({}),
    put: vi.fn().mockResolvedValue({}),
    patch: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue({}),
    resolveZoneId: vi.fn().mockResolvedValue(ZONE_ID),
    getRaw: vi.fn().mockResolvedValue(''),
    getWithHeaders: vi.fn().mockResolvedValue({ result: [], headers: {} }),
    postForm: vi.fn().mockResolvedValue({}),
    graphql: vi.fn().mockResolvedValue({}),
    ...overrides,
  } as unknown as CloudflareClient;
}

// ---------------------------------------------------------------------------
// Tool definitions
// ---------------------------------------------------------------------------

describe('Rate Limiting Tool Definitions', () => {
  it('exports 3 tool definitions', () => {
    expect(ratelimitingToolDefinitions).toHaveLength(3);
  });

  it('all tools have cloudflare_rate_limit_ prefix', () => {
    for (const tool of ratelimitingToolDefinitions) {
      expect(tool.name).toMatch(/^cloudflare_rate_limit_/);
    }
  });

  it('all tools have non-empty descriptions', () => {
    for (const tool of ratelimitingToolDefinitions) {
      expect(tool.description.length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// Handler tests
// ---------------------------------------------------------------------------

describe('handleRatelimitingTool', () => {
  describe('cloudflare_rate_limit_list', () => {
    it('lists rate limits for a zone', async () => {
      const mockRules = [{ id: RATE_LIMIT_ID, threshold: 100, period: 60 }];
      const client = mockClient({ get: vi.fn().mockResolvedValue(mockRules) });

      const result = await handleRatelimitingTool('cloudflare_rate_limit_list', {
        zone_id: ZONE_ID,
      }, client);

      expect(result.content[0].text).toContain(RATE_LIMIT_ID);
      expect(client.get).toHaveBeenCalledWith(`/zones/${ZONE_ID}/rate_limits`, {});
    });

    it('passes pagination params', async () => {
      const client = mockClient();

      await handleRatelimitingTool('cloudflare_rate_limit_list', {
        zone_id: ZONE_ID,
        page: 2,
        per_page: 50,
      }, client);

      expect(client.get).toHaveBeenCalledWith(`/zones/${ZONE_ID}/rate_limits`, { page: 2, per_page: 50 });
    });
  });

  describe('cloudflare_rate_limit_get', () => {
    it('gets a specific rate limit rule', async () => {
      const mockRule = { id: RATE_LIMIT_ID, threshold: 100, period: 60, action: { mode: 'ban' } };
      const client = mockClient({ get: vi.fn().mockResolvedValue(mockRule) });

      const result = await handleRatelimitingTool('cloudflare_rate_limit_get', {
        zone_id: ZONE_ID,
        rate_limit_id: RATE_LIMIT_ID,
      }, client);

      expect(result.content[0].text).toContain(RATE_LIMIT_ID);
      expect(client.get).toHaveBeenCalledWith(`/zones/${ZONE_ID}/rate_limits/${RATE_LIMIT_ID}`);
    });

    it('returns error for missing rate_limit_id', async () => {
      const client = mockClient();

      const result = await handleRatelimitingTool('cloudflare_rate_limit_get', {
        zone_id: ZONE_ID,
      }, client);

      expect(result.content[0].text).toContain('Error');
    });
  });

  describe('cloudflare_rate_limit_status', () => {
    it('returns summary of rate limit rules', async () => {
      const mockRules = [
        { id: '1', disabled: false, action: { mode: 'ban' } },
        { id: '2', disabled: true, action: { mode: 'challenge' } },
        { id: '3', disabled: false, action: { mode: 'ban' } },
      ];
      const client = mockClient({ get: vi.fn().mockResolvedValue(mockRules) });

      const result = await handleRatelimitingTool('cloudflare_rate_limit_status', {
        zone_id: ZONE_ID,
      }, client);

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.total).toBe(3);
      expect(parsed.enabled).toBe(2);
      expect(parsed.disabled).toBe(1);
      expect(parsed.actions.ban).toBe(2);
      expect(parsed.actions.challenge).toBe(1);
    });

    it('handles empty rules list', async () => {
      const client = mockClient({ get: vi.fn().mockResolvedValue([]) });

      const result = await handleRatelimitingTool('cloudflare_rate_limit_status', {
        zone_id: ZONE_ID,
      }, client);

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.total).toBe(0);
      expect(parsed.enabled).toBe(0);
      expect(parsed.disabled).toBe(0);
    });
  });

  describe('unknown tool', () => {
    it('returns error for unknown tool name', async () => {
      const client = mockClient();

      const result = await handleRatelimitingTool('cloudflare_rate_limit_unknown', {}, client);

      expect(result.content[0].text).toContain('Unknown rate limiting tool');
    });
  });
});
