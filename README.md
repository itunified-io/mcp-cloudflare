# mcp-cloudflare

[![GitHub release](https://img.shields.io/github/v/release/itunified-io/mcp-cloudflare?style=flat-square)](https://github.com/itunified-io/mcp-cloudflare/releases)
[![License: AGPL-3.0](https://img.shields.io/badge/license-AGPL--3.0-blue?style=flat-square)](LICENSE)
[![CalVer](https://img.shields.io/badge/calver-YYYY.0M.DD.MICRO-22bfae?style=flat-square)](https://calver.org)
[![Node.js](https://img.shields.io/badge/node-%3E%3D20-brightgreen?style=flat-square)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6?style=flat-square)](https://www.typescriptlang.org/)
[![mcp-cloudflare MCP server](https://glama.ai/mcp/servers/itunified-io/mcp-cloudflare/badges/card.svg)](https://glama.ai/mcp/servers/itunified-io/mcp-cloudflare)

Slim Cloudflare MCP Server for managing DNS, zones, tunnels, WAF, Zero Trust, and security via Cloudflare API v4.

**No SSH. No shell execution. API-only. 3 runtime dependencies.**

## Table of Contents

- [Features](#features)
- [Quick Start](#quick-start)
- [HashiCorp Vault Integration (Optional)](#hashicorp-vault-integration-optional)
- [Claude Code Integration](#claude-code-integration)
- [Configuration](#configuration)
- [Multi-Zone Support](#multi-zone-support)
- [Tools](#tools)
- [Skills](#skills)
- [Development](#development)
- [License](#license)

## Features

75 tools across 11 domains:

- **DNS** — Record management (A, AAAA, CNAME, MX, TXT, SRV, CAA, NS), batch operations
- **Zones** — Zone listing, settings, SSL/TLS configuration, cache management
- **Tunnels** — Cloudflare Tunnel creation, configuration, and ingress management
- **WAF** — Ruleset management, custom firewall rules, rate limiting
- **Zero Trust** — Access application CRUD (create/delete), policies (create/delete), identity providers (create/delete), Gateway status
- **Security** — Security event analytics, IP access rules, DDoS configuration, Security Center insights
- **Workers KV** — Namespace management, key-value read/write/delete, key listing
- **Workers** — Script deployment, route management
- **Worker Secrets** — Secret management (names only, values never exposed)
- **Worker Analytics** — Invocation metrics, CPU time, error rates via GraphQL
- **R2 Storage** — Bucket management, object listing and metadata, custom domains, location hints

## Quick Start

```bash
npm install
cp .env.example .env   # Edit with your Cloudflare API token
npm run build
node dist/index.js     # stdio transport for MCP
```

## HashiCorp Vault Integration (Optional)

`mcp-cloudflare` supports loading Cloudflare credentials from a central
[HashiCorp Vault](https://www.vaultproject.io/) instance at startup via AppRole
authentication. This is optional — the server works fine with plain environment
variables alone.

### How It Works

On startup, if `NAS_VAULT_ADDR` is set the server performs an AppRole login,
fetches the KV v2 secret at `<mount>/data/cloudflare/api`, and injects the
values into the process environment **before** the MCP transport starts. The
loader is fully opportunistic:

- If `NAS_VAULT_ADDR` is **unset**, the loader is a silent no-op. No Vault
  calls are made and the server behaves exactly as before.
- On any Vault error (network failure, bad credentials, missing secret path),
  a single-line warning is written to stderr and the server falls back to
  whatever environment variables are already set.
- Secret values are **never logged**. Only the KV path name and a
  populated-count appear in stderr diagnostics.
- Uses the built-in `fetch` (Node 20+) — no additional runtime dependencies.

### Credential Precedence

```
Explicit env vars (CLOUDFLARE_API_TOKEN etc.) > Vault > error (missing creds)
```

If you set `CLOUDFLARE_API_TOKEN` directly, the Vault loader will not
overwrite it. Vault only fills in credentials that are not already present in
the environment.

### Vault Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NAS_VAULT_ADDR` | Yes* | Vault server address (e.g., `https://vault.example.com:8200`) |
| `NAS_VAULT_ROLE_ID` | Yes* | AppRole role ID for this server |
| `NAS_VAULT_SECRET_ID` | Yes* | AppRole secret ID for this server |
| `NAS_VAULT_KV_MOUNT` | No | KV v2 mount path (default: `kv`) |

\* Only required if using Vault. All three must be set together.

### KV v2 Secret Structure

Write the Cloudflare credentials to the following path in Vault:

```
Path: kv/cloudflare/api
```

```json
{
  "api_token": "your-cloudflare-api-token",
  "account_id": "your-account-id"
}
```

Key mapping:

| Vault key | Environment variable |
|-----------|---------------------|
| `api_token` | `CLOUDFLARE_API_TOKEN` |
| `account_id` | `CLOUDFLARE_ACCOUNT_ID` |

### Vault Setup Steps

**1. Write credentials to KV v2:**

```sh
vault kv put kv/cloudflare/api \
  api_token="your-cloudflare-api-token" \
  account_id="your-account-id"
```

**2. Create a Vault policy:**

```hcl
# cloudflare-mcp-policy.hcl
path "kv/data/cloudflare/api" {
  capabilities = ["read"]
}
```

```sh
vault policy write cloudflare-mcp cloudflare-mcp-policy.hcl
```

**3. Enable AppRole auth and create a role:**

```sh
vault auth enable approle

vault write auth/approle/role/cloudflare-mcp \
  token_policies="cloudflare-mcp" \
  token_ttl="1h" \
  token_max_ttl="4h" \
  secret_id_ttl="0"   # 0 = no expiry; set a duration for rotation
```

**4. Retrieve the role ID and secret ID:**

```sh
vault read auth/approle/role/cloudflare-mcp/role-id
vault write -f auth/approle/role/cloudflare-mcp/secret-id
```

### Claude Desktop / MCP Config Example (with Vault)

When using Vault, no Cloudflare credentials are needed in the MCP config —
only the three Vault variables:

```json
{
  "mcpServers": {
    "cloudflare": {
      "command": "npx",
      "args": ["@itunified.io/mcp-cloudflare"],
      "env": {
        "NAS_VAULT_ADDR": "https://vault.example.com:8200",
        "NAS_VAULT_ROLE_ID": "your-role-id",
        "NAS_VAULT_SECRET_ID": "your-secret-id"
      }
    }
  }
}
```

`NAS_VAULT_KV_MOUNT` can be omitted if your KV engine is mounted at the
default path `kv`. The Cloudflare API token and account ID will be fetched
automatically at startup.

---

## Claude Code Integration

Add to `.mcp.json` in your project root:

```json
{
  "mcpServers": {
    "cloudflare": {
      "command": "node",
      "args": ["/path/to/mcp-cloudflare/dist/index.js"],
      "env": {
        "CLOUDFLARE_API_TOKEN": "your-api-token-here",
        "CLOUDFLARE_ACCOUNT_ID": "your-account-id"
      }
    }
  }
}
```

## Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `CLOUDFLARE_API_TOKEN` | Yes | — | Cloudflare API Token (with appropriate permissions) |
| `CLOUDFLARE_ACCOUNT_ID` | No | — | Cloudflare Account ID (required for account-level operations) |
| `CLOUDFLARE_TIMEOUT` | No | `30000` | Request timeout in milliseconds |
| `NAS_VAULT_ADDR` | No | — | HashiCorp Vault URL, enables Vault AppRole loading (see below) |
| `NAS_VAULT_ROLE_ID` | No | — | Vault AppRole role_id |
| `NAS_VAULT_SECRET_ID` | No | — | Vault AppRole secret_id |
| `NAS_VAULT_KV_MOUNT` | No | `kv` | Vault KV v2 mount path |

### Loading Secrets from HashiCorp Vault (AppRole)

If you run a central Vault instance, `mcp-cloudflare` can fetch its credentials
at startup via AppRole instead of passing them through the MCP config:

```sh
export NAS_VAULT_ADDR=https://vault.example.com
export NAS_VAULT_ROLE_ID=<role-id>
export NAS_VAULT_SECRET_ID=<secret-id>
# optional — defaults to "kv"
export NAS_VAULT_KV_MOUNT=kv
```

The loader reads KV v2 at `<mount>/data/cloudflare/api` and expects two keys:
`api_token` and `account_id`. Example Vault write:

```sh
vault kv put kv/cloudflare/api \
  api_token=your-api-token-here \
  account_id=00000000000000000000000000000000
```

**Precedence:** `process.env` (explicit) > Vault. If `NAS_VAULT_ADDR` is unset
the loader is a silent no-op — the server behaves exactly as before. On any
Vault error (network, auth, missing path), a single-line warning is written
to stderr and the server falls back to whatever env vars are already set.

**Security:** secret values are never logged. Only the KV path name and a
populated-count appear in stderr diagnostics. Uses the global `fetch`
(Node 20+) — no new runtime dependencies.

### API Token Permissions

Create an API Token at `dash.cloudflare.com/profile/api-tokens` with the following permissions based on what you need:

- **DNS**: Zone > DNS > Edit
- **Zone settings**: Zone > Zone Settings > Edit
- **Cache purge**: Zone > Cache Purge > Edit
- **Tunnels**: Account > Cloudflare Tunnel > Edit
- **WAF**: Zone > Firewall Services > Edit
- **Zero Trust**: Account > Access: Apps and Policies > Edit
- **Security events**: Zone > Analytics > Read
- **Workers KV**: Account > Workers KV Storage > Edit
- **Workers**: Account > Worker Scripts > Edit
- **R2**: Account > R2 Storage > Edit

## Multi-Zone Support

All zone-scoped tools accept a `zone_id` parameter that can be either:

- A **32-character hex zone ID** (e.g., `00000000000000000000000000000001`) — used directly
- A **zone name / domain** (e.g., `example.com`) — resolved automatically via the Cloudflare API

This allows managing multiple zones by name without needing to look up IDs manually.

## Tools

Tools documentation is coming in v1 as tool modules are implemented. See [docs/api-reference.md](docs/api-reference.md) for the planned API endpoint mapping.

## Skills

Claude Code skills compose MCP tools into higher-level workflows. See [`.claude/skills/README.md`](.claude/skills/README.md) for detailed documentation.

| Skill | Slash Command | Description |
|-------|--------------|-------------|
| cloudflare-health | `/cf-health` | Zone health dashboard — DNS, security, tunnels, WAF, DDoS status |
| cloudflare-live-test | `/cf-test` | Live integration test — read + safe writes with cleanup |
| cloudflare-dns-management | — | DNS record management — add, list, update, delete across zones |
| cloudflare-incident-response | — | DDoS/attack emergency response — detect, assess, mitigate, monitor |
| cloudflare-security-audit | — | Security posture audit — WAF, events, IP access, DDoS analytics |
| cloudflare-tunnel-management | — | Tunnel management — create, configure ingress, monitor connections |
| cloudflare-waf-management | — | WAF management — custom rules, rulesets, IP access, Under Attack |
| cloudflare-zero-trust | — | Zero Trust — access apps, policies, identity providers, gateway |
| cloudflare-kv-manage | — | Workers KV — namespace and key-value CRUD operations |
| cloudflare-worker-deploy | — | Workers — script deployment, routes, secrets, analytics |
| cloudflare-r2-manage | — | R2 Storage — bucket and object management, audit workflows |

## Development

```bash
npm run build      # Compile TypeScript
npm test           # Run unit tests (vitest)
npm run typecheck  # Type check only (no emit)
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for contribution guidelines.

## License

This project is dual-licensed:

- **Open Source**: [GNU Affero General Public License v3.0 (AGPL-3.0)](LICENSE) — free for open-source and non-commercial use
- **Commercial**: Available for proprietary integrations — see [COMMERCIAL_LICENSE.md](COMMERCIAL_LICENSE.md)

If you use mcp-cloudflare in a proprietary product or SaaS offering, a commercial license is required. Support development by [sponsoring us on GitHub](https://github.com/sponsors/itunified-io).
