import { describe, it, expect, vi } from 'vitest';
import { r2ToolDefinitions, handleR2Tool } from '../../src/tools/r2.js';
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
    graphql: vi.fn().mockResolvedValue({}),
    getAccountId: vi.fn().mockReturnValue(ACCOUNT_ID),
    ...overrides,
  } as unknown as CloudflareClient;
}

// ---------------------------------------------------------------------------
// Tool definitions
// ---------------------------------------------------------------------------

describe('R2 Tool Definitions', () => {
  it('exports 10 tool definitions', () => {
    expect(r2ToolDefinitions).toHaveLength(10);
  });

  it('all tools have cloudflare_r2_ prefix', () => {
    for (const tool of r2ToolDefinitions) {
      expect(tool.name).toMatch(/^cloudflare_r2_/);
    }
  });

  it('all tools have non-empty descriptions', () => {
    for (const tool of r2ToolDefinitions) {
      expect(tool.description).toBeTruthy();
      expect(tool.description.length).toBeGreaterThan(10);
    }
  });

  it('all tools have inputSchema with type object', () => {
    for (const tool of r2ToolDefinitions) {
      expect(tool.inputSchema).toBeDefined();
      expect(tool.inputSchema.type).toBe('object');
    }
  });
});

// ---------------------------------------------------------------------------
// handleR2Tool — Bucket operations
// ---------------------------------------------------------------------------

describe('handleR2Tool', () => {
  describe('cloudflare_r2_bucket_list', () => {
    it('lists buckets with no filters', async () => {
      const mockBuckets = {
        buckets: [
          { name: 'assets-itunified-de', creation_date: '2026-03-16T00:00:00Z' },
          { name: 'assets-itunified-io', creation_date: '2026-03-16T00:00:00Z' },
        ],
      };
      const client = mockClient({ get: vi.fn().mockResolvedValue(mockBuckets) });

      const result = await handleR2Tool('cloudflare_r2_bucket_list', {}, client);

      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toContain('assets-itunified-de');
      expect(client.get).toHaveBeenCalledWith(
        `/accounts/${ACCOUNT_ID}/r2/buckets`,
        {},
      );
    });

    it('passes filter and pagination params', async () => {
      const client = mockClient({ get: vi.fn().mockResolvedValue({ buckets: [] }) });

      await handleR2Tool('cloudflare_r2_bucket_list', {
        name_contains: 'assets',
        per_page: 50,
        direction: 'desc',
        order: 'name',
      }, client);

      expect(client.get).toHaveBeenCalledWith(
        `/accounts/${ACCOUNT_ID}/r2/buckets`,
        { name_contains: 'assets', per_page: 50, direction: 'desc', order: 'name' },
      );
    });

    it('returns error when account_id is missing', async () => {
      const client = mockClient({ getAccountId: vi.fn().mockReturnValue(undefined) });

      const result = await handleR2Tool('cloudflare_r2_bucket_list', {}, client);

      expect(result.content[0].text).toContain('CLOUDFLARE_ACCOUNT_ID');
    });
  });

  describe('cloudflare_r2_bucket_create', () => {
    it('creates a bucket with name only', async () => {
      const mockBucket = { name: 'assets-itunified-de', creation_date: '2026-03-16T00:00:00Z' };
      const client = mockClient({ post: vi.fn().mockResolvedValue(mockBucket) });

      const result = await handleR2Tool(
        'cloudflare_r2_bucket_create',
        { name: 'assets-itunified-de' },
        client,
      );

      expect(result.content[0].text).toContain('assets-itunified-de');
      expect(client.post).toHaveBeenCalledWith(
        `/accounts/${ACCOUNT_ID}/r2/buckets`,
        { name: 'assets-itunified-de' },
      );
    });

    it('creates a bucket with location hint', async () => {
      const client = mockClient({ post: vi.fn().mockResolvedValue({ name: 'my-bucket' }) });

      await handleR2Tool(
        'cloudflare_r2_bucket_create',
        { name: 'my-bucket', location_hint: 'weur' },
        client,
      );

      expect(client.post).toHaveBeenCalledWith(
        `/accounts/${ACCOUNT_ID}/r2/buckets`,
        { name: 'my-bucket', locationHint: 'weur' },
      );
    });

    it('requires name parameter', async () => {
      const client = mockClient();

      const result = await handleR2Tool('cloudflare_r2_bucket_create', {}, client);

      expect(result.content[0].text).toContain('Error executing cloudflare_r2_bucket_create');
    });

    it('rejects invalid bucket name (too short)', async () => {
      const client = mockClient();

      const result = await handleR2Tool(
        'cloudflare_r2_bucket_create',
        { name: 'ab' },
        client,
      );

      expect(result.content[0].text).toContain('Error executing cloudflare_r2_bucket_create');
    });

    it('rejects bucket name starting with hyphen', async () => {
      const client = mockClient();

      const result = await handleR2Tool(
        'cloudflare_r2_bucket_create',
        { name: '-invalid-name' },
        client,
      );

      expect(result.content[0].text).toContain('Error executing cloudflare_r2_bucket_create');
    });

    it('rejects invalid location hint', async () => {
      const client = mockClient();

      const result = await handleR2Tool(
        'cloudflare_r2_bucket_create',
        { name: 'valid-bucket', location_hint: 'invalid' },
        client,
      );

      expect(result.content[0].text).toContain('Error executing cloudflare_r2_bucket_create');
    });
  });

  describe('cloudflare_r2_bucket_get', () => {
    it('gets bucket details', async () => {
      const mockBucket = {
        name: 'assets-itunified-de',
        creation_date: '2026-03-16T00:00:00Z',
        location: 'WEUR',
      };
      const client = mockClient({ get: vi.fn().mockResolvedValue(mockBucket) });

      const result = await handleR2Tool(
        'cloudflare_r2_bucket_get',
        { bucket_name: 'assets-itunified-de' },
        client,
      );

      expect(result.content[0].text).toContain('assets-itunified-de');
      expect(result.content[0].text).toContain('WEUR');
      expect(client.get).toHaveBeenCalledWith(
        `/accounts/${ACCOUNT_ID}/r2/buckets/assets-itunified-de`,
      );
    });
  });

  describe('cloudflare_r2_bucket_delete', () => {
    it('deletes a bucket', async () => {
      const client = mockClient({ delete: vi.fn().mockResolvedValue({}) });

      await handleR2Tool(
        'cloudflare_r2_bucket_delete',
        { bucket_name: 'old-bucket' },
        client,
      );

      expect(client.delete).toHaveBeenCalledWith(
        `/accounts/${ACCOUNT_ID}/r2/buckets/old-bucket`,
      );
    });

    it('rejects invalid bucket name', async () => {
      const client = mockClient();

      const result = await handleR2Tool(
        'cloudflare_r2_bucket_delete',
        { bucket_name: 'X' },
        client,
      );

      expect(result.content[0].text).toContain('Error executing cloudflare_r2_bucket_delete');
    });
  });

  // ---------------------------------------------------------------------------
  // Object operations
  // ---------------------------------------------------------------------------

  describe('cloudflare_r2_object_list', () => {
    it('lists objects in a bucket', async () => {
      const mockObjects = {
        objects: [
          { key: 'brand/logo.svg', size: 2048, last_modified: '2026-03-16T00:00:00Z' },
          { key: 'hero/hero-main.jpg', size: 524288, last_modified: '2026-03-16T00:00:00Z' },
        ],
      };
      const client = mockClient({ get: vi.fn().mockResolvedValue(mockObjects) });

      const result = await handleR2Tool(
        'cloudflare_r2_object_list',
        { bucket_name: 'assets-itunified-de' },
        client,
      );

      expect(result.content[0].text).toContain('logo.svg');
      expect(client.get).toHaveBeenCalledWith(
        `/accounts/${ACCOUNT_ID}/r2/buckets/assets-itunified-de/objects`,
        {},
      );
    });

    it('passes prefix and delimiter filters', async () => {
      const client = mockClient({ get: vi.fn().mockResolvedValue({ objects: [] }) });

      await handleR2Tool(
        'cloudflare_r2_object_list',
        { bucket_name: 'assets-itunified-de', prefix: 'brand/', delimiter: '/', per_page: 100 },
        client,
      );

      expect(client.get).toHaveBeenCalledWith(
        `/accounts/${ACCOUNT_ID}/r2/buckets/assets-itunified-de/objects`,
        { prefix: 'brand/', delimiter: '/', per_page: 100 },
      );
    });
  });

  describe('cloudflare_r2_object_get', () => {
    it('gets object metadata', async () => {
      const mockMeta = {
        key: 'brand/logo.svg',
        size: 2048,
        etag: '"abc123"',
        http_metadata: { content_type: 'image/svg+xml' },
        last_modified: '2026-03-16T00:00:00Z',
      };
      const client = mockClient({ get: vi.fn().mockResolvedValue(mockMeta) });

      const result = await handleR2Tool(
        'cloudflare_r2_object_get',
        { bucket_name: 'assets-itunified-de', object_key: 'brand/logo.svg' },
        client,
      );

      expect(result.content[0].text).toContain('logo.svg');
      expect(result.content[0].text).toContain('image/svg+xml');
      expect(client.get).toHaveBeenCalledWith(
        `/accounts/${ACCOUNT_ID}/r2/buckets/assets-itunified-de/objects/brand/logo.svg`,
      );
    });

    it('requires both bucket_name and object_key', async () => {
      const client = mockClient();

      const result = await handleR2Tool(
        'cloudflare_r2_object_get',
        { bucket_name: 'assets-itunified-de' },
        client,
      );

      expect(result.content[0].text).toContain('Error executing cloudflare_r2_object_get');
    });
  });

  describe('cloudflare_r2_object_delete', () => {
    it('deletes an object', async () => {
      const client = mockClient({ delete: vi.fn().mockResolvedValue({}) });

      await handleR2Tool(
        'cloudflare_r2_object_delete',
        { bucket_name: 'assets-itunified-de', object_key: 'old-file.txt' },
        client,
      );

      expect(client.delete).toHaveBeenCalledWith(
        `/accounts/${ACCOUNT_ID}/r2/buckets/assets-itunified-de/objects/old-file.txt`,
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Custom domain operations
  // ---------------------------------------------------------------------------

  describe('cloudflare_r2_bucket_domain_list', () => {
    it('lists custom domains for a bucket', async () => {
      const mockDomains = {
        domains: [
          { domain: 'assets.example.com', zone_id: '00000000000000000000000000000002', status: 'active' },
        ],
      };
      const client = mockClient({ get: vi.fn().mockResolvedValue(mockDomains) });

      const result = await handleR2Tool(
        'cloudflare_r2_bucket_domain_list',
        { bucket_name: 'assets-itunified-de' },
        client,
      );

      expect(result.content[0].text).toContain('assets.example.com');
      expect(client.get).toHaveBeenCalledWith(
        `/accounts/${ACCOUNT_ID}/r2/buckets/assets-itunified-de/custom_domains`,
      );
    });
  });

  describe('cloudflare_r2_bucket_domain_add', () => {
    it('attaches a custom domain to a bucket', async () => {
      const mockResult = { domain: 'assets.example.com', status: 'pending' };
      const client = mockClient({ put: vi.fn().mockResolvedValue(mockResult) });

      const result = await handleR2Tool(
        'cloudflare_r2_bucket_domain_add',
        { bucket_name: 'assets-itunified-de', domain: 'assets.example.com' },
        client,
      );

      expect(result.content[0].text).toContain('assets.example.com');
      expect(client.put).toHaveBeenCalledWith(
        `/accounts/${ACCOUNT_ID}/r2/buckets/assets-itunified-de/custom_domains`,
        { domain: 'assets.example.com' },
      );
    });

    it('requires domain parameter', async () => {
      const client = mockClient();

      const result = await handleR2Tool(
        'cloudflare_r2_bucket_domain_add',
        { bucket_name: 'assets-itunified-de' },
        client,
      );

      expect(result.content[0].text).toContain('Error executing cloudflare_r2_bucket_domain_add');
    });
  });

  describe('cloudflare_r2_bucket_domain_remove', () => {
    it('removes a custom domain from a bucket', async () => {
      const client = mockClient({ delete: vi.fn().mockResolvedValue({}) });

      await handleR2Tool(
        'cloudflare_r2_bucket_domain_remove',
        { bucket_name: 'assets-itunified-de', domain: 'assets.example.com' },
        client,
      );

      expect(client.delete).toHaveBeenCalledWith(
        `/accounts/${ACCOUNT_ID}/r2/buckets/assets-itunified-de/custom_domains/assets.example.com`,
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Edge cases
  // ---------------------------------------------------------------------------

  describe('unknown tool', () => {
    it('returns unknown tool message for unrecognized tool name', async () => {
      const client = mockClient();

      const result = await handleR2Tool('cloudflare_r2_unknown', {}, client);

      expect(result.content[0].text).toContain('Unknown R2 tool');
    });
  });

  describe('API error handling', () => {
    it('returns error message when API call fails', async () => {
      const client = mockClient({
        get: vi.fn().mockRejectedValue(new Error('API request failed')),
      });

      const result = await handleR2Tool('cloudflare_r2_bucket_list', {}, client);

      expect(result.content[0].text).toContain('Error executing cloudflare_r2_bucket_list');
      expect(result.content[0].text).toContain('API request failed');
    });

    it('handles non-Error thrown values', async () => {
      const client = mockClient({
        get: vi.fn().mockRejectedValue('string error'),
      });

      const result = await handleR2Tool('cloudflare_r2_bucket_list', {}, client);

      expect(result.content[0].text).toContain('Unknown error');
    });
  });
});
