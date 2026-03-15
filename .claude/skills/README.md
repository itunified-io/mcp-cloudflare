# mcp-cloudflare Skills Reference

## Overview

Claude Code skills compose multiple MCP tools into higher-level workflows. Skills are defined in `.claude/skills/<name>/SKILL.md` with YAML frontmatter and are auto-discovered by Claude Code.

**Slash command skills** (`disable-model-invocation: true`) are invoked explicitly by the user via `/command`. **Auto-invocable skills** are triggered automatically by Claude when relevant context is detected.

## Quick Reference

| Skill | Type | Slash Command | Description |
|-------|------|--------------|-------------|
| cloudflare-health | Slash | `/cf-health` | Zone health dashboard — DNS, security, tunnels, WAF, DDoS status |
| cloudflare-live-test | Slash | `/cf-test` | Live integration test — read + safe writes with cleanup |
| cloudflare-dns-management | Auto | — | DNS record management — add, list, update, delete across zones |
| cloudflare-incident-response | Auto | — | DDoS/attack emergency response — detect, assess, mitigate, monitor |
| cloudflare-security-audit | Auto | — | Security posture audit — WAF, events, IP access, DDoS analytics |
| cloudflare-tunnel-management | Auto | — | Tunnel management — create, configure ingress, monitor connections |
| cloudflare-waf-management | Auto | — | WAF management — custom rules, rulesets, IP access, Under Attack |
| cloudflare-zero-trust | Auto | — | Zero Trust — access apps, policies, identity providers, gateway |
| cloudflare-kv-manage | Auto | — | Workers KV — namespace and key-value CRUD operations |
| cloudflare-worker-deploy | Auto | — | Workers — script deployment, routes, secrets, analytics |

---

## Skill Details

### cloudflare-health (`/cf-health`)

**Type:** Slash command
**Description:** Generates a comprehensive Cloudflare health snapshot covering zone status, DNS records, DNSSEC, security level, tunnels, WAF rulesets, rate limiting, and Under Attack Mode. Used by scheduled monitoring agents and on-demand by operators.

**Tools used:**
- `cloudflare_zone_list` — List all zones
- `cloudflare_zone_health` — Zone health summary
- `cloudflare_dns_list` — DNS record counts
- `cloudflare_dnssec_status` — DNSSEC status
- `cloudflare_token_verify` — API token verification
- `cloudflare_tunnel_list` — Tunnel status
- `cloudflare_waf_list_rulesets` — WAF ruleset overview
- `cloudflare_under_attack_status` — Under Attack Mode check
- `cloudflare_rate_limit_status` — Rate limiting status

**Usage:** `/cf-health`

---

### cloudflare-live-test (`/cf-test`)

**Type:** Slash command
**Description:** Runs live integration tests against the Cloudflare API to verify all MCP tools work correctly. Tests read-only tools and performs safe write+cleanup cycles for DNS records and IP access rules.

**Tools used:** All 42 tools across all domains (zones, DNS, tunnels, WAF, Zero Trust, security, diagnostics).

**Usage:** `/cf-test` (all domains) or `/cf-test dns` (single domain)

**Available domains:** `zones`, `dns`, `tunnels`, `waf`, `zerotrust`, `security`, `diagnostics`

---

### cloudflare-dns-management

**Type:** Auto-invocable
**Description:** Manages DNS records across Cloudflare zones. Covers creating, listing, updating, deleting, importing, exporting records, and checking DNSSEC status. Handles multi-zone scenarios automatically.

**Tools used:**
- `cloudflare_zone_list` — List zones (for zone ID resolution)
- `cloudflare_dns_list` — List DNS records
- `cloudflare_dns_create` — Create DNS record
- `cloudflare_dns_get` — Get record details
- `cloudflare_dns_update` — Update DNS record
- `cloudflare_dns_delete` — Delete DNS record
- `cloudflare_dns_search` — Search records
- `cloudflare_dns_export` — Export zone file (BIND format)
- `cloudflare_dns_import` — Import zone file
- `cloudflare_dnssec_status` — DNSSEC status

**Triggers:** User asks to add, update, delete, list, or manage DNS records.

---

### cloudflare-incident-response

**Type:** Auto-invocable
**Description:** Emergency response runbook for DDoS attacks and active security incidents. Five-phase workflow: DETECT, ASSESS, MITIGATE, MONITOR, DE-ESCALATE. Every mitigation action requires explicit user confirmation.

**Tools used:**
- `cloudflare_security_events` — Recent security events
- `cloudflare_ddos_analytics` — DDoS attack analytics
- `cloudflare_zone_health` — Zone health status
- `cloudflare_under_attack_status` — Under Attack Mode check
- `cloudflare_security_level_get` / `cloudflare_security_level_set` — Security level
- `cloudflare_ip_access_list` / `cloudflare_ip_access_create` / `cloudflare_ip_access_delete` — IP access rules
- `cloudflare_waf_list_custom_rules` / `cloudflare_waf_create_custom_rule` / `cloudflare_waf_delete_custom_rule` — WAF rules

**Triggers:** User reports an attack, DDoS, unusual traffic, or security incident.

---

### cloudflare-security-audit

**Type:** Auto-invocable
**Description:** Audits the security posture of Cloudflare zones. Reviews active threats, WAF configuration, security events, IP access rules, and DDoS analytics. Produces a structured audit report with findings and recommendations.

**Tools used:**
- `cloudflare_waf_list_rulesets` — WAF rulesets overview
- `cloudflare_waf_list_custom_rules` — Custom WAF rules
- `cloudflare_security_events` — Recent security events
- `cloudflare_ddos_analytics` — DDoS analytics
- `cloudflare_ip_access_list` — IP access rules
- `cloudflare_under_attack_status` — Under Attack Mode

**Triggers:** User asks for a security review, audit, or posture assessment.

---

### cloudflare-tunnel-management

**Type:** Auto-invocable
**Description:** Manages Cloudflare Tunnels (formerly Argo Tunnel). Covers listing tunnels, viewing details and ingress configuration, creating new tunnels, updating ingress rules, and deleting tunnels.

**Tools used:**
- `cloudflare_zone_list` — List zones (for ingress routing)
- `cloudflare_tunnel_list` — List tunnels
- `cloudflare_tunnel_get` — Get tunnel details
- `cloudflare_tunnel_config_get` — Get tunnel ingress config
- `cloudflare_tunnel_config_update` — Update ingress config
- `cloudflare_tunnel_create` — Create new tunnel
- `cloudflare_tunnel_delete` — Delete tunnel

**Triggers:** User asks to create, configure, or manage Cloudflare Tunnels.

---

### cloudflare-waf-management

**Type:** Auto-invocable
**Description:** Manages the Cloudflare Web Application Firewall. Covers listing and viewing rulesets, creating and deleting custom rules, managing IP access rules, and emergency DDoS response including Under Attack Mode.

**Tools used:**
- `cloudflare_zone_list` — List zones
- `cloudflare_waf_list_rulesets` — List rulesets
- `cloudflare_waf_get_ruleset` — Get ruleset details
- `cloudflare_waf_list_custom_rules` — List custom rules
- `cloudflare_waf_create_custom_rule` — Create custom rule
- `cloudflare_waf_delete_custom_rule` — Delete custom rule
- `cloudflare_ip_access_list` / `cloudflare_ip_access_create` / `cloudflare_ip_access_delete` — IP access rules
- `cloudflare_security_level_get` / `cloudflare_security_level_set` — Security level

**Triggers:** User asks to manage WAF rules, IP access rules, or security level.

---

### cloudflare-zero-trust

**Type:** Auto-invocable
**Description:** Manages Cloudflare Zero Trust (formerly Cloudflare Access and Teams). Covers listing and managing access applications, access policies, identity providers (IdPs), and Gateway status.

**Tools used:**
- `cloudflare_zt_list_apps` — List Access applications
- `cloudflare_zt_get_app` — Get application details
- `cloudflare_zt_list_policies` — List Access policies
- `cloudflare_zt_create_policy` — Create Access policy
- `cloudflare_zt_list_idps` — List identity providers
- `cloudflare_zt_gateway_status` — Gateway status

**Triggers:** User asks to manage Zero Trust applications, policies, or identity providers.

---

### cloudflare-kv-manage

**Type:** Auto-invocable
**Description:** Manages Workers KV namespaces and key-value pairs. Covers creating namespaces, listing keys, reading and writing values, setting TTLs, and deleting keys and namespaces.

**Tools used:**
- `cloudflare_kv_namespace_list` — List all KV namespaces
- `cloudflare_kv_namespace_create` — Create a new namespace
- `cloudflare_kv_namespace_delete` — Delete a namespace (destructive)
- `cloudflare_kv_list_keys` — List keys with optional prefix filter
- `cloudflare_kv_read` — Read value by key
- `cloudflare_kv_write` — Write key-value pair with optional TTL
- `cloudflare_kv_delete` — Delete a key

**Triggers:** User asks to manage KV namespaces, store/retrieve values, or work with Workers KV.

---

### cloudflare-worker-deploy

**Type:** Auto-invocable
**Description:** Deploys and manages Cloudflare Workers scripts. Covers listing workers, deploying scripts, configuring routes, managing secrets, and viewing analytics. Handles the full deployment lifecycle.

**Tools used:**
- `cloudflare_worker_list` — List all worker scripts
- `cloudflare_worker_deploy` — Deploy a worker script (multipart upload)
- `cloudflare_worker_delete` — Delete a worker script (destructive)
- `cloudflare_worker_route_list` — List routes for a zone
- `cloudflare_worker_route_create` — Create a route for a zone
- `cloudflare_worker_secret_list` — List secret names
- `cloudflare_worker_secret_set` — Set a secret (value never echoed)
- `cloudflare_worker_secret_delete` — Delete a secret
- `cloudflare_worker_analytics` — Time-series invocation metrics
- `cloudflare_worker_usage` — Per-script aggregated usage

**Triggers:** User asks to deploy workers, manage worker routes or secrets, or view worker analytics.
