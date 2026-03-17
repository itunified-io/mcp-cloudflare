import { describe, it, expect, vi } from 'vitest';
import { dnsToolDefinitions, handleDnsTool } from '../../src/tools/dns.js';
import type { CloudflareClient } from '../../src/client/cloudflare-client.js';

const ZONE_ID = '00000000000000000000000000000001';
const ZONE_NAME = 'example.com';
const RECORD_ID = '00000000000000000000000000000002';

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

describe('DNS Tool Definitions', () => {
  it('exports 11 tool definitions', () => {
    expect(dnsToolDefinitions).toHaveLength(11);
  });

  it('all tools have cloudflare_dns_ or cloudflare_dnssec_ prefix', () => {
    for (const tool of dnsToolDefinitions) {
      expect(tool.name).toMatch(/^cloudflare_dns(sec)?_/);
    }
  });

  it('all tools have non-empty descriptions', () => {
    for (const tool of dnsToolDefinitions) {
      expect(tool.description).toBeTruthy();
      expect(tool.description.length).toBeGreaterThan(10);
    }
  });

  it('all tools have inputSchema with type object', () => {
    for (const tool of dnsToolDefinitions) {
      expect(tool.inputSchema).toBeDefined();
      expect(tool.inputSchema.type).toBe('object');
    }
  });
});

// ---------------------------------------------------------------------------
// handleDnsTool
// ---------------------------------------------------------------------------

describe('handleDnsTool', () => {
  describe('cloudflare_dns_list', () => {
    it('lists DNS records for a zone', async () => {
      const mockRecords = [{ id: RECORD_ID, name: 'www.example.com', type: 'A', content: '192.0.2.1' }];
      const client = mockClient({ get: vi.fn().mockResolvedValue(mockRecords) });

      const result = await handleDnsTool('cloudflare_dns_list', { zone_id: ZONE_ID }, client);

      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toContain('www.example.com');
      expect(client.get).toHaveBeenCalledWith(`/zones/${ZONE_ID}/dns_records`, {});
    });

    it('passes type filter to API', async () => {
      const client = mockClient({ get: vi.fn().mockResolvedValue([]) });

      await handleDnsTool('cloudflare_dns_list', { zone_id: ZONE_ID, type: 'MX' }, client);

      expect(client.get).toHaveBeenCalledWith(`/zones/${ZONE_ID}/dns_records`, { type: 'MX' });
    });

    it('passes pagination parameters to API', async () => {
      const client = mockClient({ get: vi.fn().mockResolvedValue([]) });

      await handleDnsTool('cloudflare_dns_list', { zone_id: ZONE_ID, page: 2, per_page: 50 }, client);

      expect(client.get).toHaveBeenCalledWith(`/zones/${ZONE_ID}/dns_records`, { page: 2, per_page: 50 });
    });

    it('rejects invalid record type via Zod', async () => {
      const client = mockClient();

      const result = await handleDnsTool('cloudflare_dns_list', { zone_id: ZONE_ID, type: 'INVALID' }, client);

      expect(result.content[0].text).toContain('Error executing cloudflare_dns_list');
    });

    it('requires zone_id parameter', async () => {
      const client = mockClient();

      const result = await handleDnsTool('cloudflare_dns_list', {}, client);

      expect(result.content[0].text).toContain('Error executing cloudflare_dns_list');
    });
  });

  describe('cloudflare_dns_get', () => {
    it('gets a single DNS record', async () => {
      const mockRecord = { id: RECORD_ID, name: 'www.example.com', type: 'A', content: '192.0.2.1' };
      const client = mockClient({ get: vi.fn().mockResolvedValue(mockRecord) });

      const result = await handleDnsTool(
        'cloudflare_dns_get',
        { zone_id: ZONE_ID, record_id: RECORD_ID },
        client,
      );

      expect(result.content[0].text).toContain(RECORD_ID);
      expect(client.get).toHaveBeenCalledWith(`/zones/${ZONE_ID}/dns_records/${RECORD_ID}`);
    });

    it('rejects invalid record_id format via Zod', async () => {
      const client = mockClient();

      const result = await handleDnsTool(
        'cloudflare_dns_get',
        { zone_id: ZONE_ID, record_id: 'not-a-hex-id' },
        client,
      );

      expect(result.content[0].text).toContain('Error executing cloudflare_dns_get');
    });
  });

  describe('cloudflare_dns_create', () => {
    it('creates an A record', async () => {
      const mockRecord = { id: RECORD_ID, type: 'A', name: 'www.example.com', content: '192.0.2.1' };
      const client = mockClient({ post: vi.fn().mockResolvedValue(mockRecord) });

      const result = await handleDnsTool('cloudflare_dns_create', {
        zone_id: ZONE_ID,
        type: 'A',
        name: 'www.example.com',
        content: '192.0.2.1',
      }, client);

      expect(result.content[0].text).toContain(RECORD_ID);
      expect(client.post).toHaveBeenCalledWith(
        `/zones/${ZONE_ID}/dns_records`,
        { type: 'A', name: 'www.example.com', content: '192.0.2.1' },
      );
    });

    it('creates an MX record with priority', async () => {
      const client = mockClient({ post: vi.fn().mockResolvedValue({ id: RECORD_ID }) });

      await handleDnsTool('cloudflare_dns_create', {
        zone_id: ZONE_ID,
        type: 'MX',
        name: 'example.com',
        content: 'mail.example.com',
        priority: 10,
      }, client);

      expect(client.post).toHaveBeenCalledWith(
        `/zones/${ZONE_ID}/dns_records`,
        { type: 'MX', name: 'example.com', content: 'mail.example.com', priority: 10 },
      );
    });

    it('creates a proxied record', async () => {
      const client = mockClient({ post: vi.fn().mockResolvedValue({ id: RECORD_ID }) });

      await handleDnsTool('cloudflare_dns_create', {
        zone_id: ZONE_ID,
        type: 'A',
        name: 'www.example.com',
        content: '192.0.2.1',
        proxied: true,
        ttl: 1,
      }, client);

      expect(client.post).toHaveBeenCalledWith(
        `/zones/${ZONE_ID}/dns_records`,
        { type: 'A', name: 'www.example.com', content: '192.0.2.1', proxied: true, ttl: 1 },
      );
    });

    it('rejects invalid TTL value via Zod', async () => {
      const client = mockClient();

      const result = await handleDnsTool('cloudflare_dns_create', {
        zone_id: ZONE_ID,
        type: 'A',
        name: 'www.example.com',
        content: '192.0.2.1',
        ttl: 30, // must be 1 or 60-86400
      }, client);

      expect(result.content[0].text).toContain('Error executing cloudflare_dns_create');
    });

    it('rejects missing required fields via Zod', async () => {
      const client = mockClient();

      const result = await handleDnsTool('cloudflare_dns_create', {
        zone_id: ZONE_ID,
        type: 'A',
        // missing name and content
      }, client);

      expect(result.content[0].text).toContain('Error executing cloudflare_dns_create');
    });
  });

  describe('cloudflare_dns_update', () => {
    it('updates a DNS record', async () => {
      const mockRecord = { id: RECORD_ID, type: 'A', name: 'www.example.com', content: '192.0.2.2' };
      const client = mockClient({ put: vi.fn().mockResolvedValue(mockRecord) });

      const result = await handleDnsTool('cloudflare_dns_update', {
        zone_id: ZONE_ID,
        record_id: RECORD_ID,
        type: 'A',
        name: 'www.example.com',
        content: '192.0.2.2',
      }, client);

      expect(result.content[0].text).toContain('192.0.2.2');
      expect(client.put).toHaveBeenCalledWith(
        `/zones/${ZONE_ID}/dns_records/${RECORD_ID}`,
        { type: 'A', name: 'www.example.com', content: '192.0.2.2' },
      );
    });

    it('requires record_id parameter', async () => {
      const client = mockClient();

      const result = await handleDnsTool('cloudflare_dns_update', {
        zone_id: ZONE_ID,
        type: 'A',
        name: 'www.example.com',
        content: '192.0.2.1',
      }, client);

      expect(result.content[0].text).toContain('Error executing cloudflare_dns_update');
    });
  });

  describe('cloudflare_dns_delete', () => {
    it('deletes a DNS record', async () => {
      const client = mockClient({ delete: vi.fn().mockResolvedValue({ id: RECORD_ID }) });

      const result = await handleDnsTool('cloudflare_dns_delete', {
        zone_id: ZONE_ID,
        record_id: RECORD_ID,
      }, client);

      expect(result.content[0].text).toContain(RECORD_ID);
      expect(client.delete).toHaveBeenCalledWith(`/zones/${ZONE_ID}/dns_records/${RECORD_ID}`);
    });

    it('rejects invalid record_id format', async () => {
      const client = mockClient();

      const result = await handleDnsTool('cloudflare_dns_delete', {
        zone_id: ZONE_ID,
        record_id: 'bad-id',
      }, client);

      expect(result.content[0].text).toContain('Error executing cloudflare_dns_delete');
    });
  });

  describe('cloudflare_dns_search', () => {
    it('searches DNS records by name pattern', async () => {
      const mockRecords = [{ id: RECORD_ID, name: 'mail.example.com', type: 'MX' }];
      const client = mockClient({ get: vi.fn().mockResolvedValue(mockRecords) });

      const result = await handleDnsTool('cloudflare_dns_search', {
        zone_id: ZONE_ID,
        name: 'mail',
      }, client);

      expect(result.content[0].text).toContain('mail.example.com');
      expect(client.get).toHaveBeenCalledWith(`/zones/${ZONE_ID}/dns_records`, { per_page: 5000 });
    });

    it('passes type filter when provided', async () => {
      const client = mockClient({ get: vi.fn().mockResolvedValue([]) });

      await handleDnsTool('cloudflare_dns_search', {
        zone_id: ZONE_ID,
        name: 'mail',
        type: 'MX',
      }, client);

      expect(client.get).toHaveBeenCalledWith(`/zones/${ZONE_ID}/dns_records`, { per_page: 5000, type: 'MX' });
    });
  });

  describe('cloudflare_dns_export', () => {
    it('exports zone as BIND text', async () => {
      const bindText = '$ORIGIN example.com.\n@ 300 IN A 192.0.2.1\n';
      const client = mockClient({ getRaw: vi.fn().mockResolvedValue(bindText) });

      const result = await handleDnsTool('cloudflare_dns_export', { zone_id: ZONE_ID }, client);

      expect(result.content[0].text).toContain('$ORIGIN');
      expect(client.getRaw).toHaveBeenCalledWith(`/zones/${ZONE_ID}/dns_records/export`);
    });

    it('returns raw text without JSON parsing', async () => {
      const client = mockClient({ getRaw: vi.fn().mockResolvedValue('raw bind text') });

      const result = await handleDnsTool('cloudflare_dns_export', { zone_id: ZONE_ID }, client);

      // Should NOT be JSON-stringified — returned as raw text
      expect(result.content[0].text).toBe('raw bind text');
    });
  });

  describe('cloudflare_dns_import', () => {
    it('imports BIND zone file content', async () => {
      const importResult = { recs_added: 5, total_records_parsed: 5 };
      const client = mockClient({ postForm: vi.fn().mockResolvedValue(importResult) });

      const bindContent = '$ORIGIN example.com.\n@ 300 IN A 192.0.2.1\n';

      const result = await handleDnsTool('cloudflare_dns_import', {
        zone_id: ZONE_ID,
        file_content: bindContent,
      }, client);

      expect(result.content[0].text).toContain('recs_added');
      expect(client.postForm).toHaveBeenCalled();
    });

    it('requires file_content parameter', async () => {
      const client = mockClient();

      const result = await handleDnsTool('cloudflare_dns_import', { zone_id: ZONE_ID }, client);

      expect(result.content[0].text).toContain('Error executing cloudflare_dns_import');
    });
  });

  describe('cloudflare_dnssec_status', () => {
    it('gets DNSSEC status for a zone', async () => {
      const dnssecResult = { status: 'active', ds: 'DS record data' };
      const client = mockClient({ get: vi.fn().mockResolvedValue(dnssecResult) });

      const result = await handleDnsTool('cloudflare_dnssec_status', { zone_id: ZONE_ID }, client);

      expect(result.content[0].text).toContain('active');
      expect(client.get).toHaveBeenCalledWith(`/zones/${ZONE_ID}/dnssec`);
    });
  });

  describe('cloudflare_dnssec_enable', () => {
    it('enables DNSSEC for a zone', async () => {
      const enableResult = { status: 'pending', ds: 'example.com. 3600 IN DS 2371 13 2 ...' };
      const client = mockClient({ post: vi.fn().mockResolvedValue(enableResult) });

      const result = await handleDnsTool('cloudflare_dnssec_enable', { zone_id: ZONE_ID }, client);

      expect(result.content[0].text).toContain('pending');
      expect(client.post).toHaveBeenCalledWith(`/zones/${ZONE_ID}/dnssec`, {});
    });
  });

  describe('cloudflare_dnssec_disable', () => {
    it('disables DNSSEC for a zone', async () => {
      const disableResult = { status: 'disabled' };
      const client = mockClient({ patch: vi.fn().mockResolvedValue(disableResult) });

      const result = await handleDnsTool('cloudflare_dnssec_disable', { zone_id: ZONE_ID }, client);

      expect(result.content[0].text).toContain('disabled');
      expect(client.patch).toHaveBeenCalledWith(`/zones/${ZONE_ID}/dnssec`, { status: 'disabled' });
    });
  });

  describe('unknown tool', () => {
    it('returns unknown tool message', async () => {
      const client = mockClient();

      const result = await handleDnsTool('cloudflare_dns_unknown', {}, client);

      expect(result.content[0].text).toContain('Unknown DNS tool');
    });
  });

  describe('API error handling', () => {
    it('returns error message when API call fails', async () => {
      const client = mockClient({
        get: vi.fn().mockRejectedValue(new Error('Network error')),
      });

      const result = await handleDnsTool('cloudflare_dns_list', { zone_id: ZONE_ID }, client);

      expect(result.content[0].text).toContain('Error executing cloudflare_dns_list');
      expect(result.content[0].text).toContain('Network error');
    });
  });
});
