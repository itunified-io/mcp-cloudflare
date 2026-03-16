# Changelog

All notable changes to this project will be documented in this file.
This project uses [Calendar Versioning](https://calver.org/) (`YYYY.MM.DD.TS`).


## v2026.03.16.6

- **Add Web Analytics (RUM) tools** (#41)
  - 5 new tools: `cloudflare_web_analytics_list`, `cloudflare_web_analytics_create`, `cloudflare_web_analytics_get`, `cloudflare_web_analytics_delete`, `cloudflare_web_analytics_stats`
  - CRUD via REST API (`/accounts/{id}/rum/site_info`)
  - Stats via GraphQL (`httpRequestsAdaptiveGroups`) with configurable time range and limit
  - 19 unit tests covering all tools, validation errors, and API error handling

## v2026.03.16.3

- **Add `cloudflare_zt_create_idp` tool for Zero Trust IdP management** (#39)
  - Create identity providers: GitHub, Google, SAML, OIDC, Azure AD, Okta, one-time PIN
  - `client_secret` automatically redacted in response output (security)
  - Zod validation for all parameters including IdP type enum
  - 5 unit tests covering success, validation errors, missing account ID

## v2026.03.16.2

- **Fix boolean parameter validation across 6 tools** (#37)
  - MCP protocol sends boolean params as strings ("true"/"false"), Zod `z.boolean()` rejects them
  - Add `CoercedBooleanSchema` to `src/utils/validation.ts` using `z.preprocess()` for string→boolean coercion
  - Fixed tools: `cloudflare_dns_list`, `cloudflare_dns_create`, `cloudflare_dns_update` (proxied), `cloudflare_tunnel_list` (is_deleted), `cloudflare_zt_create_app` (auto_redirect_to_identity, app_launcher_visible), `cloudflare_zone_setting_update` (value union)
  - Updated shared `ProxiedSchema` to use `CoercedBooleanSchema`

## v2026.03.16.1

- **Add `cloudflare_worker_deploy_project` tool** (#35)
  - Deploy multi-file TypeScript Workers projects using wrangler
  - Parameters: `project_path` (required), `environment` (optional, e.g., 'uat', 'production')
  - Uses `execFileSync` (no shell invocation) for security
  - Validates project directory and wrangler.toml existence before deployment
  - Passes `CLOUDFLARE_API_TOKEN` from MCP server environment
  - 6 new tests (deploy, env flag, missing dir, missing toml, missing params, exec errors)
  - Tool count: 60 → 61

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
