---
name: cloudflare-dns-management
description: Manage Cloudflare DNS records — add, list, update, delete records with verification across multiple zones
---

# Cloudflare DNS Management

Workflow skill for managing DNS records across Cloudflare zones. Covers creating, listing, updating, deleting, importing, exporting records, and checking DNSSEC status.

## Multi-Zone Handling

Always determine the target zone before any operation. If the user has not specified a zone:
1. Call `cloudflare_zone_list` to retrieve all zones.
2. Present the zone list to the user and ask which zone to use.
3. Proceed only after zone selection is confirmed.

---

## Workflow 1: Add a DNS Record

1. Gather required parameters from the user:
   - **name**: hostname or subdomain (e.g., `api.example.com`)
   - **type**: A, AAAA, CNAME, MX, TXT, SRV, etc.
   - **value/content**: IP address, target hostname, or text value
   - **proxied**: true (☁️ proxied) or false (DNS-only) — default false for non-HTTP records
   - **TTL**: seconds, or 1 for auto (only applies when not proxied)
2. Check for conflicts: call `cloudflare_dns_search` with the record name and type.
   - If a conflicting record exists, show it to the user and ask whether to proceed or update instead.
3. Create the record: call `cloudflare_dns_create` with all gathered parameters.
4. Verify: call `cloudflare_dns_get` with the returned record ID.
5. Report success: display the created record details including ID, name, type, value, proxied status, and TTL.

---

## Workflow 2: List / Search Records

1. Call `cloudflare_dns_list` for the selected zone. Apply optional filters:
   - `name` — filter by hostname pattern
   - `type` — filter by record type
   - `content` — filter by record value
2. Format output as a table:

   | Name | Type | Value | Proxied | TTL |
   |------|------|-------|---------|-----|
   | api.example.com | A | 1.2.3.4 | ☁️ | auto |
   | mail.example.com | MX | mail.example.com | DNS-only | 3600 |

3. Show total record count at the bottom.
4. If no records match, report clearly and suggest broadening the filter.

---

## Workflow 3: Update a Record

1. Find the record: call `cloudflare_dns_search` with the name (and optionally type).
   - If multiple matches, list them and ask the user to confirm which one to update.
2. Show the current values of the record to the user.
3. Ask which fields to change (content, proxied, TTL, name).
4. Confirm the change with the user before proceeding (show "current → new" diff).
5. Execute the update: call `cloudflare_dns_update` with the record ID and changed fields.
6. Verify: call `cloudflare_dns_get` on the updated record ID.
7. Report the updated record details.

---

## Workflow 4: Delete a Record

1. Find the record: call `cloudflare_dns_search` with the name and type.
   - If multiple matches, list them and ask the user to identify the target record.
2. Show full record details (name, type, value, proxied, TTL, ID).
3. **Require explicit user confirmation** before deleting — this action is irreversible.
4. Execute deletion: call `cloudflare_dns_delete` with the record ID.
5. Verify: call `cloudflare_dns_search` again to confirm the record no longer exists.
6. Report deletion confirmed.

---

## Workflow 5: Export DNS Records (BIND Format)

1. Call `cloudflare_dns_export` for the selected zone.
2. The result is a BIND-format zone file string.
3. Display the content to the user or offer to save it.
4. Note: exported data can be used for backup or migration purposes.

---

## Workflow 6: Import DNS Records

1. Ask the user to provide the BIND-format zone file content.
2. **Require explicit user confirmation** before importing — this may create, update, or overwrite existing records.
3. Warn the user: importing will add all records in the file; it does not delete existing records not in the file.
4. Execute import: call `cloudflare_dns_import` with the zone file content.
5. Report how many records were created, updated, or skipped.

---

## Workflow 7: DNSSEC Status

1. Call `cloudflare_dnssec_status` for the selected zone.
2. Report:
   - DNSSEC enabled / disabled
   - DS record details (if enabled)
   - Status (active, pending, etc.)
3. If disabled, note that enabling DNSSEC requires DS record configuration at the domain registrar.

---

## Rules

- Always check for conflicting records before creating a new one — duplicate A/CNAME records can break DNS resolution.
- Always verify after create, update, or delete using a read operation.
- Destructive actions (delete, import) **require explicit user confirmation** before execution.
- Display proxy status clearly: ☁️ for proxied (traffic routed through Cloudflare), "DNS-only" for direct.
- Never proxy non-HTTP record types (MX, TXT, SRV, NS) — flag this to the user if requested.
- If the user does not specify a zone and multiple zones exist, always ask — never guess.
- TTL of 1 means "auto" (Cloudflare-managed) and only applies to unproxied records.

---

## Key Tools

- `cloudflare_zone_list` — list all zones to resolve zone context
- `cloudflare_dns_list` — list all DNS records with filters
- `cloudflare_dns_search` — find records by name/type/content
- `cloudflare_dns_create` — create a new DNS record
- `cloudflare_dns_update` — update an existing DNS record
- `cloudflare_dns_delete` — delete a DNS record
- `cloudflare_dns_get` — get a single record by ID (for verification)
- `cloudflare_dns_export` — export zone as BIND-format file
- `cloudflare_dns_import` — import records from BIND-format file
- `cloudflare_dnssec_status` — check DNSSEC status for a zone
