import { describe, it, expect, vi } from 'vitest';
import { securityToolDefinitions, handleSecurityTool } from '../../src/tools/security.js';
import type { CloudflareClient } from '../../src/client/cloudflare-client.js';

const ZONE_ID = '00000000000000000000000000000001';
const RULE_ID = '00000000000000000000000000000002';
const ACCOUNT_ID = '00000000000000000000000000000003';

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
    getAccountId: vi.fn().mockReturnValue(undefined),
    ...overrides,
  } as unknown as CloudflareClient;
}

// ---------------------------------------------------------------------------
// Tool definitions
// ---------------------------------------------------------------------------

describe('Security Tool Definitions', () => {
  it('exports 10 tool definitions', () => {
    expect(securityToolDefinitions).toHaveLength(10);
  });

  it('all tools have cloudflare_security_, cloudflare_ddos_, cloudflare_ip_access_, or cloudflare_under_attack_ prefix', () => {
    for (const tool of securityToolDefinitions) {
      expect(tool.name).toMatch(
        /^cloudflare_(security_|ddos_|ip_access_|under_attack_)/,
      );
    }
  });

  it('all tools have non-empty descriptions', () => {
    for (const tool of securityToolDefinitions) {
      expect(tool.description).toBeTruthy();
      expect(tool.description.length).toBeGreaterThan(10);
    }
  });

  it('cloudflare_security_level_set is marked as DESTRUCTIVE', () => {
    const tool = securityToolDefinitions.find(
      (t) => t.name === 'cloudflare_security_level_set',
    );
    expect(tool?.description).toMatch(/DESTRUCTIVE/i);
  });

  it('all tools have inputSchema with type object', () => {
    for (const tool of securityToolDefinitions) {
      expect(tool.inputSchema).toBeDefined();
      expect(tool.inputSchema.type).toBe('object');
    }
  });
});

// ---------------------------------------------------------------------------
// handleSecurityTool
// ---------------------------------------------------------------------------

describe('handleSecurityTool', () => {
  describe('cloudflare_security_level_get', () => {
    it('gets security level for a zone', async () => {
      const mockSetting = { id: 'security_level', value: 'medium', editable: true };
      const client = mockClient({ get: vi.fn().mockResolvedValue(mockSetting) });

      const result = await handleSecurityTool(
        'cloudflare_security_level_get',
        { zone_id: ZONE_ID },
        client,
      );

      expect(result.content[0].text).toContain('medium');
      expect(client.get).toHaveBeenCalledWith(`/zones/${ZONE_ID}/settings/security_level`);
    });

    it('requires zone_id parameter', async () => {
      const client = mockClient();

      const result = await handleSecurityTool('cloudflare_security_level_get', {}, client);

      expect(result.content[0].text).toContain(
        'Error executing cloudflare_security_level_get',
      );
    });
  });

  describe('cloudflare_security_level_set', () => {
    it('sets security level to under_attack', async () => {
      const mockResult = { id: 'security_level', value: 'under_attack', editable: true };
      const client = mockClient({ patch: vi.fn().mockResolvedValue(mockResult) });

      const result = await handleSecurityTool(
        'cloudflare_security_level_set',
        { zone_id: ZONE_ID, value: 'under_attack' },
        client,
      );

      expect(result.content[0].text).toContain('under_attack');
      expect(client.patch).toHaveBeenCalledWith(
        `/zones/${ZONE_ID}/settings/security_level`,
        { value: 'under_attack' },
      );
    });

    it('rejects invalid security level value', async () => {
      const client = mockClient();

      const result = await handleSecurityTool(
        'cloudflare_security_level_set',
        { zone_id: ZONE_ID, value: 'extreme' },
        client,
      );

      expect(result.content[0].text).toContain(
        'Error executing cloudflare_security_level_set',
      );
    });

    it('accepts all valid security level values', async () => {
      const validValues = [
        'off',
        'essentially_off',
        'low',
        'medium',
        'high',
        'under_attack',
      ];

      for (const value of validValues) {
        const client = mockClient({ patch: vi.fn().mockResolvedValue({ value }) });
        const result = await handleSecurityTool(
          'cloudflare_security_level_set',
          { zone_id: ZONE_ID, value },
          client,
        );
        expect(result.content[0].text).not.toContain('Error executing');
      }
    });
  });

  describe('cloudflare_security_events', () => {
    it('queries security events via GraphQL', async () => {
      const mockData = { viewer: { zones: [{ firewallEventsAdaptive: [] }] } };
      const client = mockClient({ graphql: vi.fn().mockResolvedValue(mockData) });

      const result = await handleSecurityTool(
        'cloudflare_security_events',
        { zone_id: ZONE_ID },
        client,
      );

      expect(result.content[0].text).toContain('firewallEventsAdaptive');
      expect(client.graphql).toHaveBeenCalledWith(
        expect.stringContaining('SecurityEvents'),
        expect.objectContaining({
          zoneTag: ZONE_ID,
          limit: 100,
          since: expect.any(String),
        }),
      );
    });

    it('uses provided since and limit values', async () => {
      const client = mockClient({ graphql: vi.fn().mockResolvedValue({}) });

      await handleSecurityTool(
        'cloudflare_security_events',
        { zone_id: ZONE_ID, since: '2026-03-13T00:00:00Z', limit: 500 },
        client,
      );

      expect(client.graphql).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ since: '2026-03-13T00:00:00Z', limit: 500 }),
      );
    });

    it('rejects limit exceeding max', async () => {
      const client = mockClient();

      const result = await handleSecurityTool(
        'cloudflare_security_events',
        { zone_id: ZONE_ID, limit: 99999 },
        client,
      );

      expect(result.content[0].text).toContain('Error executing cloudflare_security_events');
    });
  });

  describe('cloudflare_ddos_analytics', () => {
    it('queries DDoS analytics via GraphQL', async () => {
      const mockData = {
        viewer: { zones: [{ httpRequestsAdaptiveGroups: [] }] },
      };
      const client = mockClient({ graphql: vi.fn().mockResolvedValue(mockData) });

      const result = await handleSecurityTool(
        'cloudflare_ddos_analytics',
        { zone_id: ZONE_ID },
        client,
      );

      expect(result.content[0].text).toContain('httpRequestsAdaptiveGroups');
      expect(client.graphql).toHaveBeenCalledWith(
        expect.stringContaining('DdosAnalytics'),
        expect.objectContaining({
          zoneTag: ZONE_ID,
          limit: 100,
          since: expect.any(String),
        }),
      );
    });
  });

  describe('cloudflare_ip_access_list', () => {
    it('lists IP access rules for a zone', async () => {
      const mockRules = [
        { id: RULE_ID, mode: 'block', configuration: { target: 'ip', value: '192.0.2.1' } },
      ];
      const client = mockClient({ get: vi.fn().mockResolvedValue(mockRules) });

      const result = await handleSecurityTool(
        'cloudflare_ip_access_list',
        { zone_id: ZONE_ID },
        client,
      );

      expect(result.content[0].text).toContain('192.0.2.1');
      expect(client.get).toHaveBeenCalledWith(
        `/zones/${ZONE_ID}/firewall/access_rules/rules`,
        {},
      );
    });

    it('passes mode filter to API', async () => {
      const client = mockClient({ get: vi.fn().mockResolvedValue([]) });

      await handleSecurityTool(
        'cloudflare_ip_access_list',
        { zone_id: ZONE_ID, mode: 'block', page: 1, per_page: 50 },
        client,
      );

      expect(client.get).toHaveBeenCalledWith(
        `/zones/${ZONE_ID}/firewall/access_rules/rules`,
        { mode: 'block', page: 1, per_page: 50 },
      );
    });
  });

  describe('cloudflare_ip_access_create', () => {
    it('creates a block rule for an IP address', async () => {
      const mockRule = {
        id: RULE_ID,
        mode: 'block',
        configuration: { target: 'ip', value: '192.0.2.1' },
      };
      const client = mockClient({ post: vi.fn().mockResolvedValue(mockRule) });

      const result = await handleSecurityTool(
        'cloudflare_ip_access_create',
        { zone_id: ZONE_ID, mode: 'block', target: 'ip', value: '192.0.2.1' },
        client,
      );

      expect(result.content[0].text).toContain('192.0.2.1');
      expect(client.post).toHaveBeenCalledWith(
        `/zones/${ZONE_ID}/firewall/access_rules/rules`,
        { mode: 'block', configuration: { target: 'ip', value: '192.0.2.1' } },
      );
    });

    it('includes optional notes when provided', async () => {
      const client = mockClient({ post: vi.fn().mockResolvedValue({}) });

      await handleSecurityTool(
        'cloudflare_ip_access_create',
        {
          zone_id: ZONE_ID,
          mode: 'block',
          target: 'country',
          value: 'XX',
          notes: 'Blocking unknown country',
        },
        client,
      );

      expect(client.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ notes: 'Blocking unknown country' }),
      );
    });

    it('rejects invalid mode', async () => {
      const client = mockClient();

      const result = await handleSecurityTool(
        'cloudflare_ip_access_create',
        { zone_id: ZONE_ID, mode: 'deny', target: 'ip', value: '192.0.2.1' },
        client,
      );

      expect(result.content[0].text).toContain(
        'Error executing cloudflare_ip_access_create',
      );
    });

    it('rejects invalid target type', async () => {
      const client = mockClient();

      const result = await handleSecurityTool(
        'cloudflare_ip_access_create',
        { zone_id: ZONE_ID, mode: 'block', target: 'hostname', value: 'example.com' },
        client,
      );

      expect(result.content[0].text).toContain(
        'Error executing cloudflare_ip_access_create',
      );
    });
  });

  describe('cloudflare_ip_access_delete', () => {
    it('deletes an IP access rule by ID', async () => {
      const client = mockClient({ delete: vi.fn().mockResolvedValue({}) });

      await handleSecurityTool(
        'cloudflare_ip_access_delete',
        { zone_id: ZONE_ID, rule_id: RULE_ID },
        client,
      );

      expect(client.delete).toHaveBeenCalledWith(
        `/zones/${ZONE_ID}/firewall/access_rules/rules/${RULE_ID}`,
      );
    });

    it('requires rule_id parameter', async () => {
      const client = mockClient();

      const result = await handleSecurityTool(
        'cloudflare_ip_access_delete',
        { zone_id: ZONE_ID },
        client,
      );

      expect(result.content[0].text).toContain(
        'Error executing cloudflare_ip_access_delete',
      );
    });
  });

  describe('cloudflare_under_attack_status', () => {
    it('returns under_attack: true when security level is under_attack', async () => {
      const mockSetting = {
        id: 'security_level',
        value: 'under_attack',
        editable: true,
        modified_on: '2026-03-13T00:00:00Z',
      };
      const client = mockClient({ get: vi.fn().mockResolvedValue(mockSetting) });

      const result = await handleSecurityTool(
        'cloudflare_under_attack_status',
        { zone_id: ZONE_ID },
        client,
      );

      const parsed = JSON.parse(result.content[0].text) as Record<string, unknown>;
      expect(parsed['under_attack']).toBe(true);
      expect(parsed['security_level']).toBe('under_attack');
    });

    it('returns under_attack: false for normal security levels', async () => {
      const mockSetting = {
        id: 'security_level',
        value: 'medium',
        editable: true,
        modified_on: '2026-03-13T00:00:00Z',
      };
      const client = mockClient({ get: vi.fn().mockResolvedValue(mockSetting) });

      const result = await handleSecurityTool(
        'cloudflare_under_attack_status',
        { zone_id: ZONE_ID },
        client,
      );

      const parsed = JSON.parse(result.content[0].text) as Record<string, unknown>;
      expect(parsed['under_attack']).toBe(false);
      expect(parsed['security_level']).toBe('medium');
    });

    it('includes zone_id in response', async () => {
      const mockSetting = {
        id: 'security_level',
        value: 'high',
        editable: true,
        modified_on: '2026-03-13T00:00:00Z',
      };
      const client = mockClient({ get: vi.fn().mockResolvedValue(mockSetting) });

      const result = await handleSecurityTool(
        'cloudflare_under_attack_status',
        { zone_id: ZONE_ID },
        client,
      );

      const parsed = JSON.parse(result.content[0].text) as Record<string, unknown>;
      expect(parsed['zone_id']).toBe(ZONE_ID);
    });
  });

  describe('cloudflare_security_insights', () => {
    it('lists security insights for the account', async () => {
      const mockResponse = {
        count: 2,
        issues: [
          { id: 'insight-1', severity: 'critical', issue_type: 'exposed_infrastructure', subject: 'example.com' },
          { id: 'insight-2', severity: 'low', issue_type: 'email_security', subject: 'example.com' },
        ],
        page: 1,
        per_page: 25,
      };
      const client = mockClient({
        get: vi.fn().mockResolvedValue(mockResponse),
        getAccountId: vi.fn().mockReturnValue(ACCOUNT_ID),
      });

      const result = await handleSecurityTool('cloudflare_security_insights', {}, client);

      expect(result.content[0].text).toContain('critical');
      expect(client.get).toHaveBeenCalledWith(
        `/accounts/${ACCOUNT_ID}/security-center/insights`,
        {},
      );
    });

    it('passes severity filter to API', async () => {
      const client = mockClient({
        get: vi.fn().mockResolvedValue({ count: 0, issues: [] }),
        getAccountId: vi.fn().mockReturnValue(ACCOUNT_ID),
      });

      await handleSecurityTool(
        'cloudflare_security_insights',
        { severity: 'critical', page: 1, per_page: 50 },
        client,
      );

      expect(client.get).toHaveBeenCalledWith(
        `/accounts/${ACCOUNT_ID}/security-center/insights`,
        { severity: 'critical', page: 1, per_page: 50 },
      );
    });

    it('requires CLOUDFLARE_ACCOUNT_ID', async () => {
      const client = mockClient();

      const result = await handleSecurityTool('cloudflare_security_insights', {}, client);

      expect(result.content[0].text).toContain('CLOUDFLARE_ACCOUNT_ID');
    });

    it('rejects invalid severity value', async () => {
      const client = mockClient({ getAccountId: vi.fn().mockReturnValue(ACCOUNT_ID) });

      const result = await handleSecurityTool(
        'cloudflare_security_insights',
        { severity: 'high' },
        client,
      );

      expect(result.content[0].text).toContain('Error executing cloudflare_security_insights');
    });
  });

  describe('cloudflare_security_insights_severity_count', () => {
    it('returns severity counts', async () => {
      const mockCounts = [
        { count: 2, value: 'critical' },
        { count: 3, value: 'moderate' },
        { count: 5, value: 'low' },
      ];
      const client = mockClient({
        get: vi.fn().mockResolvedValue(mockCounts),
        getAccountId: vi.fn().mockReturnValue(ACCOUNT_ID),
      });

      const result = await handleSecurityTool(
        'cloudflare_security_insights_severity_count',
        {},
        client,
      );

      expect(result.content[0].text).toContain('critical');
      expect(client.get).toHaveBeenCalledWith(
        `/accounts/${ACCOUNT_ID}/security-center/insights/severity`,
      );
    });

    it('requires CLOUDFLARE_ACCOUNT_ID', async () => {
      const client = mockClient();

      const result = await handleSecurityTool(
        'cloudflare_security_insights_severity_count',
        {},
        client,
      );

      expect(result.content[0].text).toContain('CLOUDFLARE_ACCOUNT_ID');
    });
  });

  describe('unknown tool', () => {
    it('returns unknown tool message', async () => {
      const client = mockClient();

      const result = await handleSecurityTool('cloudflare_security_unknown', {}, client);

      expect(result.content[0].text).toContain('Unknown security tool');
    });
  });

  describe('API error handling', () => {
    it('returns error message when API call fails', async () => {
      const client = mockClient({
        get: vi.fn().mockRejectedValue(new Error('Zone not found')),
      });

      const result = await handleSecurityTool(
        'cloudflare_security_level_get',
        { zone_id: ZONE_ID },
        client,
      );

      expect(result.content[0].text).toContain(
        'Error executing cloudflare_security_level_get',
      );
      expect(result.content[0].text).toContain('Zone not found');
    });
  });
});
