---
name: cloudflare-zero-trust
description: Manage Cloudflare Zero Trust — access applications, policies, identity providers, gateway
---

# Cloudflare Zero Trust Management

Workflow skill for managing Cloudflare Zero Trust (formerly Cloudflare Access and Teams). Covers listing and managing access applications, access policies, identity providers (IdPs), and Gateway status.

---

## Prerequisites

Zero Trust resources are account-scoped, not zone-scoped. All operations apply to the Cloudflare account configured in the MCP server credentials.

---

## Workflow 1: List Access Applications

1. Call `cloudflare_zt_list_apps` to retrieve all configured access applications.
2. Format output as a table:

   | Name | Domain | Type | Session Duration | Status |
   |------|--------|------|-----------------|--------|
   | Internal Dashboard | dashboard.example.com | self_hosted | 24h | enabled |
   | SSH Bastion | ssh.example.com | ssh | 8h | enabled |
   | Admin Portal | admin.example.com | self_hosted | 4h | enabled |

3. Group applications by type if multiple types are present (self_hosted, ssh, vnc, saas, bookmark).
4. Note total count and highlight any disabled applications.

---

## Workflow 2: Get Application Details

1. Identify the target application from the list or ask the user to specify.
2. Call `cloudflare_zt_get_app` with the application ID.
3. Display full application details:
   - **Name and domain**: application name, hostname
   - **Type**: self_hosted, ssh, vnc, saas, bookmark
   - **Session duration**: how long authentication tokens are valid
   - **Allowed IdPs**: which identity providers are permitted for this application
   - **Auto-redirect**: whether to skip app launcher
   - **Cors headers**: if any CORS configuration is set
   - **Custom deny page**: custom message shown to blocked users
4. Call `cloudflare_zt_list_policies` for the application to show attached policies.
5. Display policies in a table:

   | Policy Name | Action | Order | Rules |
   |-------------|--------|-------|-------|
   | Allow Team | allow | 1 | email ends with @example.com |
   | Block External | block | 2 | not (ip.src in {10.0.0.0/8}) |

---

## Workflow 3: Manage Access Policies

**List all policies for an application:**
1. Call `cloudflare_zt_list_policies` for the application ID.
2. Display policies with their include/require/exclude rule definitions.
3. Explain rule logic:
   - **Include**: traffic matching these rules passes to the allow/block decision
   - **Require**: additional conditions that must also be met
   - **Exclude**: traffic matching these rules bypasses the policy

**Create a new policy:**
1. Gather parameters from the user:
   - **Policy name**: descriptive name
   - **Action**: allow or block
   - **Decision**: define include rules (e.g., email domain, group membership, IP range, country)
   - **Require rules** (optional): additional conditions
   - **Exclude rules** (optional): bypass conditions
   - **Precedence/Order**: position among other policies (lower = evaluated first)
2. Show a preview of the policy logic to the user in human-readable form:
   - "Allow users where: email ends with @example.com AND IP is in 10.0.0.0/8"
3. Confirm with the user before creating.
4. Call `cloudflare_zt_create_policy` with all parameters.
5. Verify: call `cloudflare_zt_list_policies` to confirm the policy was created.
6. Report the policy ID and order.

---

## Workflow 4: Identity Provider Status

1. Call `cloudflare_zt_list_idps` to retrieve all configured identity providers.
2. Display as a table:

   | Name | Type | ID | Status |
   |------|------|----|--------|
   | Google Workspace | google | idp-abc | active |
   | GitHub | github | idp-def | active |
   | One-time PIN | onetimepin | idp-ghi | active |

3. For each IdP, note:
   - Provider type (Okta, Azure AD, Google, GitHub, SAML, etc.)
   - Whether it is configured and active
4. If no IdPs are configured, warn the user: Zero Trust access policies cannot authenticate users without an IdP (or One-time PIN as fallback).

---

## Workflow 5: Gateway Status

1. Call `cloudflare_zt_gateway_status` to retrieve Cloudflare Gateway (DNS filtering) status.
2. Display:
   - Gateway enabled: yes/no
   - DNS filtering: enabled/disabled
   - HTTP inspection: enabled/disabled
   - Policy count: number of Gateway policies configured
   - Blocked categories (if DNS filtering is active): malware, phishing, adult content, etc.
3. If Gateway is disabled, note that it provides network-level DNS filtering and L7 inspection.
4. Note: Gateway policy management (creating/editing DNS or HTTP policies) is a separate administrative workflow not covered here — refer the user to the Cloudflare dashboard for complex Gateway policy changes.

---

## Rules

- Zero Trust changes can affect user access to applications — always confirm before modifying policies.
- Policy order matters: policies are evaluated in precedence order, and the first matching policy wins.
- Warn the user if deleting or modifying a policy could lock out all users (e.g., the only "allow" policy).
- Always display existing policies before creating new ones so the user understands the current access model.
- Identity providers must be configured and active for email/group-based policies to function.
- Session duration affects security: shorter durations require more frequent re-authentication.
- This skill is read-focused for Gateway — use Cloudflare dashboard for complex Gateway policy authoring.

---

## Key Tools

- `cloudflare_zt_list_apps` — list all Zero Trust access applications
- `cloudflare_zt_get_app` — get full details of a specific application
- `cloudflare_zt_list_policies` — list access policies for an application
- `cloudflare_zt_create_policy` — create a new access policy
- `cloudflare_zt_list_idps` — list configured identity providers
- `cloudflare_zt_gateway_status` — get Cloudflare Gateway status and DNS filtering info
