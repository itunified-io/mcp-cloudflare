---
name: cloudflare-tunnel-management
description: Manage Cloudflare Tunnels — create, configure ingress rules, monitor connections
---

# Cloudflare Tunnel Management

Workflow skill for managing Cloudflare Tunnels (formerly Argo Tunnel). Covers listing tunnels, viewing details and ingress configuration, creating new tunnels, updating ingress rules, and deleting tunnels.

---

## Multi-Zone Handling

Tunnels are account-scoped, not zone-scoped. However, ingress rules in tunnel configuration often reference zone hostnames. If the user needs to associate ingress rules with a specific zone, use `cloudflare_zone_list` to confirm the zone name.

---

## Workflow 1: List All Tunnels

1. Call `cloudflare_tunnel_list` to retrieve all tunnels.
2. Format output as a table:

   | Name | Tunnel ID | Status | Active Connections |
   |------|-----------|--------|-------------------|
   | home-tunnel | abc-123 | healthy | 2 |
   | prod-tunnel | def-456 | degraded | 0 |

3. Show total tunnel count.
4. Highlight any tunnels that are degraded (connections but errors) or down (no active connections).

---

## Workflow 2: Get Tunnel Details

1. Ask the user which tunnel to inspect if not already specified. Use the tunnel list to help.
2. Call `cloudflare_tunnel_get` with the tunnel ID.
3. Display full details:
   - Tunnel name and ID
   - Creation date
   - Status (healthy / degraded / down)
   - Active connection count and connection details (connector IDs, origin IP, region)
4. Call `cloudflare_tunnel_config_get` to retrieve the ingress configuration.
5. Format ingress rules as a table:

   | Hostname | Service | Path | Notes |
   |----------|---------|------|-------|
   | app.example.com | http://localhost:8080 | / | |
   | *.example.com | http://localhost:3000 | /api | wildcard |
   | (catch-all) | http_status:404 | | default rule |

6. Note: every tunnel config must end with a catch-all rule. Warn if absent.

---

## Workflow 3: Create a New Tunnel

1. Ask the user for:
   - **Tunnel name**: descriptive name (e.g., `homelab-tunnel`, `prod-ingress`)
2. Call `cloudflare_tunnel_create` with the tunnel name.
3. Display the result:
   - Tunnel ID
   - **Tunnel token** — show prominently; this is needed to run the `cloudflared` connector
4. Inform the user of next steps:
   - Install `cloudflared` on the origin server
   - Run: `cloudflared tunnel run --token <tunnel-token>`
   - Configure ingress rules using the update workflow (Workflow 4)
   - Create DNS CNAME record pointing to `<tunnel-id>.cfargotunnel.com`

---

## Workflow 4: Update Tunnel Ingress Configuration

1. Retrieve current config: call `cloudflare_tunnel_config_get` for the tunnel.
2. Display the current ingress rules table (see Workflow 2 format).
3. Ask the user what changes to make:
   - Add a new ingress rule (hostname, service, optional path)
   - Remove an existing ingress rule
   - Reorder rules (order matters — first match wins)
   - Update the catch-all rule
4. Show a preview of the new configuration to the user.
5. **Confirm with the user before applying** — changing ingress rules affects live traffic.
6. Apply: call `cloudflare_tunnel_config_update` with the full updated ingress configuration.
7. Verify: call `cloudflare_tunnel_config_get` again to confirm the changes were saved.
8. Report success with the updated ingress table.

---

## Workflow 5: Delete a Tunnel

1. Retrieve tunnel details: call `cloudflare_tunnel_get` for the target tunnel.
2. **Show active connections** — if the tunnel has active connections, warn the user clearly:
   - "This tunnel currently has [N] active connections. Deleting it will disconnect all active clients."
3. Display full tunnel details (name, ID, ingress rules summary, active connections).
4. **Require explicit user confirmation** before deleting — this is irreversible.
5. If active connections exist, ask for double confirmation: "Are you sure you want to delete a tunnel with active connections?"
6. Execute deletion: call `cloudflare_tunnel_delete` with the tunnel ID.
7. Verify: call `cloudflare_tunnel_list` and confirm the tunnel is no longer present.
8. Remind the user to:
   - Stop the `cloudflared` connector process on the origin server
   - Remove the associated DNS CNAME record if no longer needed

---

## Rules

- Always show active connections before any delete operation — never delete silently.
- Ingress rules are order-dependent: first matching rule wins. Always display them in order.
- Every tunnel config must have a catch-all rule as the last entry. Flag missing catch-all as a configuration error.
- The tunnel token returned at creation is shown once — remind the user to store it securely.
- Changing ingress configuration affects live traffic immediately — always require confirmation.
- Destructive actions (delete) require explicit user confirmation.
- Tunnel status: healthy = all connectors healthy, degraded = partial connections/errors, down = no active connections.

---

## Key Tools

- `cloudflare_tunnel_list` — list all tunnels with status and connection counts
- `cloudflare_tunnel_get` — get full tunnel details including active connections
- `cloudflare_tunnel_create` — create a new tunnel (returns tunnel token)
- `cloudflare_tunnel_delete` — delete a tunnel permanently
- `cloudflare_tunnel_config_get` — get tunnel ingress configuration
- `cloudflare_tunnel_config_update` — update tunnel ingress rules
- `cloudflare_zone_list` — list zones (for associating ingress hostnames with zones)
