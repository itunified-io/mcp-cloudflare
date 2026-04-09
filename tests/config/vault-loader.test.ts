import { describe, it, expect, beforeEach, vi } from "vitest";
import { loadFromVault } from "../../src/config/vault-loader.js";

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return { ok, status, json: async () => body } as unknown as Response;
}

function makeEnv(overrides: Record<string, string | undefined> = {}): NodeJS.ProcessEnv {
  return { ...overrides } as NodeJS.ProcessEnv;
}

const MAPPING = {
  api_token: "CLOUDFLARE_API_TOKEN",
  account_id: "CLOUDFLARE_ACCOUNT_ID",
};

describe("loadFromVault (mcp-cloudflare)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("is a silent no-op when NAS_VAULT_ADDR is unset", async () => {
    const env = makeEnv({});
    const fetchImpl = vi.fn();
    await loadFromVault({
      kvPath: "cloudflare/api",
      mapping: MAPPING,
      env,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(env.CLOUDFLARE_API_TOKEN).toBeUndefined();
  });

  it("is a silent no-op when role_id / secret_id missing", async () => {
    const env = makeEnv({ NAS_VAULT_ADDR: "https://vault.example" });
    const fetchImpl = vi.fn();
    await loadFromVault({
      kvPath: "cloudflare/api",
      mapping: MAPPING,
      env,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("logs in via AppRole and populates env vars from KV v2", async () => {
    const env = makeEnv({
      NAS_VAULT_ADDR: "https://vault.example",
      NAS_VAULT_ROLE_ID: "rid",
      NAS_VAULT_SECRET_ID: "sid",
    });
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ auth: { client_token: "tok-xyz" } }))
      .mockResolvedValueOnce(
        jsonResponse({
          data: {
            data: {
              api_token: "cf-token-123",
              account_id: "acct-456",
            },
          },
        }),
      );

    await loadFromVault({
      kvPath: "cloudflare/api",
      mapping: MAPPING,
      env,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(env.CLOUDFLARE_API_TOKEN).toBe("cf-token-123");
    expect(env.CLOUDFLARE_ACCOUNT_ID).toBe("acct-456");

    expect(fetchImpl).toHaveBeenNthCalledWith(
      1,
      "https://vault.example/v1/auth/approle/login",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ role_id: "rid", secret_id: "sid" }),
      }),
    );
    expect(fetchImpl).toHaveBeenNthCalledWith(
      2,
      "https://vault.example/v1/kv/data/cloudflare/api",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({ "X-Vault-Token": "tok-xyz" }),
      }),
    );
  });

  it("respects pre-existing process.env values (does not overwrite)", async () => {
    const env = makeEnv({
      NAS_VAULT_ADDR: "https://vault.example",
      NAS_VAULT_ROLE_ID: "rid",
      NAS_VAULT_SECRET_ID: "sid",
      CLOUDFLARE_API_TOKEN: "EXPLICIT",
    });
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ auth: { client_token: "tok" } }))
      .mockResolvedValueOnce(
        jsonResponse({
          data: { data: { api_token: "VAULT-TOKEN", account_id: "VAULT-ACCT" } },
        }),
      );

    await loadFromVault({
      kvPath: "cloudflare/api",
      mapping: MAPPING,
      env,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(env.CLOUDFLARE_API_TOKEN).toBe("EXPLICIT");
    expect(env.CLOUDFLARE_ACCOUNT_ID).toBe("VAULT-ACCT");
  });

  it("honors NAS_VAULT_KV_MOUNT override and trailing slash on addr", async () => {
    const env = makeEnv({
      NAS_VAULT_ADDR: "https://vault.example/",
      NAS_VAULT_ROLE_ID: "rid",
      NAS_VAULT_SECRET_ID: "sid",
      NAS_VAULT_KV_MOUNT: "secret",
    });
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ auth: { client_token: "tok" } }))
      .mockResolvedValueOnce(jsonResponse({ data: { data: { api_token: "T" } } }));

    await loadFromVault({
      kvPath: "cloudflare/api",
      mapping: MAPPING,
      env,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(fetchImpl).toHaveBeenNthCalledWith(
      2,
      "https://vault.example/v1/secret/data/cloudflare/api",
      expect.anything(),
    );
  });

  it("does not throw when login fails (HTTP 400)", async () => {
    const env = makeEnv({
      NAS_VAULT_ADDR: "https://vault.example",
      NAS_VAULT_ROLE_ID: "rid",
      NAS_VAULT_SECRET_ID: "bad",
    });
    const fetchImpl = vi.fn().mockResolvedValueOnce(jsonResponse({}, false, 400));

    await expect(
      loadFromVault({
        kvPath: "cloudflare/api",
        mapping: MAPPING,
        env,
        fetchImpl: fetchImpl as unknown as typeof fetch,
      }),
    ).resolves.toBeUndefined();

    expect(env.CLOUDFLARE_API_TOKEN).toBeUndefined();
  });

  it("does not throw when KV read fails (HTTP 404)", async () => {
    const env = makeEnv({
      NAS_VAULT_ADDR: "https://vault.example",
      NAS_VAULT_ROLE_ID: "rid",
      NAS_VAULT_SECRET_ID: "sid",
    });
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ auth: { client_token: "tok" } }))
      .mockResolvedValueOnce(jsonResponse({}, false, 404));

    await expect(
      loadFromVault({
        kvPath: "cloudflare/api",
        mapping: MAPPING,
        env,
        fetchImpl: fetchImpl as unknown as typeof fetch,
      }),
    ).resolves.toBeUndefined();
  });

  it("does not throw on fetch network error", async () => {
    const env = makeEnv({
      NAS_VAULT_ADDR: "https://vault.example",
      NAS_VAULT_ROLE_ID: "rid",
      NAS_VAULT_SECRET_ID: "sid",
    });
    const fetchImpl = vi.fn().mockRejectedValueOnce(new Error("ECONNREFUSED"));

    await expect(
      loadFromVault({
        kvPath: "cloudflare/api",
        mapping: MAPPING,
        env,
        fetchImpl: fetchImpl as unknown as typeof fetch,
      }),
    ).resolves.toBeUndefined();
  });

  it("ignores mapping entries whose KV keys are absent or non-string", async () => {
    const env = makeEnv({
      NAS_VAULT_ADDR: "https://vault.example",
      NAS_VAULT_ROLE_ID: "rid",
      NAS_VAULT_SECRET_ID: "sid",
    });
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ auth: { client_token: "tok" } }))
      .mockResolvedValueOnce(
        jsonResponse({
          data: {
            data: {
              api_token: "T",
              account_id: 42, // wrong type → ignored
            },
          },
        }),
      );

    await loadFromVault({
      kvPath: "cloudflare/api",
      mapping: MAPPING,
      env,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(env.CLOUDFLARE_API_TOKEN).toBe("T");
    expect(env.CLOUDFLARE_ACCOUNT_ID).toBeUndefined();
  });
});
