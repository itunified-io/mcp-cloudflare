# Changelog

All notable changes to this project will be documented in this file.
This project uses [Calendar Versioning](https://calver.org/) (`YYYY.MM.DD.TS`).


## v2026.03.15.4

- **Add `cloudflare_zt_create_app` tool** (#33)
  - Create Zero Trust Access applications programmatically
  - Supports: self_hosted, saas, ssh, vnc, bookmark app types
  - Optional: session_duration, allowed_idps, auto_redirect, self_hosted_domains
  - 7 new tests (required params, optional params, validation, defaults, error handling)
  - Tool count: 59 → 60

## v2026.03.15.1

- **Add Workers KV tools** (7 tools) (#27)
  - `cloudflare_kv_namespace_list`, `cloudflare_kv_namespace_create`, `cloudflare_kv_namespace_delete`
  - `cloudflare_kv_list_keys`, `cloudflare_kv_read`, `cloudflare_kv_write`, `cloudflare_kv_delete`
  - Client: add `putRaw()` method for raw body PUT requests
- **Add Workers Scripts tools** (5 tools) (#28)
  - `cloudflare_worker_list`, `cloudflare_worker_deploy`, `cloudflare_worker_delete`
  - `cloudflare_worker_route_list`, `cloudflare_worker_route_create`
  - Client: add `putForm()` method for multipart PUT requests
- **Add Worker Secrets tools** (3 tools) (#29)
  - `cloudflare_worker_secret_list`, `cloudflare_worker_secret_set`, `cloudflare_worker_secret_delete`
  - Security: secret values are never echoed in tool output
- **Add Worker Analytics tools** (2 tools) (#30)
  - `cloudflare_worker_analytics`, `cloudflare_worker_usage`
  - Account-scoped GraphQL queries for invocation metrics
- **Add skills: cloudflare-kv-manage, cloudflare-worker-deploy** (#31)
- New validation schemas: `NamespaceIdSchema`, `ScriptNameSchema`, `SecretNameSchema`, `KvKeySchema`
- New types: `KvNamespace`, `KvKey`, `WorkerScript`, `WorkerRoute`, `WorkerSecret`, `WorkerAnalyticsRow`
- Tool count: 42 → 59 (17 new tools across 4 modules)

## v2026.03.16.2

- **Add pre-publish security scan** (#25)
  - Add `scripts/prepublish-check.js` — blocks `npm publish` if forbidden files (`.mcpregistry_*`, `.env`, `.pem`, `.key`, `credentials`) are in the tarball
  - Add `.npmignore` with comprehensive security exclusions
  - Add `prepublishOnly` npm hook: build + test + security scan before every publish
  - Implements ADR-0026

## v2026.03.16.1

- Add `.mcpregistry_*` to `.gitignore` and update CLAUDE.md security section (ADR-0024) (#23)

## v2026.03.15.2

- Switch Glama badge from score to card format (#13)

## v2026.03.15.1

- Add Glama registry badge to README (#13)

## v2026.03.14.5

- Add skill documentation to README and `.claude/skills/README.md` per ADR-0022 (#17)

## v2026.03.14.4

- Add `docs/superpowers/` to `.gitignore` per ADR-0021 (#15)

## v2026.03.14.3

- Add acceptance criteria gate to CLAUDE.md PR Workflow (ADR-0017) (#11)

## v2026.03.14.2

- Clarify license: internal/commercial use requires commercial license (#9)

## v2026.03.14.1

- 42 tools across 7 domains: Zones (4), DNS (9), Diagnostics (4), Tunnels (6), WAF (5), Zero Trust (6), Security & DDoS (8) (#1)
- CloudflareClient with Bearer token auth, multi-zone resolveZoneId, GraphQL Analytics API support (#1)
- 7 skills: dns-management, health (/cf-health), security-audit, tunnel-management, waf-management, zero-trust, incident-response (#1)
- 141 unit tests with vitest, all passing (#1)
- Zod input validation on all tools, structured error handling with CloudflareApiError (#1)

## v2026.03.13.1

- Initial project scaffold: CloudflareClient, validation schemas, error handling
- Repository setup: package.json, tsconfig, CLAUDE.md, README, SECURITY.md
