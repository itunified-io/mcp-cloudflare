---
name: cloudflare-health
description: Cloudflare zone health dashboard — DNS, security, tunnels, WAF, DDoS status
disable-model-invocation: true
---

# Cloudflare Health Dashboard

Workflow skill for generating a comprehensive Cloudflare health snapshot. Invoked via `/cf-health` or when the user asks for a Cloudflare status overview. Used by the scheduled monitoring agent and on-demand by operators.

---

## Workflow: Generate Health Dashboard

### Phase 1 — Gather Data in Parallel

Maximize concurrent tool calls. Fire all of these simultaneously:

- `cloudflare_token_verify` — verify API token validity and permissions
- `cloudflare_zone_list` — retrieve all configured zones
- `cloudflare_tunnel_list` — get all tunnels and their connection status
- `cloudflare_rate_limit_status` — check current API rate limit consumption
- `cloudflare_security_insights_severity_count` — Security Center insight severity overview

Once zones are returned, for **each zone in parallel**:
- `cloudflare_zone_health` — zone activation status, nameservers, plan
- `cloudflare_under_attack_status` — current security mode
- `cloudflare_waf_list_rulesets` — list active WAF rulesets
- `cloudflare_dns_list` — get DNS record count (can use a count/summary call if available)
- `cloudflare_dnssec_status` — DNSSEC enabled status
- `cloudflare_ssl_setting_get` — current SSL/TLS encryption mode
- `cloudflare_tls_setting_get` — minimum TLS version
- `cloudflare_certificate_list` — certificate packs (check expiry)
- `cloudflare_ssl_verification` — SSL verification status
- `cloudflare_rate_limit_list` — rate limiting rules configured

If `cloudflare_security_insights_severity_count` returns any `critical` count > 0:
- `cloudflare_security_insights` with `severity=critical` — fetch details of critical findings

### Phase 2 — Format Dashboard

Produce a structured dashboard with the following sections:

---

**🌐 Zone Status**

| Zone | Status | Plan | Nameservers |
|------|--------|------|-------------|
| example.com | active | free | ns1.cf.com, ns2.cf.com |

---

**🔒 Security**

| Zone | Security Level | Under Attack Mode |
|------|---------------|-------------------|
| example.com | medium | OFF |

---

**🛡️ WAF**

| Zone | Active Rulesets | Custom Rules |
|------|----------------|--------------|
| example.com | 3 | 2 |

---

**🔗 Tunnels**

| Name | ID | Status | Active Connections |
|------|----|--------|-------------------|
| home-tunnel | abc123 | healthy | 2 |

---

**📊 DNS**

| Zone | Record Count | DNSSEC |
|------|-------------|--------|
| example.com | 42 | enabled |

---

**🔐 SSL/TLS**

| Zone | SSL Mode | Min TLS | Cert Status | Nearest Expiry | Verification |
|------|----------|---------|-------------|----------------|--------------|
| example.com | strict | 1.2 | active | 2026-06-15 (90d) | passed |

---

**⏱️ Rate Limiting**

| Zone | Rules | Enabled | Disabled | Actions |
|------|-------|---------|----------|---------|
| example.com | 3 | 2 | 1 | ban: 2, challenge: 1 |

---

**⚡ API Health**

- Token: valid / invalid
- Rate limit usage: X/1000 (X%)
- Remaining requests: Y

---

**🔍 Security Center Insights**

| Severity | Count |
|----------|-------|
| Critical | 2 |
| Moderate | 3 |
| Low | 5 |

If critical findings exist, list them:

| Subject | Issue Type | Since | Resolve |
|---------|-----------|-------|---------|
| example.com | exposed_infrastructure | 2026-02-04 | [Fix](https://dash.cloudflare.com/...) |

If no active findings: display "No active Security Center insights."

---

### Phase 3 — Severity Assessment

Evaluate all collected data and assign an overall severity level:

**🟢 HEALTHY** — All of the following are true:
- API token is valid
- All zones have status `active`
- Under Attack Mode is OFF on all zones
- All configured tunnels have at least one healthy connection
- API rate limit usage is below 80%
- WAF has at least one ruleset configured per zone

**🟡 WARNING** — Any of the following:
- Under Attack Mode is active on one or more zones (may indicate ongoing/recent attack)
- One or more tunnels are degraded (connected but with errors) or have 0 active connections
- API rate limit usage is between 80% and 95%
- DNSSEC is disabled on a zone where it was previously enabled
- A zone has fewer WAF rulesets than expected
- One or more `moderate` Security Center insights are active (not dismissed)
- SSL/TLS mode is `flexible` (not end-to-end encrypted)
- Minimum TLS version is `1.2` (acceptable but not optimal)
- Any SSL certificate expires within 30 days
- A production zone has zero rate limiting rules
- SSL verification has pending or failed checks

**🔴 CRITICAL** — Any of the following:
- One or more zones have status other than `active`
- All tunnels for a zone are down (no healthy connections)
- API token is invalid or expired
- API rate limit usage is above 95%
- One or more `critical` Security Center insights are active (not dismissed)
- SSL/TLS mode is `off` or `flexible` on a production zone
- Minimum TLS version is below `1.2`
- Any SSL certificate expires within 7 days or has expired
- SSL verification has failed for any hostname

Display the overall severity prominently at the top of the report.

---

### Phase 4 — Slack Notification Routing (Scheduled Agent Use)

After assessment, route the notification as follows:

- **🟢 HEALTHY**: Post summary to `#infra-monitoring` only.
- **🟡 WARNING**: Post summary to `#infra-monitoring` AND `#infra-alerts`.
- **🔴 CRITICAL**: Post summary to `#infra-monitoring` AND `#infra-alerts` AND send a direct message to the operator on duty.

All Slack messages must include:
- Severity level with emoji
- Timestamp of the check
- Brief summary of findings (2-3 lines)
- Link or note to run `/cf-health` for full details

---

### Phase 5 — Issue Creation for Critical Findings

Issue creation backend is configurable (set during setup wizard or in config):

| Backend | Description | Duplicate Check |
|---------|-------------|-----------------|
| **Dashboard** (default) | Store in local SQLite, display in Grafana "Security Issues" panel | Query SQLite by subject + status=open |
| **GitHub** | `gh issue create` with labels in configured repo | `gh issue list --search "<subject>"` |
| **Jira** | Create via Atlassian MCP (`createJiraIssue`) in configured project | JQL search by summary |

The active backend is determined by the `ISSUE_BACKEND` config value (`dashboard`, `github`, `jira`).

#### GitHub Backend

For each **critical** Security Center insight (not dismissed), auto-create a GitHub issue in the configured repo:

1. **Duplicate check**: Search for existing open issues matching the insight subject:
   ```
   gh issue list --repo itunified-io/infrastructure --label "type:security,infra:cloudflare" --state open --search "<subject>"
   ```
   Skip if a matching issue already exists.

2. **Create issue** if no duplicate:
   - **Title:** `security: CF Security Center — <issue_type> on <subject>`
   - **Labels:** `infra:cloudflare`, `type:security`, `priority:high`
   - **Body:**
     ```markdown
     ## Cloudflare Security Center Finding

     | Field | Value |
     |-------|-------|
     | Severity | Critical |
     | Subject | <subject> |
     | Type | <issue_type> |
     | Class | <issue_class> |
     | Since | <since> |
     | Resolve | [<resolve_text>](<resolve_link>) |

     ## Details
     <payload summary — key fields from the insight payload>

     ## Recommended Action
     <resolve_text> — follow the resolve link above.

     ---
     *Auto-created by `/cf-health` scheduled task*
     ```

3. **Slack notification**: Include the newly created GH issue URL(s) in the `#infra-alerts` message alongside the severity summary.

#### Jira Backend

For each **critical** finding, create a Jira issue via Atlassian MCP:

1. **Duplicate check**: `searchJiraIssuesUsingJql` with `summary ~ "<subject>" AND status != Done`
2. **Create issue** if no duplicate: `createJiraIssue` with configured project key, issue type `Bug`, priority `High`
3. **Slack notification**: Include Jira issue key and URL in alerts.

#### Dashboard Backend (Default)

For each finding (WARNING + CRITICAL), store in local SQLite:

1. **Duplicate check**: Query `issues` table where `subject = "<subject>" AND status = "open"`
2. **Insert** if no duplicate: `INSERT INTO issues (subject, issue_type, severity, since, payload, status, created_at)`
3. **Grafana panel**: Pre-provisioned "Security Issues" panel reads from SQLite via JSON API datasource
4. No external system required — works out of the box with the Docker stack.

---

## Rules

- Always run data gathering in parallel — never sequentially — to minimize latency.
- This skill is read-only; it never modifies Cloudflare configuration.
- If the API token is invalid, report CRITICAL immediately and skip all further tool calls.
- If a zone returns an error, mark that zone as UNKNOWN and continue with other zones.
- Scheduled agents using this skill must not take remediation actions — only report and notify.
- The dashboard is a point-in-time snapshot; include the check timestamp in all reports.

---

## Key Tools

- `cloudflare_token_verify` — verify API connectivity and token validity
- `cloudflare_zone_list` — list all zones with status and plan info
- `cloudflare_zone_health` — per-zone health details (nameservers, activation status)
- `cloudflare_under_attack_status` — per-zone Under Attack Mode status
- `cloudflare_tunnel_list` — list tunnels with connection health
- `cloudflare_waf_list_rulesets` — list active WAF rulesets per zone
- `cloudflare_dns_list` — DNS records (used for count)
- `cloudflare_dnssec_status` — DNSSEC status per zone
- `cloudflare_rate_limit_status` — API rate limit consumption
- `cloudflare_security_insights_severity_count` — Security Center insight severity overview
- `cloudflare_security_insights` — detailed Security Center findings (filtered by severity)
- `cloudflare_ssl_setting_get` — SSL/TLS encryption mode per zone
- `cloudflare_tls_setting_get` — minimum TLS version per zone
- `cloudflare_certificate_list` — certificate packs with expiry dates
- `cloudflare_ssl_verification` — SSL verification status per zone
- `cloudflare_rate_limit_list` — rate limiting rules per zone
