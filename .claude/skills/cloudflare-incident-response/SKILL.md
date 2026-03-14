---
name: cloudflare-incident-response
description: DDoS/attack emergency response runbook — detect, assess, mitigate, monitor, de-escalate
---

# Cloudflare Incident Response

Emergency response runbook for DDoS attacks and active security incidents. This is a 5-phase workflow: DETECT → ASSESS → MITIGATE → MONITOR → DE-ESCALATE.

**IMPORTANT: Every mitigation action in Phase 3 requires explicit user confirmation. This skill never auto-remediates.**

---

## Phase 1: DETECT

Fire all of these tool calls in parallel immediately:

- `cloudflare_under_attack_status` — is Under Attack Mode already active?
- `cloudflare_security_events` — security events from the **last 1 hour** (short window for active attack)
- `cloudflare_ddos_analytics` — DDoS analytics from the **last 1 hour**
- `cloudflare_zone_health` — zone activation and health status

Produce an immediate **Incident Detection Summary**:

```
INCIDENT DETECTION — [Zone] — [Timestamp]

Under Attack Mode: ON / OFF
Zone Health: active / inactive
Security Events (1h): [count]
DDoS Analytics: [attack windows count]

ASSESSMENT: ACTIVE ATTACK / SUSPECTED ATTACK / NO ATTACK DETECTED
```

If no attack indicators are found, report clearly and stop. Offer to run a full security audit via the `cloudflare-security-audit` skill instead.

---

## Phase 2: ASSESS

Analyze the data from Phase 1 to characterize the attack:

**Traffic Analysis:**
- Top 10 source IPs by request volume (from security events)
- Top 5 source ASNs — is the attack concentrated in specific networks?
- Top 5 source countries — is the attack geographically concentrated?
- Top attacked URI paths — what endpoints are targeted?
- Top user agents — are there identifiable scraper/bot signatures?

**Attack Type Classification:**
- **L3/L4 Volumetric**: High packet/bandwidth volume, not primarily HTTP-layer. Cloudflare mitigates automatically; check if DDoS analytics show this.
- **L7 HTTP Flood**: High HTTP request rate to specific endpoints. Visible in security events.
- **Credential Stuffing**: Repeated POSTs to login endpoints from distributed IPs.
- **Scraping/Bot**: Systematic crawling, high rate from single ASN or user agent.
- **Targeted WAF Bypass**: SQL injection, XSS, path traversal attempts.

**Current Mitigation Status:**
- Is Under Attack Mode already active? When was it enabled?
- Are any IP access block rules already in effect for this attack?
- Are any custom WAF rules already triggered?

**Severity Level:**
- 🔴 CRITICAL: Under Attack Mode needed NOW, zone health degraded, or sustained high-volume events
- 🟡 WARNING: Attack detected but being mitigated, or early-stage indicators
- 🟢 RESOLVED: Events subsiding, no new attack patterns

Present the full assessment to the user before proceeding to mitigation.

---

## Phase 3: MITIGATE

Present each mitigation step to the user **one at a time** and wait for confirmation before executing.

**Step 1 — Enable Under Attack Mode (first response)**

Explain: "This adds a JS challenge to all visitors. Legitimate browsers pass automatically in ~5 seconds. API clients and bots will be blocked. This is the primary defense against L7 HTTP floods."

Ask: "Should I enable Under Attack Mode for [zone]?"

If confirmed: call `cloudflare_security_level_set` with action `under_attack`.
Verify: call `cloudflare_security_level_get` to confirm the change.
Log: record timestamp and action taken.

---

**Step 2 — Block Top Attacking IPs**

From the Phase 2 analysis, identify the top source IPs contributing to the attack.
Present the list: "These are the top [N] IPs. Should I block them?"

For each confirmed IP: call `cloudflare_ip_access_create` with mode `block`.
Note: limit to IPs with clear attack signatures — avoid blocking legitimate IPs.
Log all blocked IPs with timestamp.

---

**Step 3 — Country-Level Block (if attack is geographically concentrated)**

Only suggest this if >80% of attack traffic originates from 1-3 countries AND those countries are not primary user traffic sources.

Explain the business impact: "Blocking [country] will affect ALL visitors from that country, including legitimate users."

Ask: "Should I add a challenge rule for [country]? (Note: this affects all [country] visitors)"

If confirmed: call `cloudflare_ip_access_create` with the country code and mode `challenge` (not block, to avoid false positives).
Log the country challenge rule with timestamp.

---

**Step 4 — Custom WAF Rule (if L7 flood pattern identified)**

If a specific URI path, user agent, or request signature characterizes the attack:

Construct a Cloudflare Ruleset Language expression. Example:
- URI flood: `(http.request.uri.path eq "/api/login" and cf.threat_score gt 10)`
- User agent: `(http.user_agent contains "attacker-bot")`
- Rate pattern: `(http.request.rate gt 100 and http.request.uri.path starts_with "/api")`

Show the expression to the user and explain what it matches.

Ask: "Should I create a WAF block rule for this pattern?"

If confirmed: call `cloudflare_waf_create_custom_rule` with action `block` and the expression.
Log the rule ID and expression with timestamp.

---

## Phase 4: MONITOR

After mitigation steps are applied, wait 2-5 minutes and then re-assess.

Fire in parallel:
- `cloudflare_security_events` — last 15 minutes
- `cloudflare_ddos_analytics` — last 15 minutes
- `cloudflare_zone_health` — current zone health

Report mitigation effectiveness:
- Security events: trending up / stable / trending down?
- Zone health: stable?
- DDoS analytics: attack still active / subsiding / resolved?

**Effectiveness verdict:**
- Events reduced by >50%: mitigation is working — continue monitoring
- Events reduced by >90%: attack largely mitigated — move to de-escalation watch
- Events not reduced: current mitigations insufficient — escalate (see below)

**Escalation if mitigations are not effective:**
- Notify via Slack CRITICAL routing: #infra-monitoring + #infra-alerts + DM to operator
- Suggest contacting Cloudflare support if attack is sustained and beyond WAF capabilities
- Document all actions taken so far for the support ticket

---

## Phase 5: DE-ESCALATE

When attack has clearly subsided (Phase 4 shows >90% reduction and stable zone health):

1. **Disable Under Attack Mode**: Explain impact, ask confirmation, call `cloudflare_security_level_set` to restore previous level (typically `medium`). Verify.

2. **Review temporary IP blocks**: Call `cloudflare_ip_access_list`. Review the blocks created during this incident. Recommend keeping them for **24-48 hours** as attacks often resume. Ask user if any should be removed now.

3. **Review temporary WAF rules**: Call `cloudflare_waf_list_custom_rules`. Identify rules created during this incident. Ask user: "These WAF rules were created during the incident. Should any be kept permanently or should I remove them?" Execute deletions with `cloudflare_waf_delete_custom_rule` upon confirmation.

4. **Generate Post-Incident Summary**:

```
POST-INCIDENT SUMMARY — [Zone] — [Date]

Attack Type: [classification]
Duration: [start time] to [end time]
Peak Volume: [events/hour at peak]

Mitigations Applied:
- [timestamp] Under Attack Mode enabled
- [timestamp] Blocked IPs: [list]
- [timestamp] Country challenge: [countries]
- [timestamp] WAF rules created: [rule IDs]

Resolution:
- [timestamp] Under Attack Mode disabled
- Retained blocks: [list]
- Removed temp rules: [list]

Recommendations:
1. [recommendation]
2. [recommendation]
```

---

## Rules

- **No auto-remediation.** Every mitigation action requires explicit user confirmation.
- Log all actions with timestamps — this is critical for post-incident review.
- Under Attack Mode is always the **first** mitigation step for L7 attacks.
- Recommend keeping IP blocks for 24-48 hours post-incident — attackers often return.
- Country blocks should use `challenge` (not `block`) to minimize impact on legitimate users.
- Escalate to Slack CRITICAL routing if the attack is sustained and mitigations are not effective.
- Always generate a post-incident summary after de-escalation.
- This skill composes with `cloudflare-security-audit` for pre/post-incident analysis.

---

## Key Tools

- `cloudflare_under_attack_status` — check/verify Under Attack Mode status
- `cloudflare_security_events` — security event log with time range filter
- `cloudflare_ddos_analytics` — DDoS analytics with time range filter
- `cloudflare_zone_health` — zone health and activation status
- `cloudflare_security_level_set` — enable/disable Under Attack Mode and set security level
- `cloudflare_security_level_get` — verify current security level
- `cloudflare_ip_access_create` — block or challenge specific IPs, CIDRs, ASNs, or countries
- `cloudflare_ip_access_delete` — remove IP access rules during de-escalation
- `cloudflare_ip_access_list` — list all IP access rules
- `cloudflare_waf_create_custom_rule` — create targeted WAF block rule
- `cloudflare_waf_delete_custom_rule` — remove temporary WAF rules after de-escalation
- `cloudflare_waf_list_custom_rules` — list custom rules for review
