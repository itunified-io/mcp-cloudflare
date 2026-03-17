---
name: cloudflare-worker-deploy
description: Deploy and manage Cloudflare Workers — upload scripts, configure routes, manage secrets, view analytics
---

# Cloudflare Worker Deployment & Management

Deploy Workers scripts, configure routes, manage secrets, and monitor analytics.

## Prerequisites

- `CLOUDFLARE_API_TOKEN` with Workers permissions
- `CLOUDFLARE_ACCOUNT_ID` set (required for script and secret operations)
- Zone access for route management

## Workflows

### List existing workers
1. Call `cloudflare_worker_list` to see all deployed scripts

### Deploy a worker script
1. Call `cloudflare_worker_deploy` with:
   - `script_name` — unique name for the worker
   - `script_content` — the JavaScript/TypeScript source code
   - `content_type` — `application/javascript+module` (default, ES modules) or `application/javascript` (service worker)
2. Verify deployment by checking the response
3. Configure routes if needed (see below)

### Configure routes for a worker
1. Call `cloudflare_worker_route_list` with `zone_id` to see existing routes
2. Call `cloudflare_worker_route_create` with:
   - `zone_id` — the zone to add the route to
   - `pattern` — URL pattern (e.g., `example.com/*`)
   - `script` — the worker script name to handle matching requests

### Manage worker secrets
1. Call `cloudflare_worker_secret_list` with `script_name` to see current secrets (names only — values are never returned)
2. Call `cloudflare_worker_secret_set` with `script_name`, `secret_name`, and `secret_value` to set a secret
3. Call `cloudflare_worker_secret_delete` to remove a secret
4. **Security:** Secret values are sent securely and never echoed in responses

### Set Slack webhook for contact forms
Workers with contact forms can forward submissions to Slack via incoming webhooks.

**Naming convention:** Local env vars use `SLACK_WH_<ZONE>` (dots replaced with underscores, uppercase). The Worker secret is always `SLACK_WEBHOOK_URL`.

| Zone | Local env var | Worker secret name |
|------|--------------|-------------------|
| `example.com` | `SLACK_WH_EXAMPLE_COM` | `SLACK_WEBHOOK_URL` |
| `example.de` | `SLACK_WH_EXAMPLE_DE` | `SLACK_WEBHOOK_URL` |

**Workflow:**
1. Create a Slack app with incoming webhooks enabled (use manifest from infrastructure repo)
2. Store the webhook URL in your local secrets file
3. Push to Workers via MCP:
   - `cloudflare_worker_secret_set(script_name="<worker>-uat", secret_name="SLACK_WEBHOOK_URL", secret_value="<url>")`
   - `cloudflare_worker_secret_set(script_name="<worker>-production", secret_name="SLACK_WEBHOOK_URL", secret_value="<url>")`
4. Verify with `cloudflare_worker_secret_list(script_name="<worker>-uat")`

### View worker analytics
1. Call `cloudflare_worker_analytics` for time-series metrics:
   - Requests, errors, subrequests per time interval
   - CPU time percentiles (P50, P99)
   - Filter by `script_name` and `since` date
2. Call `cloudflare_worker_usage` for aggregated per-script usage:
   - Total requests, errors, subrequests per script
   - Sorted by request count (highest first)

### Delete a worker (DESTRUCTIVE)
1. **WARNING:** This removes the worker script and stops serving all associated routes
2. Check routes first with `cloudflare_worker_route_list`
3. Call `cloudflare_worker_delete` with `script_name`
4. Always ask for user confirmation before executing

## Tools Used

### Workers Scripts
- `cloudflare_worker_list` — List all worker scripts
- `cloudflare_worker_deploy` — Deploy a worker script (multipart upload)
- `cloudflare_worker_delete` — Delete a worker script (destructive)
- `cloudflare_worker_route_list` — List routes for a zone
- `cloudflare_worker_route_create` — Create a route for a zone

### Worker Secrets
- `cloudflare_worker_secret_list` — List secret names (values never returned)
- `cloudflare_worker_secret_set` — Set a secret (value never echoed)
- `cloudflare_worker_secret_delete` — Delete a secret

### Worker Analytics
- `cloudflare_worker_analytics` — Time-series invocation metrics
- `cloudflare_worker_usage` — Per-script aggregated usage

## Deployment Workflow

### Multi-file project (wrangler.toml)
Recommended sequence for projects with `wrangler.toml`:
1. `cloudflare_worker_deploy_project(project_path, environment)` — Build and deploy
2. Set secrets via MCP: `cloudflare_worker_secret_set(script_name, secret_name, secret_value)`
3. Verify secrets: `cloudflare_worker_secret_list(script_name)`
4. Verify deployment: `cloudflare_worker_analytics` or browser test

### Single-file script (API upload)
Recommended sequence:
1. `cloudflare_worker_deploy` — Upload the script
2. `cloudflare_worker_secret_set` — Set required secrets (API keys, tokens)
3. `cloudflare_worker_route_create` — Configure URL routing
4. `cloudflare_worker_analytics` — Verify requests are being served

## Rules

- Always verify deployment succeeded by checking the response
- Set secrets AFTER deploying (the script must exist first)
- Confirm before destructive operations (delete script, delete secret)
- Secret values are never logged or displayed — only names are shown
- Route patterns use Cloudflare's pattern matching syntax (e.g., `*.example.com/api/*`)
- ES modules format (`application/javascript+module`) is recommended for new workers
