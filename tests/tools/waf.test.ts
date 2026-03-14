import { describe, it, expect, vi } from 'vitest';
import { wafToolDefinitions, handleWafTool } from '../../src/tools/waf.js';
import type { CloudflareClient } from '../../src/client/cloudflare-client.js';

const ZONE_ID = '00000000000000000000000000000001';
const RULESET_ID = 'abcdef1234567890abcdef1234567890';
const RULE_ID = '11111111111111111111111111111111';

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
    getAccountId: vi.fn().mockReturnValue(undefined),
    ...overrides,
  } as unknown as CloudflareClient;
}

// ---------------------------------------------------------------------------
// Tool definitions
// ---------------------------------------------------------------------------

describe('WAF Tool Definitions', () => {
  it('exports 5 tool definitions', () => {
    expect(wafToolDefinitions).toHaveLength(5);
  });

  it('all tools have cloudflare_waf_ prefix', () => {
    for (const tool of wafToolDefinitions) {
      expect(tool.name).toMatch(/^cloudflare_waf_/);
    }
  });

  it('all tools have non-empty descriptions', () => {
    for (const tool of wafToolDefinitions) {
      expect(tool.description).toBeTruthy();
      expect(tool.description.length).toBeGreaterThan(10);
    }
  });

  it('all tools have inputSchema with type object', () => {
    for (const tool of wafToolDefinitions) {
      expect(tool.inputSchema).toBeDefined();
      expect(tool.inputSchema.type).toBe('object');
    }
  });
});

// ---------------------------------------------------------------------------
// handleWafTool
// ---------------------------------------------------------------------------

describe('handleWafTool', () => {
  describe('cloudflare_waf_list_rulesets', () => {
    it('lists rulesets for a zone', async () => {
      const mockRulesets = [{ id: RULESET_ID, name: 'Cloudflare Managed Ruleset' }];
      const client = mockClient({ get: vi.fn().mockResolvedValue(mockRulesets) });

      const result = await handleWafTool(
        'cloudflare_waf_list_rulesets',
        { zone_id: ZONE_ID },
        client,
      );

      expect(result.content[0].text).toContain('Cloudflare Managed Ruleset');
      expect(client.get).toHaveBeenCalledWith(`/zones/${ZONE_ID}/rulesets`);
    });

    it('requires zone_id parameter', async () => {
      const client = mockClient();

      const result = await handleWafTool('cloudflare_waf_list_rulesets', {}, client);

      expect(result.content[0].text).toContain('Error executing cloudflare_waf_list_rulesets');
    });
  });

  describe('cloudflare_waf_get_ruleset', () => {
    it('gets a specific ruleset by ID', async () => {
      const mockRuleset = { id: RULESET_ID, name: 'Custom Ruleset', rules: [] };
      const client = mockClient({ get: vi.fn().mockResolvedValue(mockRuleset) });

      const result = await handleWafTool(
        'cloudflare_waf_get_ruleset',
        { zone_id: ZONE_ID, ruleset_id: RULESET_ID },
        client,
      );

      expect(result.content[0].text).toContain('Custom Ruleset');
      expect(client.get).toHaveBeenCalledWith(`/zones/${ZONE_ID}/rulesets/${RULESET_ID}`);
    });

    it('requires ruleset_id parameter', async () => {
      const client = mockClient();

      const result = await handleWafTool(
        'cloudflare_waf_get_ruleset',
        { zone_id: ZONE_ID },
        client,
      );

      expect(result.content[0].text).toContain('Error executing cloudflare_waf_get_ruleset');
    });
  });

  describe('cloudflare_waf_list_custom_rules', () => {
    it('lists custom firewall rules for a zone', async () => {
      const mockRuleset = {
        id: RULESET_ID,
        phase: 'http_request_firewall_custom',
        rules: [{ id: RULE_ID, expression: '(ip.src eq 192.0.2.1)', action: 'block' }],
      };
      const client = mockClient({ get: vi.fn().mockResolvedValue(mockRuleset) });

      const result = await handleWafTool(
        'cloudflare_waf_list_custom_rules',
        { zone_id: ZONE_ID },
        client,
      );

      expect(result.content[0].text).toContain('192.0.2.1');
      expect(client.get).toHaveBeenCalledWith(
        `/zones/${ZONE_ID}/rulesets/phases/http_request_firewall_custom/entrypoint`,
      );
    });
  });

  describe('cloudflare_waf_create_custom_rule', () => {
    it('creates a custom block rule', async () => {
      const mockResult = { id: RULE_ID, expression: '(ip.src eq 192.0.2.1)', action: 'block' };
      const client = mockClient({ post: vi.fn().mockResolvedValue(mockResult) });

      const result = await handleWafTool(
        'cloudflare_waf_create_custom_rule',
        { zone_id: ZONE_ID, expression: '(ip.src eq 192.0.2.1)', action: 'block' },
        client,
      );

      expect(result.content[0].text).toContain('192.0.2.1');
      expect(client.post).toHaveBeenCalledWith(
        `/zones/${ZONE_ID}/rulesets/phases/http_request_firewall_custom/entrypoint/rules`,
        { expression: '(ip.src eq 192.0.2.1)', action: 'block' },
      );
    });

    it('includes optional description when provided', async () => {
      const client = mockClient({ post: vi.fn().mockResolvedValue({}) });

      await handleWafTool(
        'cloudflare_waf_create_custom_rule',
        {
          zone_id: ZONE_ID,
          expression: '(ip.src eq 192.0.2.1)',
          action: 'challenge',
          description: 'Block suspicious IP',
        },
        client,
      );

      expect(client.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ description: 'Block suspicious IP' }),
      );
    });

    it('rejects invalid action value', async () => {
      const client = mockClient();

      const result = await handleWafTool(
        'cloudflare_waf_create_custom_rule',
        { zone_id: ZONE_ID, expression: '(ip.src eq 192.0.2.1)', action: 'invalid-action' },
        client,
      );

      expect(result.content[0].text).toContain('Error executing cloudflare_waf_create_custom_rule');
    });

    it('requires expression and action', async () => {
      const client = mockClient();

      const result = await handleWafTool(
        'cloudflare_waf_create_custom_rule',
        { zone_id: ZONE_ID },
        client,
      );

      expect(result.content[0].text).toContain('Error executing cloudflare_waf_create_custom_rule');
    });
  });

  describe('cloudflare_waf_delete_custom_rule', () => {
    it('deletes a custom rule by ruleset and rule ID', async () => {
      const client = mockClient({ delete: vi.fn().mockResolvedValue({}) });

      await handleWafTool(
        'cloudflare_waf_delete_custom_rule',
        { zone_id: ZONE_ID, ruleset_id: RULESET_ID, rule_id: RULE_ID },
        client,
      );

      expect(client.delete).toHaveBeenCalledWith(
        `/zones/${ZONE_ID}/rulesets/${RULESET_ID}/rules/${RULE_ID}`,
      );
    });

    it('requires ruleset_id and rule_id', async () => {
      const client = mockClient();

      const result = await handleWafTool(
        'cloudflare_waf_delete_custom_rule',
        { zone_id: ZONE_ID },
        client,
      );

      expect(result.content[0].text).toContain('Error executing cloudflare_waf_delete_custom_rule');
    });
  });

  describe('unknown tool', () => {
    it('returns unknown tool message', async () => {
      const client = mockClient();

      const result = await handleWafTool('cloudflare_waf_unknown', {}, client);

      expect(result.content[0].text).toContain('Unknown WAF tool');
    });
  });

  describe('API error handling', () => {
    it('returns error message when API call fails', async () => {
      const client = mockClient({
        get: vi.fn().mockRejectedValue(new Error('Rate limit exceeded')),
      });

      const result = await handleWafTool(
        'cloudflare_waf_list_rulesets',
        { zone_id: ZONE_ID },
        client,
      );

      expect(result.content[0].text).toContain('Error executing cloudflare_waf_list_rulesets');
      expect(result.content[0].text).toContain('Rate limit exceeded');
    });
  });
});
