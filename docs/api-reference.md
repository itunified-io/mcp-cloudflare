# Cloudflare API v4 Endpoint Reference

This document maps planned MCP tools to the Cloudflare API v4 endpoints they use.
It will be updated as tool modules are implemented.

Base URL: `https://api.cloudflare.com/client/v4`

## DNS Records

| Tool (planned) | Method | Endpoint |
|----------------|--------|----------|
| `cloudflare_dns_list_records` | GET | `/zones/{zone_id}/dns_records` |
| `cloudflare_dns_get_record` | GET | `/zones/{zone_id}/dns_records/{record_id}` |
| `cloudflare_dns_create_record` | POST | `/zones/{zone_id}/dns_records` |
| `cloudflare_dns_update_record` | PUT | `/zones/{zone_id}/dns_records/{record_id}` |
| `cloudflare_dns_patch_record` | PATCH | `/zones/{zone_id}/dns_records/{record_id}` |
| `cloudflare_dns_delete_record` | DELETE | `/zones/{zone_id}/dns_records/{record_id}` |

## Zones

| Tool (planned) | Method | Endpoint |
|----------------|--------|----------|
| `cloudflare_zones_list` | GET | `/zones` |
| `cloudflare_zones_get` | GET | `/zones/{zone_id}` |
| `cloudflare_zones_get_settings` | GET | `/zones/{zone_id}/settings` |
| `cloudflare_zones_update_setting` | PATCH | `/zones/{zone_id}/settings/{setting_id}` |
| `cloudflare_zones_purge_cache` | POST | `/zones/{zone_id}/purge_cache` |

## Cloudflare Tunnels

| Tool (planned) | Method | Endpoint |
|----------------|--------|----------|
| `cloudflare_tunnels_list` | GET | `/accounts/{account_id}/cfd_tunnel` |
| `cloudflare_tunnels_get` | GET | `/accounts/{account_id}/cfd_tunnel/{tunnel_id}` |
| `cloudflare_tunnels_create` | POST | `/accounts/{account_id}/cfd_tunnel` |
| `cloudflare_tunnels_delete` | DELETE | `/accounts/{account_id}/cfd_tunnel/{tunnel_id}` |
| `cloudflare_tunnels_get_config` | GET | `/accounts/{account_id}/cfd_tunnel/{tunnel_id}/configurations` |
| `cloudflare_tunnels_update_config` | PUT | `/accounts/{account_id}/cfd_tunnel/{tunnel_id}/configurations` |

## WAF / Firewall Rules

| Tool (planned) | Method | Endpoint |
|----------------|--------|----------|
| `cloudflare_waf_list_rulesets` | GET | `/zones/{zone_id}/rulesets` |
| `cloudflare_waf_get_ruleset` | GET | `/zones/{zone_id}/rulesets/{ruleset_id}` |
| `cloudflare_waf_list_custom_rules` | GET | `/zones/{zone_id}/rulesets/phases/http_request_firewall_custom/entrypoint` |
| `cloudflare_waf_create_custom_rule` | POST | `/zones/{zone_id}/rulesets/{ruleset_id}/rules` |
| `cloudflare_waf_delete_custom_rule` | DELETE | `/zones/{zone_id}/rulesets/{ruleset_id}/rules/{rule_id}` |

## Zero Trust — Access

| Tool (planned) | Method | Endpoint |
|----------------|--------|----------|
| `cloudflare_access_list_apps` | GET | `/accounts/{account_id}/access/apps` |
| `cloudflare_access_get_app` | GET | `/accounts/{account_id}/access/apps/{app_id}` |
| `cloudflare_access_list_policies` | GET | `/accounts/{account_id}/access/apps/{app_id}/policies` |
| `cloudflare_access_list_idps` | GET | `/accounts/{account_id}/access/identity_providers` |

## Zero Trust — Gateway

| Tool (planned) | Method | Endpoint |
|----------------|--------|----------|
| `cloudflare_gateway_status` | GET | `/accounts/{account_id}/gateway` |
| `cloudflare_gateway_list_locations` | GET | `/accounts/{account_id}/gateway/locations` |

## Security — IP Access Rules

| Tool (planned) | Method | Endpoint |
|----------------|--------|----------|
| `cloudflare_security_list_ip_rules` | GET | `/zones/{zone_id}/firewall/access_rules/rules` |
| `cloudflare_security_create_ip_rule` | POST | `/zones/{zone_id}/firewall/access_rules/rules` |
| `cloudflare_security_delete_ip_rule` | DELETE | `/zones/{zone_id}/firewall/access_rules/rules/{rule_id}` |

## Analytics (GraphQL)

| Tool (planned) | Method | Endpoint |
|----------------|--------|----------|
| `cloudflare_analytics_security_events` | POST | `/graphql` (Analytics API) |
| `cloudflare_analytics_ddos` | POST | `/graphql` (Analytics API) |

## Notes

- Zone IDs: 32-character hex strings. Tools accept either the raw ID or a zone name (resolved automatically via `GET /zones?name=<name>`).
- Account IDs: Required for account-level operations (Tunnels, Zero Trust). Set `CLOUDFLARE_ACCOUNT_ID` in environment.
- Pagination: Cloudflare uses `page` + `per_page` query parameters. Tools handle pagination where relevant.
- Rate limits: Cloudflare enforces rate limits per API token. The client handles 429 responses with descriptive errors.
