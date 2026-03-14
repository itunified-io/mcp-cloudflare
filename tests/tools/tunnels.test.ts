import { describe, it, expect, vi } from 'vitest';
import { tunnelsToolDefinitions, handleTunnelsTool } from '../../src/tools/tunnels.js';
import type { CloudflareClient } from '../../src/client/cloudflare-client.js';

const ACCOUNT_ID = '00000000000000000000000000000001';
const TUNNEL_ID = '00000000-0000-0000-0000-000000000001';

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
    graphql: vi.fn().mockResolvedValue({}),
    getAccountId: vi.fn().mockReturnValue(ACCOUNT_ID),
    ...overrides,
  } as unknown as CloudflareClient;
}

// ---------------------------------------------------------------------------
// Tool definitions
// ---------------------------------------------------------------------------

describe('Tunnels Tool Definitions', () => {
  it('exports 6 tool definitions', () => {
    expect(tunnelsToolDefinitions).toHaveLength(6);
  });

  it('all tools have cloudflare_tunnel_ prefix', () => {
    for (const tool of tunnelsToolDefinitions) {
      expect(tool.name).toMatch(/^cloudflare_tunnel_/);
    }
  });

  it('all tools have non-empty descriptions', () => {
    for (const tool of tunnelsToolDefinitions) {
      expect(tool.description).toBeTruthy();
      expect(tool.description.length).toBeGreaterThan(10);
    }
  });

  it('all tools have inputSchema with type object', () => {
    for (const tool of tunnelsToolDefinitions) {
      expect(tool.inputSchema).toBeDefined();
      expect(tool.inputSchema.type).toBe('object');
    }
  });
});

// ---------------------------------------------------------------------------
// handleTunnelsTool
// ---------------------------------------------------------------------------

describe('handleTunnelsTool', () => {
  describe('cloudflare_tunnel_list', () => {
    it('lists tunnels with no filters', async () => {
      const mockTunnels = [{ id: TUNNEL_ID, name: 'test-tunnel', status: 'healthy' }];
      const client = mockClient({ get: vi.fn().mockResolvedValue(mockTunnels) });

      const result = await handleTunnelsTool('cloudflare_tunnel_list', {}, client);

      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toContain('test-tunnel');
      expect(client.get).toHaveBeenCalledWith(
        `/accounts/${ACCOUNT_ID}/cfd_tunnel`,
        {},
      );
    });

    it('passes filters to API', async () => {
      const client = mockClient({ get: vi.fn().mockResolvedValue([]) });

      await handleTunnelsTool(
        'cloudflare_tunnel_list',
        { name: 'my-tunnel', is_deleted: false, page: 1, per_page: 10 },
        client,
      );

      expect(client.get).toHaveBeenCalledWith(`/accounts/${ACCOUNT_ID}/cfd_tunnel`, {
        name: 'my-tunnel',
        is_deleted: false,
        page: 1,
        per_page: 10,
      });
    });

    it('returns error when account_id is missing', async () => {
      const client = mockClient({ getAccountId: vi.fn().mockReturnValue(undefined) });

      const result = await handleTunnelsTool('cloudflare_tunnel_list', {}, client);

      expect(result.content[0].text).toContain('CLOUDFLARE_ACCOUNT_ID');
    });
  });

  describe('cloudflare_tunnel_get', () => {
    it('gets a tunnel by ID', async () => {
      const mockTunnel = { id: TUNNEL_ID, name: 'test-tunnel', status: 'healthy' };
      const client = mockClient({ get: vi.fn().mockResolvedValue(mockTunnel) });

      const result = await handleTunnelsTool(
        'cloudflare_tunnel_get',
        { tunnel_id: TUNNEL_ID },
        client,
      );

      expect(result.content[0].text).toContain('test-tunnel');
      expect(client.get).toHaveBeenCalledWith(
        `/accounts/${ACCOUNT_ID}/cfd_tunnel/${TUNNEL_ID}`,
      );
    });

    it('requires tunnel_id parameter', async () => {
      const client = mockClient();

      const result = await handleTunnelsTool('cloudflare_tunnel_get', {}, client);

      expect(result.content[0].text).toContain('Error executing cloudflare_tunnel_get');
    });

    it('rejects invalid tunnel_id (not a UUID)', async () => {
      const client = mockClient();

      const result = await handleTunnelsTool(
        'cloudflare_tunnel_get',
        { tunnel_id: 'not-a-uuid' },
        client,
      );

      expect(result.content[0].text).toContain('Error executing cloudflare_tunnel_get');
    });
  });

  describe('cloudflare_tunnel_create', () => {
    it('creates a tunnel with auto-generated secret', async () => {
      const mockTunnel = { id: TUNNEL_ID, name: 'new-tunnel' };
      const client = mockClient({ post: vi.fn().mockResolvedValue(mockTunnel) });

      const result = await handleTunnelsTool(
        'cloudflare_tunnel_create',
        { name: 'new-tunnel' },
        client,
      );

      expect(result.content[0].text).toContain('new-tunnel');
      expect(client.post).toHaveBeenCalledWith(
        `/accounts/${ACCOUNT_ID}/cfd_tunnel`,
        expect.objectContaining({
          name: 'new-tunnel',
          tunnel_secret: expect.any(String),
        }),
      );
      // Verify secret is base64-encoded 32 bytes
      const callArgs = (client.post as ReturnType<typeof vi.fn>).mock.calls[0][1] as Record<string, string>;
      const secret = callArgs['tunnel_secret'];
      expect(Buffer.from(secret, 'base64').length).toBe(32);
    });

    it('requires name parameter', async () => {
      const client = mockClient();

      const result = await handleTunnelsTool('cloudflare_tunnel_create', {}, client);

      expect(result.content[0].text).toContain('Error executing cloudflare_tunnel_create');
    });
  });

  describe('cloudflare_tunnel_delete', () => {
    it('deletes a tunnel by ID', async () => {
      const client = mockClient({ delete: vi.fn().mockResolvedValue({}) });

      await handleTunnelsTool('cloudflare_tunnel_delete', { tunnel_id: TUNNEL_ID }, client);

      expect(client.delete).toHaveBeenCalledWith(
        `/accounts/${ACCOUNT_ID}/cfd_tunnel/${TUNNEL_ID}`,
      );
    });
  });

  describe('cloudflare_tunnel_config_get', () => {
    it('gets tunnel configuration', async () => {
      const mockConfig = { config: { ingress: [{ service: 'http_status:404' }] } };
      const client = mockClient({ get: vi.fn().mockResolvedValue(mockConfig) });

      const result = await handleTunnelsTool(
        'cloudflare_tunnel_config_get',
        { tunnel_id: TUNNEL_ID },
        client,
      );

      expect(result.content[0].text).toContain('http_status:404');
      expect(client.get).toHaveBeenCalledWith(
        `/accounts/${ACCOUNT_ID}/cfd_tunnel/${TUNNEL_ID}/configurations`,
      );
    });
  });

  describe('cloudflare_tunnel_config_update', () => {
    it('updates tunnel ingress configuration', async () => {
      const config = {
        ingress: [
          { hostname: 'app.example.com', service: 'http://localhost:8080' },
          { service: 'http_status:404' },
        ],
      };
      const client = mockClient({ put: vi.fn().mockResolvedValue({ config }) });

      await handleTunnelsTool(
        'cloudflare_tunnel_config_update',
        { tunnel_id: TUNNEL_ID, config },
        client,
      );

      expect(client.put).toHaveBeenCalledWith(
        `/accounts/${ACCOUNT_ID}/cfd_tunnel/${TUNNEL_ID}/configurations`,
        { config },
      );
    });

    it('requires at least one ingress rule', async () => {
      const client = mockClient();

      const result = await handleTunnelsTool(
        'cloudflare_tunnel_config_update',
        { tunnel_id: TUNNEL_ID, config: { ingress: [] } },
        client,
      );

      expect(result.content[0].text).toContain('Error executing cloudflare_tunnel_config_update');
    });
  });

  describe('unknown tool', () => {
    it('returns unknown tool message for unrecognized tool name', async () => {
      const client = mockClient();

      const result = await handleTunnelsTool('cloudflare_tunnel_unknown', {}, client);

      expect(result.content[0].text).toContain('Unknown tunnels tool');
    });
  });

  describe('API error handling', () => {
    it('returns error message when API call fails', async () => {
      const client = mockClient({
        get: vi.fn().mockRejectedValue(new Error('API request failed')),
      });

      const result = await handleTunnelsTool('cloudflare_tunnel_list', {}, client);

      expect(result.content[0].text).toContain('Error executing cloudflare_tunnel_list');
      expect(result.content[0].text).toContain('API request failed');
    });
  });
});
