---
name: cloudflare-security-audit
description: Audit Cloudflare security posture — WAF rules, security events, IP access rules, DDoS status
---

# Cloudflare Security Audit

Workflow skill for auditing the security posture of Cloudflare zones. Reviews active threats, WAF configuration, security events, IP access rules, and DDoS analytics. Produces a structured audit report with findings and recommendations.

---

## Workflow: Run Security Audit

### Phase 1 — Gather Security Data in Parallel

For each zone, fire all of these tool calls simultaneously:

- `cloudflare_under_attack_status` — current security level and Under Attack Mode state
- `cloudflare_security_events` — security events from the **last 24 hours**
- `cloudflare_ddos_analytics` — DDoS analytics from the **last 24 hours**
- `cloudflare_waf_list_rulesets` — configured WAF rulesets (managed + custom)
- `cloudflare_waf_list_custom_rules` — all custom WAF rules (expressions, actions)
- `cloudflare_ip_access_list` — IP access rules (blocked IPs, challenged ranges, allowed ranges)

### Phase 2 — Analyze Security Data

Process the collected data and produce an analysis per zone:

**Active Attack Status:**
- Is Under Attack Mode currently enabled? Note start time if known.
- Current security level (off, essentially_off, low, medium, high, under_attack).
- Any active DDoS mitigations in effect.

**Security Events Summary (Last 24h):**
- Total event count by action type: blocked, challenged, jschallenge, managed_challenge, log.
- Top 10 source IPs by event count.
- Top 5 source countries by event count.
- Top 5 source ASNs by event count.
- Top attack vectors (URI paths, user agents, rule IDs triggered).

**DDoS Analytics Summary (Last 24h):**
- Peak request rate during any attack windows.
- Attack types detected (volumetric L3/L4, L7 HTTP flood, application-layer).
- Duration and mitigation effectiveness.

**WAF Configuration Audit:**
- Number of managed rulesets enabled and their sensitivity levels.
- Number of custom rules and their actions (block, challenge, log, bypass).
- Any rules in "log only" mode that should be set to block.
- WAF coverage gaps: zones with no managed ruleset configured.

**IP Access Rules Audit:**
- Total IP access rules count.
- Rules older than 30 days — flag as potentially stale.
- Temporary blocks that may be overdue for review.
- Overly broad rules (e.g., /8 CIDR blocks or full country blocks).

### Phase 3 — Format Audit Report

Produce a structured report:

---

**Security Audit Report — [Zone Name] — [Timestamp]**

**Overall Severity: 🟢/🟡/🔴**

**Attack Status:**
- Security level: [current level]
- Under Attack Mode: ON/OFF
- Active DDoS mitigations: [count]

**Security Events (Last 24h):**
- Total events: [count]
- Blocked: [count] | Challenged: [count] | Logged: [count]
- Top source IP: [IP] ([count] events)
- Top source country: [country] ([count] events)

**DDoS Analytics (Last 24h):**
- Attack windows: [count]
- Peak rate: [req/s]
- Attack types: [types]

**WAF Coverage:**
- Managed rulesets: [count] enabled
- Custom rules: [count] ([count] blocking, [count] challenging, [count] logging)
- ⚠️ Rules in log-only mode: [count] — consider switching to block

**IP Access Rules:**
- Total rules: [count]
- Rules >30 days old: [count] — review for staleness
- Broad CIDR blocks: [count] — review scope

**Findings:**
1. [Finding 1]
2. [Finding 2]
...

**Recommendations:**
1. [Recommendation 1]
2. [Recommendation 2]
...

---

### Phase 4 — Severity Assessment

**🟢 HEALTHY** — All of the following are true:
- No active attacks or Under Attack Mode is OFF with no recent events
- WAF has at least one managed ruleset configured per zone
- Zero security events in the last 24 hours, OR events are low-volume and all blocked
- No IP access rules older than 30 days flagged as stale
- Security level is "medium" or higher

**🟡 WARNING** — Any of the following:
- Recent DDoS activity in the last 24 hours (mitigated)
- Under Attack Mode was triggered recently (now off)
- WAF rules in "log only" mode with significant event volume (should be blocking)
- IP access rules older than 30 days that may be stale
- Security level is "low" or "essentially_off"
- Unusually high security event volume (>1000 events/24h for a typical zone)

**🔴 CRITICAL** — Any of the following:
- Active attack in progress (Under Attack Mode active with ongoing events)
- WAF completely disabled (no rulesets configured, security level "off")
- Sustained high-volume security events with no blocking in effect
- IP access rules containing contradictory or broken entries

---

## Rules

- This skill is read-only — it audits but does not modify any configuration.
- If an active attack is detected (CRITICAL), immediately recommend activating the `cloudflare-incident-response` skill.
- Flag "log only" WAF rules clearly — they observe but do not block threats.
- Always include timestamps on all event data to make findings actionable.
- Stale IP access rules (>30 days) should be reviewed, not automatically deleted.
- Scheduled security audit agents must not make changes — report and route via Slack severity routing.

---

## Key Tools

- `cloudflare_under_attack_status` — current security level and Under Attack Mode
- `cloudflare_security_events` — security event log (last 24h)
- `cloudflare_ddos_analytics` — DDoS analytics data (last 24h)
- `cloudflare_waf_list_rulesets` — list all WAF rulesets per zone
- `cloudflare_waf_list_custom_rules` — list custom WAF rules with expressions
- `cloudflare_ip_access_list` — list IP access rules (blocks, challenges, allows)
