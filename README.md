# mcp-cloudflare

[![GitHub release](https://img.shields.io/github/v/release/itunified-io/mcp-cloudflare?style=flat-square)](https://github.com/itunified-io/mcp-cloudflare/releases)
[![License: AGPL-3.0](https://img.shields.io/badge/license-AGPL--3.0-blue?style=flat-square)](LICENSE)
[![CalVer](https://img.shields.io/badge/calver-YYYY.0M.DD.MICRO-22bfae?style=flat-square)](https://calver.org)
[![Node.js](https://img.shields.io/badge/node-%3E%3D20-brightgreen?style=flat-square)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6?style=flat-square)](https://www.typescriptlang.org/)

Slim Cloudflare MCP Server for managing DNS, zones, tunnels, WAF, Zero Trust, and security via Cloudflare API v4.

**No SSH. No shell execution. API-only. 3 runtime dependencies.**

## Table of Contents

- [Features](#features)
- [Quick Start](#quick-start)
- [Claude Code Integration](#claude-code-integration)
- [Configuration](#configuration)
- [Multi-Zone Support](#multi-zone-support)
- [Tools](#tools)
- [Skills](#skills)
- [Development](#development)
- [License](#license)

## Features

Tools across 6 domains:

- **DNS** — Record management (A, AAAA, CNAME, MX, TXT, SRV, CAA, NS), batch operations
- **Zones** — Zone listing, settings, SSL/TLS configuration, cache management
- **Tunnels** — Cloudflare Tunnel creation, configuration, and ingress management
- **WAF** — Ruleset management, custom firewall rules, rate limiting
- **Zero Trust** — Access applications, policies, identity providers, Gateway status
- **Security** — Security event analytics, IP access rules, DDoS configuration

## Quick Start

```bash
npm install
cp .env.example .env   # Edit with your Cloudflare API token
npm run build
node dist/index.js     # stdio transport for MCP
```

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

### API Token Permissions

Create an API Token at `dash.cloudflare.com/profile/api-tokens` with the following permissions based on what you need:

- **DNS**: Zone > DNS > Edit
- **Zone settings**: Zone > Zone Settings > Edit
- **Tunnels**: Account > Cloudflare Tunnel > Edit
- **WAF**: Zone > Firewall Services > Edit
- **Zero Trust**: Account > Access: Apps and Policies > Edit
- **Security events**: Zone > Analytics > Read

## Multi-Zone Support

All zone-scoped tools accept a `zone_id` parameter that can be either:

- A **32-character hex zone ID** (e.g., `00000000000000000000000000000001`) — used directly
- A **zone name / domain** (e.g., `example.com`) — resolved automatically via the Cloudflare API

This allows managing multiple zones by name without needing to look up IDs manually.

## Tools

Tools documentation is coming in v1 as tool modules are implemented. See [docs/api-reference.md](docs/api-reference.md) for the planned API endpoint mapping.

## Skills

Claude Code skills orchestrate multiple MCP tools into higher-level workflows. Skills are located in `.claude/skills/` and auto-discovered by Claude Code.

Skills documentation is coming in v1 as skill modules are implemented.

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
