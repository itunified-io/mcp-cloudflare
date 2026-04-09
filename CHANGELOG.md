# Changelog

All notable changes to this project will be documented in this file.
This project uses [Calendar Versioning](https://calver.org/) (`YYYY.MM.DD.TS`).


## v2026.04.09.1

- **Vault AppRole secret loading** (#59)
  - New opportunistic loader reads `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` from HashiCorp Vault at startup
  - Configured via `NAS_VAULT_ADDR` + `NAS_VAULT_ROLE_ID` + `NAS_VAULT_SECRET_ID` (optional `NAS_VAULT_KV_MOUNT`, default `kv`)
  - KV v2 path: `<mount>/data/cloudflare/api` — keys `api_token`, `account_id`
  - Precedence: `process.env` (explicit) > Vault — fully backwards compatible (silent no-op if `NAS_VAULT_ADDR` is unset)
  - Vault errors log a single stderr line and never fatal — the server falls back to existing env vars
  - Secret values are never logged; only the KV path name and a populated-count appear in diagnostics
  - No new runtime dependencies — uses global `fetch` (Node 20+)

## v2026.03.21.1

- **feat: add cloudflare_cache_purge tool** (#57) — purge CF edge cache
  - Purge specific URLs, cache tags, URL prefixes, or everything
  - Zone-level tool in `src/tools/zones.ts`
  - Requires `Cache Purge:Edit` API token permission
  - 1 new tool (total: 76), 4 new tests, 317 tests passing

## v2026.03.19.1

- **feat: Zero Trust delete tools** (#55) — complete CRUD lifecycle for ZT Access resources
  - `cloudflare_zt_delete_app` — delete ZT Access applications
  - `cloudflare_zt_delete_policy` — delete ZT Access policies
  - `cloudflare_zt_delete_idp` — delete ZT identity providers
  - 3 new tools (total: 75), 6 new tests, 313 tests passing

## v2026.03.18.1

- **feat: `cloudflare_tunnel_token` tool** (#53)
  - Retrieve the connector JWT token for a Cloudflare Tunnel
  - Required for deploying cloudflared to K8s or Docker
  - 7 tunnel tools total (was 6)
  - 307 tests passing (was 305)

## v2026.03.17.4

- **feat: DNSSEC write tools** (#96)
  - `cloudflare_dnssec_enable` — enable DNSSEC for a zone (POST)
  - `cloudflare_dnssec_disable` — disable DNSSEC for a zone (PATCH with status=disabled)

## v2026.03.17.3

- **feat: SSL/TLS certificate management tools** (#89)
  - `cloudflare_certificate_list` — list certificate packs with status filter
  - `cloudflare_certificate_get` — get specific certificate pack details
  - `cloudflare_ssl_setting_get` / `cloudflare_ssl_setting_set` — SSL/TLS encryption mode (off/flexible/full/strict)
  - `cloudflare_ssl_verification` — SSL verification status per zone
  - `cloudflare_tls_setting_get` / `cloudflare_tls_setting_set` — minimum TLS version
  - Added `CertificatePack` and `SslVerification` types
- **feat: rate limiting read tools** (#90)
  - `cloudflare_rate_limit_list` — list rate limiting rules with pagination
  - `cloudflare_rate_limit_get` — get specific rate limit rule details
  - `cloudflare_rate_limit_status` — summary with enabled/disabled/action breakdown
- **feat: expand `/cf-health` with SSL/TLS + rate limiting checks** (#92)
  - Phase 1: gather SSL settings, TLS version, certificate packs, rate limits per zone
  - Phase 2: new SSL/TLS and Rate Limiting dashboard sections
  - Phase 3: WARNING for flexible SSL, cert <30d, no rate limits; CRITICAL for off SSL, TLS <1.2, cert <7d
- **feat: issue creation toggle route** (#93)
  - Phase 5 now supports Dashboard (SQLite+Grafana), GitHub, and Jira backends
  - Configured via `ISSUE_BACKEND` environment variable
- **chore: npm scope renamed to `@itunified.io`**
- **fix: dns_search tests updated for client-side filtering**
- **docs: MCP tool placement review gate added to CLAUDE.md (ADR-0041)**

## v2026.03.17.1

- **feat: add Security Center insights tools** (#51)
  - `cloudflare_security_insights` — list Security Center findings with severity/type/dismissed filters
  - `cloudflare_security_insights_severity_count` — severity counts overview (low/moderate/critical)
  - Account-level API: `GET /accounts/{id}/security-center/insights`
  - Added `SecurityInsight` type definitions
- **feat: update `/cf-health` skill with Security Center integration** (#51)
  - Phase 1: gather Security Center severity counts in parallel
  - Phase 2: new Security Center Insights dashboard section
  - Phase 3: critical insights → CRITICAL severity, moderate → WARNING
  - Phase 5 (new): auto-create GitHub issues for critical findings with duplicate prevention
  - Slack #infra-alerts includes GH issue links for critical findings

## v2026.03.16.11

- **Fix R2 domain_add: include zoneId in request body** (#47)
  - CF API requires `zoneId` field in POST body for custom domain registration
  - Added `zone_id` param (supports zone name auto-resolution)
  - Added optional `enabled` param (default: true)

## v2026.03.16.10

- **Fix R2 custom domain API path and HTTP method** (#47)
  - Correct path: `/domains/custom` (not `/custom_domains`)
  - Correct method: POST for add (not PUT)
  - Verified against CF API docs

## v2026.03.16.9

- **Fix R2 custom domain API path** (#47)
  - CF API v4 uses `/custom_domains` not `/domains` for R2 bucket domain endpoints
  - Fixed all 3 domain tools: `domain_list`, `domain_add`, `domain_remove`

## v2026.03.16.8

- **Add R2 custom domain management tools** (#45)
  - 3 new tools: `cloudflare_r2_bucket_domain_list`, `cloudflare_r2_bucket_domain_add`, `cloudflare_r2_bucket_domain_remove`
  - Attach/remove custom domains to R2 buckets for public access
  - CF auto-creates CNAME DNS records when domains are attached
  - 4 new unit tests (28 total R2 tests)
  - R2 tools now total 10 (bucket CRUD + object ops + domain management)

## v2026.03.16.7

- **Add R2 storage management tools** (#43)
  - 7 new tools: `cloudflare_r2_bucket_list`, `cloudflare_r2_bucket_create`, `cloudflare_r2_bucket_get`, `cloudflare_r2_bucket_delete`, `cloudflare_r2_object_list`, `cloudflare_r2_object_get`, `cloudflare_r2_object_delete`
  - Bucket CRUD via REST API (`/accounts/{id}/r2/buckets`)
  - Object listing and metadata via REST API (`/accounts/{id}/r2/buckets/{name}/objects`)
  - Zod validation schemas: `R2BucketNameSchema`, `R2ObjectKeySchema`, `R2LocationHintSchema`
  - 24 unit tests covering all tools, validation errors, and API error handling
  - New skill: `cloudflare-r2-manage` — R2 bucket and object management workflows

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
