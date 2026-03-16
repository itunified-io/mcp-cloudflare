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
  it('exports 8 tool definitions', () => {
    expect(zerotrustToolDefinitions).toHaveLength(8);
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

  describe('cloudflare_zt_create_app', () => {
    it('creates a self_hosted app with required params only', async () => {
      const mockApp = { id: APP_ID, name: 'UAT App', domain: 'uat.example.com', type: 'self_hosted' };
      const client = mockClient({ post: vi.fn().mockResolvedValue(mockApp) });

      const result = await handleZerotrustTool(
        'cloudflare_zt_create_app',
        { name: 'UAT App', domain: 'uat.example.com' },
        client,
      );

      expect(result.content[0].text).toContain('UAT App');
      expect(client.post).toHaveBeenCalledWith(
        `/accounts/${ACCOUNT_ID}/access/apps`,
        { name: 'UAT App', domain: 'uat.example.com', type: 'self_hosted' },
      );
    });

    it('creates an app with all optional params', async () => {
      const IDP_ID = 'a2aefb8b-65f3-4d5e-80c0-0dd046ddc4b2';
      const mockApp = { id: APP_ID, name: 'Full App', domain: 'app.example.com' };
      const client = mockClient({ post: vi.fn().mockResolvedValue(mockApp) });

      const result = await handleZerotrustTool(
        'cloudflare_zt_create_app',
        {
          name: 'Full App',
          domain: 'app.example.com',
          type: 'self_hosted',
          session_duration: '8h',
          allowed_idps: [IDP_ID],
          auto_redirect_to_identity: true,
          app_launcher_visible: true,
          self_hosted_domains: ['app.example.com', 'app2.example.com'],
        },
        client,
      );

      expect(result.content[0].text).toContain('Full App');
      expect(client.post).toHaveBeenCalledWith(
        `/accounts/${ACCOUNT_ID}/access/apps`,
        {
          name: 'Full App',
          domain: 'app.example.com',
          type: 'self_hosted',
          session_duration: '8h',
          allowed_idps: [IDP_ID],
          auto_redirect_to_identity: true,
          app_launcher_visible: true,
          self_hosted_domains: ['app.example.com', 'app2.example.com'],
        },
      );
    });

    it('requires name parameter', async () => {
      const client = mockClient();

      const result = await handleZerotrustTool(
        'cloudflare_zt_create_app',
        { domain: 'app.example.com' },
        client,
      );

      expect(result.content[0].text).toContain('Error executing cloudflare_zt_create_app');
    });

    it('requires domain parameter', async () => {
      const client = mockClient();

      const result = await handleZerotrustTool(
        'cloudflare_zt_create_app',
        { name: 'My App' },
        client,
      );

      expect(result.content[0].text).toContain('Error executing cloudflare_zt_create_app');
    });

    it('rejects invalid app type', async () => {
      const client = mockClient();

      const result = await handleZerotrustTool(
        'cloudflare_zt_create_app',
        { name: 'My App', domain: 'app.example.com', type: 'invalid' },
        client,
      );

      expect(result.content[0].text).toContain('Error executing cloudflare_zt_create_app');
    });

    it('defaults type to self_hosted when omitted', async () => {
      const mockApp = { id: APP_ID, name: 'Default Type', domain: 'app.example.com' };
      const client = mockClient({ post: vi.fn().mockResolvedValue(mockApp) });

      await handleZerotrustTool(
        'cloudflare_zt_create_app',
        { name: 'Default Type', domain: 'app.example.com' },
        client,
      );

      expect(client.post).toHaveBeenCalledWith(
        `/accounts/${ACCOUNT_ID}/access/apps`,
        expect.objectContaining({ type: 'self_hosted' }),
      );
    });

    it('returns error when account_id is missing', async () => {
      const client = mockClient({ getAccountId: vi.fn().mockReturnValue(undefined) });

      const result = await handleZerotrustTool(
        'cloudflare_zt_create_app',
        { name: 'My App', domain: 'app.example.com' },
        client,
      );

      expect(result.content[0].text).toContain('CLOUDFLARE_ACCOUNT_ID');
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

  describe('cloudflare_zt_create_idp', () => {
    it('creates a GitHub IdP with client credentials', async () => {
      const mockIdp = {
        id: 'new-idp-id',
        name: 'my-github-idp',
        type: 'github',
        config: { client_id: 'gh-client-id', client_secret: 'gh-secret-value', redirect_url: 'https://team.cloudflareaccess.com/cdn-cgi/access/callback' },
      };
      const client = mockClient({ post: vi.fn().mockResolvedValue(mockIdp) });

      const result = await handleZerotrustTool(
        'cloudflare_zt_create_idp',
        {
          name: 'my-github-idp',
          type: 'github',
          config: { client_id: 'gh-client-id', client_secret: 'gh-secret-value' },
        },
        client,
      );

      expect(result.content[0].text).toContain('my-github-idp');
      expect(result.content[0].text).toContain('<redacted>');
      expect(result.content[0].text).not.toContain('gh-secret-value');
      expect(client.post).toHaveBeenCalledWith(
        `/accounts/${ACCOUNT_ID}/access/identity_providers`,
        {
          name: 'my-github-idp',
          type: 'github',
          config: { client_id: 'gh-client-id', client_secret: 'gh-secret-value' },
        },
      );
    });

    it('creates a one-time PIN IdP with empty config', async () => {
      const mockIdp = { id: 'otp-idp-id', name: 'email-otp', type: 'onetimepin', config: {} };
      const client = mockClient({ post: vi.fn().mockResolvedValue(mockIdp) });

      const result = await handleZerotrustTool(
        'cloudflare_zt_create_idp',
        { name: 'email-otp', type: 'onetimepin', config: {} },
        client,
      );

      expect(result.content[0].text).toContain('email-otp');
    });

    it('requires name parameter', async () => {
      const client = mockClient();

      const result = await handleZerotrustTool(
        'cloudflare_zt_create_idp',
        { type: 'github', config: { client_id: 'id', client_secret: 'secret' } },
        client,
      );

      expect(result.content[0].text).toContain('Error executing cloudflare_zt_create_idp');
    });

    it('rejects invalid IdP type', async () => {
      const client = mockClient();

      const result = await handleZerotrustTool(
        'cloudflare_zt_create_idp',
        { name: 'test', type: 'invalid-type', config: {} },
        client,
      );

      expect(result.content[0].text).toContain('Error executing cloudflare_zt_create_idp');
    });

    it('returns error when account_id is missing', async () => {
      const client = mockClient({ getAccountId: vi.fn().mockReturnValue(undefined) });

      const result = await handleZerotrustTool(
        'cloudflare_zt_create_idp',
        { name: 'test', type: 'github', config: { client_id: 'id', client_secret: 'secret' } },
        client,
      );

      expect(result.content[0].text).toContain('CLOUDFLARE_ACCOUNT_ID');
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
