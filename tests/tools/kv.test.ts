import { describe, it, expect, vi } from 'vitest';
import { kvToolDefinitions, handleKvTool } from '../../src/tools/kv.js';
import type { CloudflareClient } from '../../src/client/cloudflare-client.js';

const ACCOUNT_ID = '00000000000000000000000000000001';
const NAMESPACE_ID = '00000000000000000000000000000099';

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

describe('KV Tool Definitions', () => {
  it('exports 7 tool definitions', () => {
    expect(kvToolDefinitions).toHaveLength(7);
  });

  it('all tools have cloudflare_kv_ prefix', () => {
    for (const tool of kvToolDefinitions) {
      expect(tool.name).toMatch(/^cloudflare_kv_/);
    }
  });

  it('all tools have non-empty descriptions', () => {
    for (const tool of kvToolDefinitions) {
      expect(tool.description).toBeTruthy();
      expect(tool.description.length).toBeGreaterThan(10);
    }
  });

  it('all tools have inputSchema with type object', () => {
    for (const tool of kvToolDefinitions) {
      expect(tool.inputSchema).toBeDefined();
      expect(tool.inputSchema.type).toBe('object');
    }
  });
});

// ---------------------------------------------------------------------------
// handleKvTool
// ---------------------------------------------------------------------------

describe('handleKvTool', () => {
  describe('cloudflare_kv_namespace_list', () => {
    it('lists namespaces with no filters', async () => {
      const mockNs = [{ id: NAMESPACE_ID, title: 'MY_KV', supports_url_encoding: true }];
      const client = mockClient({ get: vi.fn().mockResolvedValue(mockNs) });

      const result = await handleKvTool('cloudflare_kv_namespace_list', {}, client);

      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toContain('MY_KV');
      expect(client.get).toHaveBeenCalledWith(
        `/accounts/${ACCOUNT_ID}/storage/kv/namespaces`,
        {},
      );
    });

    it('passes pagination params', async () => {
      const client = mockClient({ get: vi.fn().mockResolvedValue([]) });

      await handleKvTool('cloudflare_kv_namespace_list', { page: 2, per_page: 50 }, client);

      expect(client.get).toHaveBeenCalledWith(
        `/accounts/${ACCOUNT_ID}/storage/kv/namespaces`,
        { page: 2, per_page: 50 },
      );
    });

    it('returns error when account_id is missing', async () => {
      const client = mockClient({ getAccountId: vi.fn().mockReturnValue(undefined) });

      const result = await handleKvTool('cloudflare_kv_namespace_list', {}, client);

      expect(result.content[0].text).toContain('CLOUDFLARE_ACCOUNT_ID');
    });
  });

  describe('cloudflare_kv_namespace_create', () => {
    it('creates a namespace', async () => {
      const mockNs = { id: NAMESPACE_ID, title: 'NEW_KV' };
      const client = mockClient({ post: vi.fn().mockResolvedValue(mockNs) });

      const result = await handleKvTool(
        'cloudflare_kv_namespace_create',
        { title: 'NEW_KV' },
        client,
      );

      expect(result.content[0].text).toContain('NEW_KV');
      expect(client.post).toHaveBeenCalledWith(
        `/accounts/${ACCOUNT_ID}/storage/kv/namespaces`,
        { title: 'NEW_KV' },
      );
    });

    it('requires title parameter', async () => {
      const client = mockClient();

      const result = await handleKvTool('cloudflare_kv_namespace_create', {}, client);

      expect(result.content[0].text).toContain('Error executing cloudflare_kv_namespace_create');
    });
  });

  describe('cloudflare_kv_namespace_delete', () => {
    it('deletes a namespace by ID', async () => {
      const client = mockClient({ delete: vi.fn().mockResolvedValue({}) });

      await handleKvTool(
        'cloudflare_kv_namespace_delete',
        { namespace_id: NAMESPACE_ID },
        client,
      );

      expect(client.delete).toHaveBeenCalledWith(
        `/accounts/${ACCOUNT_ID}/storage/kv/namespaces/${NAMESPACE_ID}`,
      );
    });

    it('rejects invalid namespace_id', async () => {
      const client = mockClient();

      const result = await handleKvTool(
        'cloudflare_kv_namespace_delete',
        { namespace_id: 'bad' },
        client,
      );

      expect(result.content[0].text).toContain('Error executing cloudflare_kv_namespace_delete');
    });
  });

  describe('cloudflare_kv_list_keys', () => {
    it('lists keys in a namespace', async () => {
      const mockKeys = [{ name: 'key1' }, { name: 'key2' }];
      const client = mockClient({ get: vi.fn().mockResolvedValue(mockKeys) });

      const result = await handleKvTool(
        'cloudflare_kv_list_keys',
        { namespace_id: NAMESPACE_ID },
        client,
      );

      expect(result.content[0].text).toContain('key1');
      expect(client.get).toHaveBeenCalledWith(
        `/accounts/${ACCOUNT_ID}/storage/kv/namespaces/${NAMESPACE_ID}/keys`,
        {},
      );
    });

    it('passes optional filters', async () => {
      const client = mockClient({ get: vi.fn().mockResolvedValue([]) });

      await handleKvTool(
        'cloudflare_kv_list_keys',
        { namespace_id: NAMESPACE_ID, prefix: 'config:', limit: 50, cursor: 'abc123' },
        client,
      );

      expect(client.get).toHaveBeenCalledWith(
        `/accounts/${ACCOUNT_ID}/storage/kv/namespaces/${NAMESPACE_ID}/keys`,
        { prefix: 'config:', limit: 50, cursor: 'abc123' },
      );
    });
  });

  describe('cloudflare_kv_read', () => {
    it('reads a key value', async () => {
      const client = mockClient({ getRaw: vi.fn().mockResolvedValue('hello world') });

      const result = await handleKvTool(
        'cloudflare_kv_read',
        { namespace_id: NAMESPACE_ID, key_name: 'my-key' },
        client,
      );

      expect(result.content[0].text).toContain('hello world');
      expect(client.getRaw).toHaveBeenCalledWith(
        `/accounts/${ACCOUNT_ID}/storage/kv/namespaces/${NAMESPACE_ID}/values/my-key`,
      );
    });

    it('requires key_name parameter', async () => {
      const client = mockClient();

      const result = await handleKvTool(
        'cloudflare_kv_read',
        { namespace_id: NAMESPACE_ID },
        client,
      );

      expect(result.content[0].text).toContain('Error executing cloudflare_kv_read');
    });
  });

  describe('cloudflare_kv_write', () => {
    it('writes a key value', async () => {
      const client = mockClient({ putRaw: vi.fn().mockResolvedValue(undefined) });

      const result = await handleKvTool(
        'cloudflare_kv_write',
        { namespace_id: NAMESPACE_ID, key_name: 'my-key', value: 'hello' },
        client,
      );

      expect(result.content[0].text).toContain('success');
      expect(client.putRaw).toHaveBeenCalledWith(
        `/accounts/${ACCOUNT_ID}/storage/kv/namespaces/${NAMESPACE_ID}/values/my-key`,
        'hello',
      );
    });

    it('passes expiration_ttl as query param', async () => {
      const client = mockClient({ putRaw: vi.fn().mockResolvedValue(undefined) });

      await handleKvTool(
        'cloudflare_kv_write',
        { namespace_id: NAMESPACE_ID, key_name: 'ttl-key', value: 'data', expiration_ttl: 3600 },
        client,
      );

      // putRaw is called with a path that includes the query param
      const callPath = (client.putRaw as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(callPath).toContain('expiration_ttl=3600');
    });

    it('rejects expiration_ttl less than 60', async () => {
      const client = mockClient();

      const result = await handleKvTool(
        'cloudflare_kv_write',
        { namespace_id: NAMESPACE_ID, key_name: 'key', value: 'val', expiration_ttl: 10 },
        client,
      );

      expect(result.content[0].text).toContain('Error executing cloudflare_kv_write');
    });

    it('requires value parameter', async () => {
      const client = mockClient();

      const result = await handleKvTool(
        'cloudflare_kv_write',
        { namespace_id: NAMESPACE_ID, key_name: 'key' },
        client,
      );

      expect(result.content[0].text).toContain('Error executing cloudflare_kv_write');
    });
  });

  describe('cloudflare_kv_delete', () => {
    it('deletes a key', async () => {
      const client = mockClient({ delete: vi.fn().mockResolvedValue({}) });

      await handleKvTool(
        'cloudflare_kv_delete',
        { namespace_id: NAMESPACE_ID, key_name: 'old-key' },
        client,
      );

      expect(client.delete).toHaveBeenCalledWith(
        `/accounts/${ACCOUNT_ID}/storage/kv/namespaces/${NAMESPACE_ID}/values/old-key`,
      );
    });
  });

  describe('unknown tool', () => {
    it('returns unknown tool message for unrecognized tool name', async () => {
      const client = mockClient();

      const result = await handleKvTool('cloudflare_kv_unknown', {}, client);

      expect(result.content[0].text).toContain('Unknown KV tool');
    });
  });

  describe('API error handling', () => {
    it('returns error message when API call fails', async () => {
      const client = mockClient({
        get: vi.fn().mockRejectedValue(new Error('API request failed')),
      });

      const result = await handleKvTool('cloudflare_kv_namespace_list', {}, client);

      expect(result.content[0].text).toContain('Error executing cloudflare_kv_namespace_list');
      expect(result.content[0].text).toContain('API request failed');
    });
  });
});
