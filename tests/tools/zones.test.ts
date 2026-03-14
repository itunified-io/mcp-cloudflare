import { describe, it, expect, vi } from 'vitest';
import { zonesToolDefinitions, handleZonesTool } from '../../src/tools/zones.js';
import type { CloudflareClient } from '../../src/client/cloudflare-client.js';

const ZONE_ID = '00000000000000000000000000000001';
const ZONE_NAME = 'example.com';

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

describe('Zones Tool Definitions', () => {
  it('exports 4 tool definitions', () => {
    expect(zonesToolDefinitions).toHaveLength(4);
  });

  it('all tools have cloudflare_zone_ prefix', () => {
    for (const tool of zonesToolDefinitions) {
      expect(tool.name).toMatch(/^cloudflare_zone/);
    }
  });

  it('all tools have non-empty descriptions', () => {
    for (const tool of zonesToolDefinitions) {
      expect(tool.description).toBeTruthy();
      expect(tool.description.length).toBeGreaterThan(10);
    }
  });

  it('all tools have inputSchema with type object', () => {
    for (const tool of zonesToolDefinitions) {
      expect(tool.inputSchema).toBeDefined();
      expect(tool.inputSchema.type).toBe('object');
    }
  });
});

// ---------------------------------------------------------------------------
// handleZonesTool
// ---------------------------------------------------------------------------

describe('handleZonesTool', () => {
  describe('cloudflare_zone_list', () => {
    it('lists zones with no filters', async () => {
      const mockZones = [{ id: ZONE_ID, name: ZONE_NAME, status: 'active' }];
      const client = mockClient({ get: vi.fn().mockResolvedValue(mockZones) });

      const result = await handleZonesTool('cloudflare_zone_list', {}, client);

      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toContain(ZONE_NAME);
      expect(client.get).toHaveBeenCalledWith('/zones', {});
    });

    it('lists zones with pagination and status filter', async () => {
      const client = mockClient({ get: vi.fn().mockResolvedValue([]) });

      await handleZonesTool('cloudflare_zone_list', { page: 2, per_page: 10, status: 'active' }, client);

      expect(client.get).toHaveBeenCalledWith('/zones', { page: 2, per_page: 10, status: 'active' });
    });

    it('rejects invalid status value via Zod', async () => {
      const client = mockClient();

      const result = await handleZonesTool('cloudflare_zone_list', { status: 'invalid-status' }, client);

      expect(result.content[0].text).toContain('Error executing cloudflare_zone_list');
    });

    it('rejects per_page > 50 via Zod', async () => {
      const client = mockClient();

      const result = await handleZonesTool('cloudflare_zone_list', { per_page: 100 }, client);

      expect(result.content[0].text).toContain('Error executing cloudflare_zone_list');
    });
  });

  describe('cloudflare_zone_get', () => {
    it('gets zone by zone_id', async () => {
      const mockZone = { id: ZONE_ID, name: ZONE_NAME, status: 'active' };
      const client = mockClient({ get: vi.fn().mockResolvedValue(mockZone) });

      const result = await handleZonesTool('cloudflare_zone_get', { zone_id: ZONE_ID }, client);

      expect(result.content[0].text).toContain(ZONE_NAME);
      expect(client.resolveZoneId).toHaveBeenCalledWith(ZONE_ID);
      expect(client.get).toHaveBeenCalledWith(`/zones/${ZONE_ID}`);
    });

    it('resolves zone name to ID', async () => {
      const client = mockClient({
        resolveZoneId: vi.fn().mockResolvedValue(ZONE_ID),
        get: vi.fn().mockResolvedValue({ id: ZONE_ID }),
      });

      await handleZonesTool('cloudflare_zone_get', { zone_id: ZONE_NAME }, client);

      expect(client.resolveZoneId).toHaveBeenCalledWith(ZONE_NAME);
    });

    it('requires zone_id parameter', async () => {
      const client = mockClient();

      const result = await handleZonesTool('cloudflare_zone_get', {}, client);

      expect(result.content[0].text).toContain('Error executing cloudflare_zone_get');
    });
  });

  describe('cloudflare_zone_setting_get', () => {
    it('gets a zone setting', async () => {
      const mockSetting = { id: 'ssl', value: 'full', editable: true };
      const client = mockClient({ get: vi.fn().mockResolvedValue(mockSetting) });

      const result = await handleZonesTool(
        'cloudflare_zone_setting_get',
        { zone_id: ZONE_ID, setting_name: 'ssl' },
        client,
      );

      expect(result.content[0].text).toContain('full');
      expect(client.get).toHaveBeenCalledWith(`/zones/${ZONE_ID}/settings/ssl`);
    });

    it('requires setting_name parameter', async () => {
      const client = mockClient();

      const result = await handleZonesTool(
        'cloudflare_zone_setting_get',
        { zone_id: ZONE_ID },
        client,
      );

      expect(result.content[0].text).toContain('Error executing cloudflare_zone_setting_get');
    });
  });

  describe('cloudflare_zone_setting_update', () => {
    it('updates a zone setting', async () => {
      const mockResult = { id: 'ssl', value: 'strict', editable: true };
      const client = mockClient({ patch: vi.fn().mockResolvedValue(mockResult) });

      const result = await handleZonesTool(
        'cloudflare_zone_setting_update',
        { zone_id: ZONE_ID, setting_name: 'ssl', value: 'strict' },
        client,
      );

      expect(result.content[0].text).toContain('strict');
      expect(client.patch).toHaveBeenCalledWith(
        `/zones/${ZONE_ID}/settings/ssl`,
        { value: 'strict' },
      );
    });

    it('requires zone_id, setting_name, and value', async () => {
      const client = mockClient();

      const result = await handleZonesTool(
        'cloudflare_zone_setting_update',
        { zone_id: ZONE_ID, setting_name: 'ssl' },
        client,
      );

      expect(result.content[0].text).toContain('Error executing cloudflare_zone_setting_update');
    });
  });

  describe('unknown tool', () => {
    it('returns unknown tool message for unrecognized tool name', async () => {
      const client = mockClient();

      const result = await handleZonesTool('cloudflare_zone_unknown', {}, client);

      expect(result.content[0].text).toContain('Unknown zones tool');
    });
  });

  describe('API error handling', () => {
    it('returns error message when API call fails', async () => {
      const client = mockClient({
        get: vi.fn().mockRejectedValue(new Error('API request failed')),
      });

      const result = await handleZonesTool('cloudflare_zone_list', {}, client);

      expect(result.content[0].text).toContain('Error executing cloudflare_zone_list');
      expect(result.content[0].text).toContain('API request failed');
    });
  });
});
