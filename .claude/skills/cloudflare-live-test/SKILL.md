---
name: cf-test
description: Live integration test for all Cloudflare MCP tools — read + safe writes with cleanup
disable-model-invocation: true
---

# Cloudflare Live Test (/cf-test)

Run live integration tests against the Cloudflare API to verify all MCP tools work correctly.

**Usage:** `/cf-test` (all domains) or `/cf-test <domain>` (single domain)
**Available domains:** zones, dns, tunnels, waf, zerotrust, security, diagnostics

## Test Protocol

### For each test:
1. Call the MCP tool with test parameters
2. Verify the response is valid (no errors, expected structure)
3. For WRITE tests: verify the entry was created, then CLEANUP and verify removal
4. Record result: PASS / FAIL / SKIP / ERROR

### Bug Handling
If a tool returns an unexpected error or wrong data:
1. Record the failure with: tool name, input params, expected vs actual result
2. Create a GitHub issue in this repo with label `bug` including the failure details
3. Continue testing remaining tools — do NOT stop on first failure

### Cleanup Rules
- All WRITE tests MUST have a matching CLEANUP step
- Test entries use prefix `MCP-TEST` or `_mcp-test` for easy identification
- After all tests in a domain: verify NO test entries remain
- If cleanup fails: report as CRITICAL in results and attempt manual cleanup

## Test Matrix

### Zones Domain (domain: `zones`)

**Read tests:**
1. `cloudflare_zone_list` — list zones, expect ≥1 zone
2. `cloudflare_zone_get` — get first zone from list by name
3. `cloudflare_zone_setting_get` — get `ssl` setting for first zone

**SKIP:** `cloudflare_zone_setting_update` — would change live zone settings

### DNS Domain (domain: `dns`)

**Read tests:**
1. `cloudflare_dns_list` — list records for first zone
2. `cloudflare_dns_export` — export zone file in BIND format
3. `cloudflare_dnssec_status` — check DNSSEC status

**Write + Cleanup cycle — TXT Record:**
4. `cloudflare_dns_create` — create TXT record: name `_mcp-test`, content `mcp-live-test-v1`, zone (use first zone from zones test)
5. `cloudflare_dns_get` — VERIFY: get record by ID from step 4
6. `cloudflare_dns_search` — VERIFY: search for `_mcp-test`, confirm it appears
7. `cloudflare_dns_update` — update content to `mcp-live-test-v2`
8. `cloudflare_dns_get` — VERIFY: confirm updated content
9. `cloudflare_dns_delete` — CLEANUP: delete record by ID
10. `cloudflare_dns_list` — VERIFY: confirm `_mcp-test` is gone

**SKIP:** `cloudflare_dns_import` — would bulk-import records

### Tunnels Domain (domain: `tunnels`)

**Read tests:**
1. `cloudflare_tunnel_list` — list tunnels
2. `cloudflare_tunnel_get` — get first tunnel details (if any tunnels exist)
3. `cloudflare_tunnel_config_get` — get tunnel config (if tunnel exists)

**SKIP:** `cloudflare_tunnel_create` — would create real tunnel
**SKIP:** `cloudflare_tunnel_delete` — destructive
**SKIP:** `cloudflare_tunnel_config_update` — would change live tunnel config

### WAF Domain (domain: `waf`)

**Read tests:**
1. `cloudflare_waf_list_rulesets` — list rulesets for first zone
2. `cloudflare_waf_get_ruleset` — get first ruleset details (if any exist)
3. `cloudflare_waf_list_custom_rules` — list custom rules

**SKIP:** `cloudflare_waf_create_custom_rule` — would create live WAF rule
**SKIP:** `cloudflare_waf_delete_custom_rule` — would delete live WAF rule

### Zero Trust Domain (domain: `zerotrust`)

**Read tests:**
1. `cloudflare_zt_list_apps` — list Access applications
2. `cloudflare_zt_list_policies` — list Access policies
3. `cloudflare_zt_list_idps` — list identity providers
4. `cloudflare_zt_gateway_status` — get gateway status
5. `cloudflare_zt_get_app` — get first app details (if any apps exist, otherwise skip)

**SKIP:** `cloudflare_zt_create_policy` — would create live Access policy

### Security Domain (domain: `security`)

**Read tests:**
1. `cloudflare_security_level_get` — get security level for first zone
2. `cloudflare_under_attack_status` — check Under Attack Mode
3. `cloudflare_security_events` — get recent security events (last 24h)
4. `cloudflare_ddos_analytics` — get DDoS analytics
5. `cloudflare_ip_access_list` — list IP access rules

**Write + Cleanup cycle — IP Access Rule:**
6. `cloudflare_ip_access_create` — create IP access rule: mode `whitelist`, ip `192.0.2.1` (TEST-NET per RFC 5737), notes `MCP-TEST`
7. `cloudflare_ip_access_list` — VERIFY: confirm rule with note `MCP-TEST` appears
8. `cloudflare_ip_access_delete` — CLEANUP: delete rule by ID from step 6
9. `cloudflare_ip_access_list` — VERIFY: confirm `MCP-TEST` rule is gone

**SKIP:** `cloudflare_security_level_set` — would change live security level

### Diagnostics Domain (domain: `diagnostics`)

**Read tests:**
1. `cloudflare_account_info` — get account info
2. `cloudflare_token_verify` — verify API token validity
3. `cloudflare_zone_health` — get zone health for first zone
4. `cloudflare_rate_limit_status` — check API rate limit consumption

## Results Dashboard

After all tests complete, present results in this format:

```
## Cloudflare Live Test Results — [DATE]

### Summary
- Total tools: 42
- Tested: [N] | Skipped: [N]
- PASS: [N] | FAIL: [N] | ERROR: [N]
- Write+Cleanup cycles: [N] completed, [N] failed
- Bugs created: [N] (list issue URLs)

### Per Domain
| Domain | Tools | Tested | Pass | Fail | Skip |
|--------|-------|--------|------|------|------|
| Zones | 4 | ... | ... | ... | ... |
| DNS | 9 | ... | ... | ... | ... |
| Tunnels | 6 | ... | ... | ... | ... |
| WAF | 5 | ... | ... | ... | ... |
| Zero Trust | 6 | ... | ... | ... | ... |
| Security | 8 | ... | ... | ... | ... |
| Diagnostics | 4 | ... | ... | ... | ... |

### Failures (if any)
| Tool | Input | Expected | Actual | Issue |
|------|-------|----------|--------|-------|
| ... | ... | ... | ... | #XX |

### Cleanup Status
- [ ] All test entries removed
- [ ] No `_mcp-test` / `MCP-TEST` entries remain in any domain
```

## Slack Reporting

Post a concise summary to Slack (channel provided by the caller):

```
🧪 Cloudflare Live Test — [DATE]
Tested: [N]/42 | ✅ [N] Pass | ❌ [N] Fail | ⏭️ [N] Skip
Write+Cleanup: [N]/[N] clean
Bugs: [N] created ([issue URLs])
```

## Important

- This is a TEST skill — it creates and deletes test entries. Never leave test data behind.
- Use `_mcp-test` / `MCP-TEST` prefix for ALL test entries so they're easily identifiable.
- The DNS test record uses `_mcp-test` (underscore prefix) — this is a valid TXT record name that won't conflict with real records.
- The IP access rule test uses `192.0.2.1` (TEST-NET per RFC 5737) — this IP is reserved for documentation and will never affect real traffic.
- If a CLEANUP step fails, try again. If it still fails, report as CRITICAL.
- Some domains may have no existing resources (e.g., no tunnels, no ZT apps) — handle empty lists gracefully and mark as PASS.
