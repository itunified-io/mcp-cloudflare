---
name: cloudflare-waf-management
description: Manage Cloudflare WAF — custom rules, managed rulesets, IP access rules, DDoS response
---

# Cloudflare WAF Management

Workflow skill for managing Cloudflare Web Application Firewall (WAF). Covers listing and viewing rulesets, creating and deleting custom rules, managing IP access rules, and emergency DDoS response including Under Attack Mode.

---

## Multi-Zone Handling

WAF rules are zone-scoped. Always confirm the target zone before making changes. If the user has not specified a zone, call `cloudflare_zone_list` and ask them to select.

---

## Workflow 1: List All WAF Rulesets

1. Call `cloudflare_waf_list_rulesets` for the selected zone.
2. Display all rulesets in a table:

   | Ruleset Name | ID | Phase | Kind | Rules |
   |-------------|-----|-------|------|-------|
   | Cloudflare Managed Ruleset | abc | http_request_firewall_managed | managed | 300+ |
   | Custom Firewall Rules | def | http_request_firewall_custom | custom | 5 |

3. Distinguish between **managed rulesets** (Cloudflare-maintained) and **custom rulesets** (user-defined).
4. Show the current status of each ruleset (enabled/disabled).

---

## Workflow 2: View Ruleset Details

1. Call `cloudflare_waf_get_ruleset` with the ruleset ID.
2. Display:
   - Ruleset metadata (name, description, phase, kind)
   - For managed rulesets: number of rules and override summary
   - For custom rulesets: list all rules with expression, action, priority, and enabled status
3. Format custom rules as a table:

   | Priority | Name | Expression | Action | Enabled |
   |----------|------|-----------|--------|---------|
   | 1 | Block Scrapers | (http.user_agent contains "bot") | block | yes |
   | 2 | Challenge API | (ip.src ne 1.2.3.4 and http.request.uri.path starts_with "/api") | challenge | yes |

---

## Workflow 3: Create a Custom WAF Rule

1. Gather required parameters from the user:
   - **Name**: descriptive name for the rule
   - **Expression**: Cloudflare Ruleset Language expression (e.g., `(ip.src eq 1.2.3.4)`)
   - **Action**: block, challenge, js_challenge, managed_challenge, log, bypass, allow
   - **Priority**: order among other custom rules (lower = higher priority)
   - **Enabled**: true/false
2. Show a **preview** of the rule expression and action to the user before creating.
3. Warn if the expression would match a large portion of traffic (e.g., broad country blocks, wildcard expressions).
4. Call `cloudflare_waf_create_custom_rule` with all parameters.
5. Verify: call `cloudflare_waf_list_custom_rules` and confirm the new rule appears.
6. Report the created rule details including assigned rule ID.

---

## Workflow 4: Delete a Custom WAF Rule

1. List current custom rules: call `cloudflare_waf_list_custom_rules`.
2. Identify the target rule (by name or ID). Show its details.
3. **Require explicit user confirmation** before deleting — removing a blocking rule may expose the zone to attacks.
4. Execute deletion: call `cloudflare_waf_delete_custom_rule` with the rule ID.
5. Verify: call `cloudflare_waf_list_custom_rules` again to confirm the rule is removed.

---

## Workflow 5: Manage IP Access Rules

**List IP access rules:**
1. Call `cloudflare_ip_access_list` for the zone.
2. Display as a table:

   | IP/CIDR/Country | Mode | Notes | Age |
   |----------------|------|-------|-----|
   | 1.2.3.4 | block | Attack traffic | 3 days |
   | 10.0.0.0/8 | allow | Internal monitoring | 90 days |
   | CN | challenge | Country challenge | 14 days |

3. Flag rules older than 30 days as potentially stale.

**Create an IP access rule:**
1. Gather parameters:
   - **Target**: IP address, CIDR range, ASN (AS12345), or country code (2-letter ISO)
   - **Mode**: block, challenge, js_challenge, managed_challenge, allow, whitelist
   - **Notes**: optional description for why this rule was created
2. Show a preview of the rule and confirm with the user.
3. Call `cloudflare_ip_access_create` with the parameters.
4. Verify creation by listing rules again.

**Delete an IP access rule:**
1. Identify the rule by IP/CIDR/country from the list.
2. Show rule details and confirm with user.
3. Call `cloudflare_ip_access_delete` with the rule ID.
4. Verify deletion.

---

## Workflow 6: DDoS Emergency Response — Toggle Under Attack Mode

1. **Check current status** first: call `cloudflare_security_level_get` for the zone.
   - Show current security level: off, essentially_off, low, medium, high, under_attack
2. Show the implications to the user:
   - **Enabling Under Attack Mode** (`under_attack`): All visitors receive a JS challenge. Legitimate users with JS-capable browsers pass automatically. This stops most L7 DDoS attacks but may impact API clients and bots.
   - **Disabling Under Attack Mode**: Returns to previous security level. Do this only when the attack has subsided.
3. **Require explicit user confirmation** before toggling Under Attack Mode.
4. Execute: call `cloudflare_security_level_set` with the desired level.
5. Verify: call `cloudflare_security_level_get` to confirm the change.
6. Report the new security level and note the time of change.
7. Remind the user to disable Under Attack Mode when the attack is over (recommend checking after 15-30 minutes).

---

## Rules

- Always show the **current security level** before making any changes to it.
- Under Attack Mode toggle requires explicit user confirmation — it affects all visitors.
- Expression preview must be shown before creating any new WAF rule.
- Warn the user when deleting a blocking rule — this may expose the zone to threats.
- Destructive actions (delete custom rule, delete IP access rule) require user confirmation.
- Log-only WAF rules observe but do not block — flag these when reviewing for security posture.
- IP access rules with broad CIDR ranges or full country blocks should be reviewed for business impact before creation.
- Always verify after create/update/delete operations.

---

## Key Tools

- `cloudflare_waf_list_rulesets` — list all WAF rulesets for a zone
- `cloudflare_waf_get_ruleset` — get full details of a specific ruleset
- `cloudflare_waf_list_custom_rules` — list custom WAF rules
- `cloudflare_waf_create_custom_rule` — create a new custom WAF rule
- `cloudflare_waf_delete_custom_rule` — delete a custom WAF rule
- `cloudflare_ip_access_list` — list IP access rules
- `cloudflare_ip_access_create` — create an IP access rule (block/challenge/allow)
- `cloudflare_ip_access_delete` — delete an IP access rule
- `cloudflare_security_level_get` — get current WAF security level
- `cloudflare_security_level_set` — set WAF security level (including Under Attack Mode)
