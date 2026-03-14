import { describe, it, expect, vi } from 'vitest';
import { diagnosticsToolDefinitions, handleDiagnosticsTool } from '../../src/tools/diagnostics.js';
import type { CloudflareClient } from '../../src/client/cloudflare-client.js';

const ZONE_ID = '00000000000000000000000000000001';
const ZONE_NAME = 'example.com';

function mockClient(overrides: Partial<CloudflareClient> = {}): CloudflareClient {
  return {
    get: vi.fn().mockResolvedValue({}),
    post: vi.fn().mockResolvedValue({}),
    put: vi.fn().mockResolvedValue({}),
    patch: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue({}),
    resolveZoneId: vi.fn().mockResolvedValue(ZONE_ID),
    getRaw: vi.fn().mockResolvedValue(''),
    getWithHeaders: vi.fn().mockResolvedValue({ result: {}, headers: {} }),
    postForm: vi.fn().mockResolvedValue({}),
    graphql: vi.fn().mockResolvedValue({}),
    ...overrides,
  } as unknown as CloudflareClient;
}

// ---------------------------------------------------------------------------
// Tool definitions
// ---------------------------------------------------------------------------

describe('Diagnostics Tool Definitions', () => {
  it('exports 4 tool definitions', () => {
    expect(diagnosticsToolDefinitions).toHaveLength(4);
  });

  it('all tools have cloudflare_ prefix', () => {
    for (const tool of diagnosticsToolDefinitions) {
      expect(tool.name).toMatch(/^cloudflare_/);
    }
  });

  it('all tools have non-empty descriptions', () => {
    for (const tool of diagnosticsToolDefinitions) {
      expect(tool.description).toBeTruthy();
      expect(tool.description.length).toBeGreaterThan(10);
    }
  });

  it('all tools have inputSchema with type object', () => {
    for (const tool of diagnosticsToolDefinitions) {
      expect(tool.inputSchema).toBeDefined();
      expect(tool.inputSchema.type).toBe('object');
    }
  });
});

// ---------------------------------------------------------------------------
// handleDiagnosticsTool
// ---------------------------------------------------------------------------

describe('handleDiagnosticsTool', () => {
  describe('cloudflare_account_info', () => {
    it('returns account information', async () => {
      const mockAccounts = [{ id: '00000000000000000000000000000000', name: 'My Account' }];
      const client = mockClient({ get: vi.fn().mockResolvedValue(mockAccounts) });

      const result = await handleDiagnosticsTool('cloudflare_account_info', {}, client);

      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toContain('My Account');
      expect(client.get).toHaveBeenCalledWith('/accounts');
    });

    it('handles API errors gracefully', async () => {
      const client = mockClient({
        get: vi.fn().mockRejectedValue(new Error('Unauthorized')),
      });

      const result = await handleDiagnosticsTool('cloudflare_account_info', {}, client);

      expect(result.content[0].text).toContain('Error executing cloudflare_account_info');
      expect(result.content[0].text).toContain('Unauthorized');
    });
  });

  describe('cloudflare_token_verify', () => {
    it('verifies API token and returns status', async () => {
      const mockTokenInfo = { id: 'token-id', status: 'active', expires_on: null };
      const client = mockClient({ get: vi.fn().mockResolvedValue(mockTokenInfo) });

      const result = await handleDiagnosticsTool('cloudflare_token_verify', {}, client);

      expect(result.content[0].text).toContain('active');
      expect(client.get).toHaveBeenCalledWith('/user/tokens/verify');
    });

    it('handles invalid token errors gracefully', async () => {
      const client = mockClient({
        get: vi.fn().mockRejectedValue(new Error('Token invalid or expired')),
      });

      const result = await handleDiagnosticsTool('cloudflare_token_verify', {}, client);

      expect(result.content[0].text).toContain('Error executing cloudflare_token_verify');
    });
  });

  describe('cloudflare_zone_health', () => {
    it('returns combined zone health report', async () => {
      const mockZone = {
        id: ZONE_ID,
        name: ZONE_NAME,
        status: 'active',
        paused: false,
        plan: { name: 'Free' },
        name_servers: ['ns1.cloudflare.com', 'ns2.cloudflare.com'],
      };
      const mockDnssec = { status: 'active', ds: 'DS record' };
      const mockSsl = { id: 'ssl', value: 'full', editable: true };

      const client = mockClient({
        resolveZoneId: vi.fn().mockResolvedValue(ZONE_ID),
        get: vi.fn()
          .mockResolvedValueOnce(mockZone)     // /zones/{id}
          .mockResolvedValueOnce(mockDnssec)   // /zones/{id}/dnssec
          .mockResolvedValueOnce(mockSsl),     // /zones/{id}/settings/ssl
      });

      const result = await handleDiagnosticsTool('cloudflare_zone_health', { zone_id: ZONE_ID }, client);

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.zone.status).toBe('active');
      expect(parsed.zone.name).toBe(ZONE_NAME);
      expect(parsed.summary.zone_active).toBe(true);
      expect(parsed.summary.zone_paused).toBe(false);
      expect(parsed.summary.dnssec_enabled).toBe(true);
      expect(parsed.summary.ssl_mode).toBe('full');
    });

    it('handles DNSSEC and SSL fetch failures gracefully', async () => {
      const mockZone = {
        id: ZONE_ID,
        name: ZONE_NAME,
        status: 'active',
        paused: false,
        plan: { name: 'Free' },
        name_servers: [],
      };

      const client = mockClient({
        resolveZoneId: vi.fn().mockResolvedValue(ZONE_ID),
        get: vi.fn()
          .mockResolvedValueOnce(mockZone)
          .mockRejectedValueOnce(new Error('DNSSEC not available'))
          .mockRejectedValueOnce(new Error('SSL setting unavailable')),
      });

      const result = await handleDiagnosticsTool('cloudflare_zone_health', { zone_id: ZONE_ID }, client);

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.zone.status).toBe('active');
      expect(parsed.dnssec).toHaveProperty('error');
      expect(parsed.ssl).toHaveProperty('error');
      expect(parsed.summary.dnssec_enabled).toBe(false);
      expect(parsed.summary.ssl_mode).toBe('unknown');
    });

    it('requires zone_id parameter', async () => {
      const client = mockClient();

      const result = await handleDiagnosticsTool('cloudflare_zone_health', {}, client);

      expect(result.content[0].text).toContain('Error executing cloudflare_zone_health');
    });

    it('resolves zone name to ID', async () => {
      const mockZone = {
        id: ZONE_ID,
        name: ZONE_NAME,
        status: 'active',
        paused: false,
        plan: { name: 'Free' },
        name_servers: [],
      };
      const client = mockClient({
        resolveZoneId: vi.fn().mockResolvedValue(ZONE_ID),
        get: vi.fn().mockResolvedValue(mockZone),
      });

      await handleDiagnosticsTool('cloudflare_zone_health', { zone_id: ZONE_NAME }, client);

      expect(client.resolveZoneId).toHaveBeenCalledWith(ZONE_NAME);
    });
  });

  describe('cloudflare_rate_limit_status', () => {
    it('returns rate limit info from response headers', async () => {
      const mockHeaders = {
        'x-ratelimit-limit': '1200',
        'x-ratelimit-remaining': '1100',
        'x-ratelimit-reset': '1700000000',
      };
      const client = mockClient({
        getWithHeaders: vi.fn().mockResolvedValue({ result: [], headers: mockHeaders }),
      });

      const result = await handleDiagnosticsTool('cloudflare_rate_limit_status', {}, client);

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.limit).toBe(1200);
      expect(parsed.remaining).toBe(1100);
      expect(parsed.reset_unix).toBe(1700000000);
      expect(typeof parsed.reset_at).toBe('string');
      expect(client.getWithHeaders).toHaveBeenCalledWith('/zones', { per_page: 1 });
    });

    it('returns nulls when rate limit headers are absent', async () => {
      const client = mockClient({
        getWithHeaders: vi.fn().mockResolvedValue({ result: [], headers: {} }),
      });

      const result = await handleDiagnosticsTool('cloudflare_rate_limit_status', {}, client);

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.limit).toBeNull();
      expect(parsed.remaining).toBeNull();
      expect(parsed.reset_at).toBeNull();
    });

    it('handles API errors gracefully', async () => {
      const client = mockClient({
        getWithHeaders: vi.fn().mockRejectedValue(new Error('Rate limit check failed')),
      });

      const result = await handleDiagnosticsTool('cloudflare_rate_limit_status', {}, client);

      expect(result.content[0].text).toContain('Error executing cloudflare_rate_limit_status');
    });
  });

  describe('unknown tool', () => {
    it('returns unknown tool message', async () => {
      const client = mockClient();

      const result = await handleDiagnosticsTool('cloudflare_unknown_tool', {}, client);

      expect(result.content[0].text).toContain('Unknown diagnostics tool');
    });
  });
});
