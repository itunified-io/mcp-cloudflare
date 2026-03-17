import { describe, it, expect, vi } from 'vitest';
import { certificatesToolDefinitions, handleCertificatesTool } from '../../src/tools/certificates.js';
import type { CloudflareClient } from '../../src/client/cloudflare-client.js';

const ZONE_ID = '00000000000000000000000000000001';
const CERT_PACK_ID = 'cert-pack-123';

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

describe('Certificates Tool Definitions', () => {
  it('exports 7 tool definitions', () => {
    expect(certificatesToolDefinitions).toHaveLength(7);
  });

  it('all tools have cloudflare_ prefix', () => {
    for (const tool of certificatesToolDefinitions) {
      expect(tool.name).toMatch(/^cloudflare_/);
    }
  });

  it('all tools have non-empty descriptions', () => {
    for (const tool of certificatesToolDefinitions) {
      expect(tool.description.length).toBeGreaterThan(0);
    }
  });

  it('all tools have inputSchema with type "object"', () => {
    for (const tool of certificatesToolDefinitions) {
      expect(tool.inputSchema.type).toBe('object');
    }
  });
});

// ---------------------------------------------------------------------------
// Handler tests
// ---------------------------------------------------------------------------

describe('handleCertificatesTool', () => {
  describe('cloudflare_certificate_list', () => {
    it('lists certificate packs for a zone', async () => {
      const mockCerts = [{ id: CERT_PACK_ID, type: 'universal', status: 'active' }];
      const client = mockClient({ get: vi.fn().mockResolvedValue(mockCerts) });

      const result = await handleCertificatesTool('cloudflare_certificate_list', {
        zone_id: ZONE_ID,
      }, client);

      expect(result.content[0].text).toContain(CERT_PACK_ID);
      expect(client.get).toHaveBeenCalledWith(`/zones/${ZONE_ID}/ssl/certificate_packs`, {});
    });

    it('passes status filter', async () => {
      const client = mockClient();

      await handleCertificatesTool('cloudflare_certificate_list', {
        zone_id: ZONE_ID,
        status: 'active',
      }, client);

      expect(client.get).toHaveBeenCalledWith(`/zones/${ZONE_ID}/ssl/certificate_packs`, { status: 'active' });
    });

    it('resolves zone name to ID', async () => {
      const client = mockClient();

      await handleCertificatesTool('cloudflare_certificate_list', {
        zone_id: 'example.com',
      }, client);

      expect(client.resolveZoneId).toHaveBeenCalledWith('example.com');
    });
  });

  describe('cloudflare_certificate_get', () => {
    it('gets a specific certificate pack', async () => {
      const mockCert = { id: CERT_PACK_ID, type: 'universal', status: 'active', hosts: ['example.com'] };
      const client = mockClient({ get: vi.fn().mockResolvedValue(mockCert) });

      const result = await handleCertificatesTool('cloudflare_certificate_get', {
        zone_id: ZONE_ID,
        certificate_pack_id: CERT_PACK_ID,
      }, client);

      expect(result.content[0].text).toContain(CERT_PACK_ID);
      expect(client.get).toHaveBeenCalledWith(`/zones/${ZONE_ID}/ssl/certificate_packs/${CERT_PACK_ID}`);
    });

    it('returns error for missing certificate_pack_id', async () => {
      const client = mockClient();

      const result = await handleCertificatesTool('cloudflare_certificate_get', {
        zone_id: ZONE_ID,
      }, client);

      expect(result.content[0].text).toContain('Error');
    });
  });

  describe('cloudflare_ssl_setting_get', () => {
    it('gets SSL setting for a zone', async () => {
      const mockSetting = { id: 'ssl', value: 'full', editable: true };
      const client = mockClient({ get: vi.fn().mockResolvedValue(mockSetting) });

      const result = await handleCertificatesTool('cloudflare_ssl_setting_get', {
        zone_id: ZONE_ID,
      }, client);

      expect(result.content[0].text).toContain('full');
      expect(client.get).toHaveBeenCalledWith(`/zones/${ZONE_ID}/settings/ssl`);
    });
  });

  describe('cloudflare_ssl_setting_set', () => {
    it('sets SSL mode to strict', async () => {
      const mockResult = { id: 'ssl', value: 'strict' };
      const client = mockClient({ patch: vi.fn().mockResolvedValue(mockResult) });

      const result = await handleCertificatesTool('cloudflare_ssl_setting_set', {
        zone_id: ZONE_ID,
        value: 'strict',
      }, client);

      expect(result.content[0].text).toContain('strict');
      expect(client.patch).toHaveBeenCalledWith(`/zones/${ZONE_ID}/settings/ssl`, { value: 'strict' });
    });

    it('rejects invalid SSL mode', async () => {
      const client = mockClient();

      const result = await handleCertificatesTool('cloudflare_ssl_setting_set', {
        zone_id: ZONE_ID,
        value: 'invalid',
      }, client);

      expect(result.content[0].text).toContain('Error');
    });
  });

  describe('cloudflare_ssl_verification', () => {
    it('gets SSL verification status', async () => {
      const mockVerification = [{ hostname: 'example.com', certificate_status: 'active', verification_status: true }];
      const client = mockClient({ get: vi.fn().mockResolvedValue(mockVerification) });

      const result = await handleCertificatesTool('cloudflare_ssl_verification', {
        zone_id: ZONE_ID,
      }, client);

      expect(result.content[0].text).toContain('example.com');
      expect(client.get).toHaveBeenCalledWith(`/zones/${ZONE_ID}/ssl/verification`);
    });
  });

  describe('cloudflare_tls_setting_get', () => {
    it('gets minimum TLS version', async () => {
      const mockSetting = { id: 'min_tls_version', value: '1.2', editable: true };
      const client = mockClient({ get: vi.fn().mockResolvedValue(mockSetting) });

      const result = await handleCertificatesTool('cloudflare_tls_setting_get', {
        zone_id: ZONE_ID,
      }, client);

      expect(result.content[0].text).toContain('1.2');
      expect(client.get).toHaveBeenCalledWith(`/zones/${ZONE_ID}/settings/min_tls_version`);
    });
  });

  describe('cloudflare_tls_setting_set', () => {
    it('sets minimum TLS to 1.2', async () => {
      const mockResult = { id: 'min_tls_version', value: '1.2' };
      const client = mockClient({ patch: vi.fn().mockResolvedValue(mockResult) });

      const result = await handleCertificatesTool('cloudflare_tls_setting_set', {
        zone_id: ZONE_ID,
        value: '1.2',
      }, client);

      expect(result.content[0].text).toContain('1.2');
      expect(client.patch).toHaveBeenCalledWith(`/zones/${ZONE_ID}/settings/min_tls_version`, { value: '1.2' });
    });

    it('rejects invalid TLS version', async () => {
      const client = mockClient();

      const result = await handleCertificatesTool('cloudflare_tls_setting_set', {
        zone_id: ZONE_ID,
        value: '0.9',
      }, client);

      expect(result.content[0].text).toContain('Error');
    });
  });

  describe('unknown tool', () => {
    it('returns error for unknown tool name', async () => {
      const client = mockClient();

      const result = await handleCertificatesTool('cloudflare_certificate_unknown', {}, client);

      expect(result.content[0].text).toContain('Unknown certificates tool');
    });
  });
});
