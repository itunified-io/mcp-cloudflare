import { describe, it, expect, vi } from 'vitest';
import { workersToolDefinitions, handleWorkersTool } from '../../src/tools/workers.js';
import type { CloudflareClient } from '../../src/client/cloudflare-client.js';

const ACCOUNT_ID = '00000000000000000000000000000001';
const ZONE_ID = '00000000000000000000000000000002';

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

describe('Workers Tool Definitions', () => {
  it('exports 5 tool definitions', () => {
    expect(workersToolDefinitions).toHaveLength(5);
  });

  it('all tools have cloudflare_worker_ prefix', () => {
    for (const tool of workersToolDefinitions) {
      expect(tool.name).toMatch(/^cloudflare_worker_/);
    }
  });

  it('all tools have non-empty descriptions', () => {
    for (const tool of workersToolDefinitions) {
      expect(tool.description).toBeTruthy();
      expect(tool.description.length).toBeGreaterThan(10);
    }
  });

  it('all tools have inputSchema with type object', () => {
    for (const tool of workersToolDefinitions) {
      expect(tool.inputSchema).toBeDefined();
      expect(tool.inputSchema.type).toBe('object');
    }
  });
});

// ---------------------------------------------------------------------------
// handleWorkersTool
// ---------------------------------------------------------------------------

describe('handleWorkersTool', () => {
  describe('cloudflare_worker_list', () => {
    it('lists worker scripts', async () => {
      const mockScripts = [{ id: 'my-worker', etag: 'abc', handlers: ['fetch'] }];
      const client = mockClient({ get: vi.fn().mockResolvedValue(mockScripts) });

      const result = await handleWorkersTool('cloudflare_worker_list', {}, client);

      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toContain('my-worker');
      expect(client.get).toHaveBeenCalledWith(
        `/accounts/${ACCOUNT_ID}/workers/scripts`,
      );
    });

    it('returns error when account_id is missing', async () => {
      const client = mockClient({ getAccountId: vi.fn().mockReturnValue(undefined) });

      const result = await handleWorkersTool('cloudflare_worker_list', {}, client);

      expect(result.content[0].text).toContain('CLOUDFLARE_ACCOUNT_ID');
    });
  });

  describe('cloudflare_worker_deploy', () => {
    it('deploys a worker script', async () => {
      const mockResult = { id: 'my-worker', etag: 'def' };
      const client = mockClient({ putForm: vi.fn().mockResolvedValue(mockResult) });

      const result = await handleWorkersTool(
        'cloudflare_worker_deploy',
        {
          script_name: 'my-worker',
          script_content: 'export default { fetch() { return new Response("ok"); } }',
          compatibility_date: '2026-03-15',
        },
        client,
      );

      expect(result.content[0].text).toContain('my-worker');
      expect(client.putForm).toHaveBeenCalledWith(
        `/accounts/${ACCOUNT_ID}/workers/scripts/my-worker`,
        expect.any(Object),
      );
    });

    it('requires script_name and script_content', async () => {
      const client = mockClient();

      const result = await handleWorkersTool('cloudflare_worker_deploy', {}, client);

      expect(result.content[0].text).toContain('Error executing cloudflare_worker_deploy');
    });

    it('rejects invalid script_name', async () => {
      const client = mockClient();

      const result = await handleWorkersTool(
        'cloudflare_worker_deploy',
        { script_name: 'INVALID_NAME', script_content: 'code', compatibility_date: '2026-03-15' },
        client,
      );

      expect(result.content[0].text).toContain('Error executing cloudflare_worker_deploy');
    });
  });

  describe('cloudflare_worker_delete', () => {
    it('deletes a worker script', async () => {
      const client = mockClient({ delete: vi.fn().mockResolvedValue({}) });

      await handleWorkersTool(
        'cloudflare_worker_delete',
        { script_name: 'old-worker' },
        client,
      );

      expect(client.delete).toHaveBeenCalledWith(
        `/accounts/${ACCOUNT_ID}/workers/scripts/old-worker`,
      );
    });

    it('requires script_name', async () => {
      const client = mockClient();

      const result = await handleWorkersTool('cloudflare_worker_delete', {}, client);

      expect(result.content[0].text).toContain('Error executing cloudflare_worker_delete');
    });
  });

  describe('cloudflare_worker_route_list', () => {
    it('lists worker routes for a zone', async () => {
      const mockRoutes = [{ id: 'route1', pattern: '*.example.com/*', script: 'my-worker' }];
      const client = mockClient({ get: vi.fn().mockResolvedValue(mockRoutes) });

      const result = await handleWorkersTool(
        'cloudflare_worker_route_list',
        { zone_id: 'example.com' },
        client,
      );

      expect(result.content[0].text).toContain('my-worker');
      expect(client.resolveZoneId).toHaveBeenCalledWith('example.com');
      expect(client.get).toHaveBeenCalledWith(
        `/zones/${ZONE_ID}/workers/routes`,
      );
    });

    it('requires zone_id', async () => {
      const client = mockClient();

      const result = await handleWorkersTool('cloudflare_worker_route_list', {}, client);

      expect(result.content[0].text).toContain('Error executing cloudflare_worker_route_list');
    });
  });

  describe('cloudflare_worker_route_create', () => {
    it('creates a worker route', async () => {
      const mockRoute = { id: 'route2', pattern: 'api.example.com/*', script: 'api-worker' };
      const client = mockClient({ post: vi.fn().mockResolvedValue(mockRoute) });

      const result = await handleWorkersTool(
        'cloudflare_worker_route_create',
        { zone_id: 'example.com', pattern: 'api.example.com/*', script: 'api-worker' },
        client,
      );

      expect(result.content[0].text).toContain('api-worker');
      expect(client.resolveZoneId).toHaveBeenCalledWith('example.com');
      expect(client.post).toHaveBeenCalledWith(
        `/zones/${ZONE_ID}/workers/routes`,
        { pattern: 'api.example.com/*', script: 'api-worker' },
      );
    });

    it('requires zone_id, pattern, and script', async () => {
      const client = mockClient();

      const result = await handleWorkersTool(
        'cloudflare_worker_route_create',
        { zone_id: 'example.com' },
        client,
      );

      expect(result.content[0].text).toContain('Error executing cloudflare_worker_route_create');
    });
  });

  describe('unknown tool', () => {
    it('returns unknown tool message for unrecognized tool name', async () => {
      const client = mockClient();

      const result = await handleWorkersTool('cloudflare_worker_unknown', {}, client);

      expect(result.content[0].text).toContain('Unknown Workers tool');
    });
  });

  describe('API error handling', () => {
    it('returns error message when API call fails', async () => {
      const client = mockClient({
        get: vi.fn().mockRejectedValue(new Error('API request failed')),
      });

      const result = await handleWorkersTool('cloudflare_worker_list', {}, client);

      expect(result.content[0].text).toContain('Error executing cloudflare_worker_list');
      expect(result.content[0].text).toContain('API request failed');
    });
  });
});
