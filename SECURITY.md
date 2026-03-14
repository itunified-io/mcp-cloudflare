# Security Policy

## Design Principles

- **API-only**: All operations use the Cloudflare REST API v4. No SSH, no shell execution.
- **Transport**: stdio only — no HTTP endpoints are exposed by this server.
- **Credentials**: API Token exclusively via environment variables. Never hardcoded, logged, or committed.
- **Input validation**: All tool parameters are validated with strict Zod schemas.
- **Error handling**: Error messages never leak credentials or sensitive configuration. The Bearer token never appears in logs or error output.
- **Destructive operations**: Operations that delete or overwrite data require an explicit confirmation parameter.
- **Rate limiting**: 429 responses from the Cloudflare API are handled gracefully with descriptive error messages.

## Reporting Vulnerabilities

If you discover a security vulnerability, please report it responsibly:

1. **Do NOT** create a public GitHub issue
2. Use [GitHub Security Advisories](https://github.com/itunified-io/mcp-cloudflare/security/advisories/new) to report privately
3. Include: description, steps to reproduce, potential impact

We will respond within 48 hours and work with you on a fix before public disclosure.

## Supported Versions

Only the latest CalVer release is actively supported with security patches.
