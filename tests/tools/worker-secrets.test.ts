import { describe, it, expect, vi } from 'vitest';
import { workerSecretsToolDefinitions, handleWorkerSecretsTool } from '../../src/tools/worker-secrets.js';
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

describe('Worker Secrets Tool Definitions', () => {
  it('exports 3 tool definitions', () => {
    expect(workerSecretsToolDefinitions).toHaveLength(3);
  });

  it('all tools have cloudflare_worker_secret_ prefix', () => {
    for (const tool of workerSecretsToolDefinitions) {
      expect(tool.name).toMatch(/^cloudflare_worker_secret_/);
    }
  });

  it('all tools have non-empty descriptions', () => {
    for (const tool of workerSecretsToolDefinitions) {
      expect(tool.description).toBeTruthy();
      expect(tool.description.length).toBeGreaterThan(10);
    }
  });

  it('all tools have inputSchema with type object', () => {
    for (const tool of workerSecretsToolDefinitions) {
      expect(tool.inputSchema).toBeDefined();
      expect(tool.inputSchema.type).toBe('object');
    }
  });
});

// ---------------------------------------------------------------------------
// handleWorkerSecretsTool
// ---------------------------------------------------------------------------

describe('handleWorkerSecretsTool', () => {
  describe('cloudflare_worker_secret_list', () => {
    it('lists secrets for a worker', async () => {
      const mockSecrets = [{ name: 'API_KEY', type: 'secret_text' }];
      const client = mockClient({ get: vi.fn().mockResolvedValue(mockSecrets) });

      const result = await handleWorkerSecretsTool(
        'cloudflare_worker_secret_list',
        { script_name: 'my-worker' },
        client,
      );

      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toContain('API_KEY');
      expect(client.get).toHaveBeenCalledWith(
        `/accounts/${ACCOUNT_ID}/workers/scripts/my-worker/secrets`,
      );
    });

    it('requires script_name', async () => {
      const client = mockClient();

      const result = await handleWorkerSecretsTool('cloudflare_worker_secret_list', {}, client);

      expect(result.content[0].text).toContain('Error executing cloudflare_worker_secret_list');
    });

    it('returns error when account_id is missing', async () => {
      const client = mockClient({ getAccountId: vi.fn().mockReturnValue(undefined) });

      const result = await handleWorkerSecretsTool(
        'cloudflare_worker_secret_list',
        { script_name: 'my-worker' },
        client,
      );

      expect(result.content[0].text).toContain('CLOUDFLARE_ACCOUNT_ID');
    });
  });

  describe('cloudflare_worker_secret_set', () => {
    it('sets a secret and does NOT echo the value', async () => {
      const client = mockClient({ put: vi.fn().mockResolvedValue({}) });

      const result = await handleWorkerSecretsTool(
        'cloudflare_worker_secret_set',
        { script_name: 'my-worker', secret_name: 'DB_PASSWORD', secret_value: 'super-secret-123' },
        client,
      );

      // Verify the API call
      expect(client.put).toHaveBeenCalledWith(
        `/accounts/${ACCOUNT_ID}/workers/scripts/my-worker/secrets`,
        { name: 'DB_PASSWORD', text: 'super-secret-123', type: 'secret_text' },
      );

      // CRITICAL: verify the response does NOT contain the secret value
      expect(result.content[0].text).not.toContain('super-secret-123');
      expect(result.content[0].text).toContain('success');
      expect(result.content[0].text).toContain('DB_PASSWORD');
      expect(result.content[0].text).toContain('not returned for security');
    });

    it('requires script_name and secret_name and secret_value', async () => {
      const client = mockClient();

      const result = await handleWorkerSecretsTool(
        'cloudflare_worker_secret_set',
        { script_name: 'my-worker' },
        client,
      );

      expect(result.content[0].text).toContain('Error executing cloudflare_worker_secret_set');
    });

    it('rejects invalid script_name', async () => {
      const client = mockClient();

      const result = await handleWorkerSecretsTool(
        'cloudflare_worker_secret_set',
        { script_name: 'INVALID', secret_name: 'KEY', secret_value: 'val' },
        client,
      );

      expect(result.content[0].text).toContain('Error executing cloudflare_worker_secret_set');
    });
  });

  describe('cloudflare_worker_secret_delete', () => {
    it('deletes a secret', async () => {
      const client = mockClient({ delete: vi.fn().mockResolvedValue({}) });

      await handleWorkerSecretsTool(
        'cloudflare_worker_secret_delete',
        { script_name: 'my-worker', secret_name: 'OLD_KEY' },
        client,
      );

      expect(client.delete).toHaveBeenCalledWith(
        `/accounts/${ACCOUNT_ID}/workers/scripts/my-worker/secrets/OLD_KEY`,
      );
    });

    it('requires script_name and secret_name', async () => {
      const client = mockClient();

      const result = await handleWorkerSecretsTool(
        'cloudflare_worker_secret_delete',
        { script_name: 'my-worker' },
        client,
      );

      expect(result.content[0].text).toContain('Error executing cloudflare_worker_secret_delete');
    });
  });

  describe('unknown tool', () => {
    it('returns unknown tool message for unrecognized tool name', async () => {
      const client = mockClient();

      const result = await handleWorkerSecretsTool('cloudflare_worker_secret_unknown', {}, client);

      expect(result.content[0].text).toContain('Unknown Worker Secrets tool');
    });
  });

  describe('API error handling', () => {
    it('returns error message when API call fails', async () => {
      const client = mockClient({
        get: vi.fn().mockRejectedValue(new Error('API request failed')),
      });

      const result = await handleWorkerSecretsTool(
        'cloudflare_worker_secret_list',
        { script_name: 'my-worker' },
        client,
      );

      expect(result.content[0].text).toContain('Error executing cloudflare_worker_secret_list');
      expect(result.content[0].text).toContain('API request failed');
    });
  });
});
