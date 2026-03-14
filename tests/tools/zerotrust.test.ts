import { describe, it, expect, vi } from 'vitest';
import { zerotrustToolDefinitions, handleZerotrustTool } from '../../src/tools/zerotrust.js';
import type { CloudflareClient } from '../../src/client/cloudflare-client.js';

const ACCOUNT_ID = '00000000000000000000000000000001';
const APP_ID = '00000000-0000-0000-0000-000000000001';
const POLICY_ID = '00000000-0000-0000-0000-000000000002';

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

describe('Zero Trust Tool Definitions', () => {
  it('exports 6 tool definitions', () => {
    expect(zerotrustToolDefinitions).toHaveLength(6);
  });

  it('all tools have cloudflare_zt_ prefix', () => {
    for (const tool of zerotrustToolDefinitions) {
      expect(tool.name).toMatch(/^cloudflare_zt_/);
    }
  });

  it('all tools have non-empty descriptions', () => {
    for (const tool of zerotrustToolDefinitions) {
      expect(tool.description).toBeTruthy();
      expect(tool.description.length).toBeGreaterThan(10);
    }
  });

  it('all tools have inputSchema with type object', () => {
    for (const tool of zerotrustToolDefinitions) {
      expect(tool.inputSchema).toBeDefined();
      expect(tool.inputSchema.type).toBe('object');
    }
  });
});

// ---------------------------------------------------------------------------
// handleZerotrustTool
// ---------------------------------------------------------------------------

describe('handleZerotrustTool', () => {
  describe('cloudflare_zt_list_apps', () => {
    it('lists Zero Trust apps', async () => {
      const mockApps = [{ id: APP_ID, name: 'Internal App', domain: 'app.example.com' }];
      const client = mockClient({ get: vi.fn().mockResolvedValue(mockApps) });

      const result = await handleZerotrustTool('cloudflare_zt_list_apps', {}, client);

      expect(result.content[0].text).toContain('Internal App');
      expect(client.get).toHaveBeenCalledWith(`/accounts/${ACCOUNT_ID}/access/apps`);
    });

    it('returns error when account_id is missing', async () => {
      const client = mockClient({ getAccountId: vi.fn().mockReturnValue(undefined) });

      const result = await handleZerotrustTool('cloudflare_zt_list_apps', {}, client);

      expect(result.content[0].text).toContain('CLOUDFLARE_ACCOUNT_ID');
    });
  });

  describe('cloudflare_zt_get_app', () => {
    it('gets a specific Access app by ID', async () => {
      const mockApp = { id: APP_ID, name: 'Internal App', domain: 'app.example.com' };
      const client = mockClient({ get: vi.fn().mockResolvedValue(mockApp) });

      const result = await handleZerotrustTool(
        'cloudflare_zt_get_app',
        { app_id: APP_ID },
        client,
      );

      expect(result.content[0].text).toContain('Internal App');
      expect(client.get).toHaveBeenCalledWith(
        `/accounts/${ACCOUNT_ID}/access/apps/${APP_ID}`,
      );
    });

    it('requires app_id parameter', async () => {
      const client = mockClient();

      const result = await handleZerotrustTool('cloudflare_zt_get_app', {}, client);

      expect(result.content[0].text).toContain('Error executing cloudflare_zt_get_app');
    });
  });

  describe('cloudflare_zt_list_policies', () => {
    it('lists policies for an app', async () => {
      const mockPolicies = [{ id: POLICY_ID, name: 'Allow Team', decision: 'allow' }];
      const client = mockClient({ get: vi.fn().mockResolvedValue(mockPolicies) });

      const result = await handleZerotrustTool(
        'cloudflare_zt_list_policies',
        { app_id: APP_ID },
        client,
      );

      expect(result.content[0].text).toContain('Allow Team');
      expect(client.get).toHaveBeenCalledWith(
        `/accounts/${ACCOUNT_ID}/access/apps/${APP_ID}/policies`,
      );
    });

    it('requires app_id parameter', async () => {
      const client = mockClient();

      const result = await handleZerotrustTool('cloudflare_zt_list_policies', {}, client);

      expect(result.content[0].text).toContain('Error executing cloudflare_zt_list_policies');
    });
  });

  describe('cloudflare_zt_create_policy', () => {
    it('creates an allow policy with email rule', async () => {
      const mockPolicy = { id: POLICY_ID, name: 'Allow Team', decision: 'allow' };
      const client = mockClient({ post: vi.fn().mockResolvedValue(mockPolicy) });

      const result = await handleZerotrustTool(
        'cloudflare_zt_create_policy',
        {
          app_id: APP_ID,
          name: 'Allow Team',
          decision: 'allow',
          include: [{ email_domain: { domain: 'example.com' } }],
        },
        client,
      );

      expect(result.content[0].text).toContain('Allow Team');
      expect(client.post).toHaveBeenCalledWith(
        `/accounts/${ACCOUNT_ID}/access/apps/${APP_ID}/policies`,
        {
          name: 'Allow Team',
          decision: 'allow',
          include: [{ email_domain: { domain: 'example.com' } }],
        },
      );
    });

    it('rejects invalid decision value', async () => {
      const client = mockClient();

      const result = await handleZerotrustTool(
        'cloudflare_zt_create_policy',
        {
          app_id: APP_ID,
          name: 'Test',
          decision: 'invalid-decision',
          include: [{ email: { email: 'user@example.com' } }],
        },
        client,
      );

      expect(result.content[0].text).toContain('Error executing cloudflare_zt_create_policy');
    });

    it('requires at least one include rule', async () => {
      const client = mockClient();

      const result = await handleZerotrustTool(
        'cloudflare_zt_create_policy',
        { app_id: APP_ID, name: 'Test', decision: 'allow', include: [] },
        client,
      );

      expect(result.content[0].text).toContain('Error executing cloudflare_zt_create_policy');
    });
  });

  describe('cloudflare_zt_list_idps', () => {
    it('lists identity providers', async () => {
      const mockIdps = [{ id: 'idp-id', name: 'GitHub', type: 'github' }];
      const client = mockClient({ get: vi.fn().mockResolvedValue(mockIdps) });

      const result = await handleZerotrustTool('cloudflare_zt_list_idps', {}, client);

      expect(result.content[0].text).toContain('GitHub');
      expect(client.get).toHaveBeenCalledWith(
        `/accounts/${ACCOUNT_ID}/access/identity_providers`,
      );
    });
  });

  describe('cloudflare_zt_gateway_status', () => {
    it('gets gateway configuration', async () => {
      const mockStatus = { id: ACCOUNT_ID, name: 'My Gateway', status: 'active' };
      const client = mockClient({ get: vi.fn().mockResolvedValue(mockStatus) });

      const result = await handleZerotrustTool('cloudflare_zt_gateway_status', {}, client);

      expect(result.content[0].text).toContain('My Gateway');
      expect(client.get).toHaveBeenCalledWith(
        `/accounts/${ACCOUNT_ID}/gateway/configuration`,
      );
    });
  });

  describe('unknown tool', () => {
    it('returns unknown tool message', async () => {
      const client = mockClient();

      const result = await handleZerotrustTool('cloudflare_zt_unknown', {}, client);

      expect(result.content[0].text).toContain('Unknown Zero Trust tool');
    });
  });

  describe('API error handling', () => {
    it('returns error message when API call fails', async () => {
      const client = mockClient({
        get: vi.fn().mockRejectedValue(new Error('Forbidden')),
      });

      const result = await handleZerotrustTool('cloudflare_zt_list_apps', {}, client);

      expect(result.content[0].text).toContain('Error executing cloudflare_zt_list_apps');
      expect(result.content[0].text).toContain('Forbidden');
    });
  });
});
