---
name: cloudflare-kv-manage
description: Manage Cloudflare Workers KV namespaces and key-value pairs — create, list, read, write, delete
---

# Cloudflare KV Management

Manage Workers KV namespaces and key-value pairs using Cloudflare API.

## Prerequisites

- `CLOUDFLARE_API_TOKEN` with Workers KV permissions
- `CLOUDFLARE_ACCOUNT_ID` set (required for all KV operations)

## Workflows

### List namespaces
1. Call `cloudflare_kv_namespace_list` to see all KV namespaces

### Create a namespace
1. Call `cloudflare_kv_namespace_create` with a descriptive title
2. Note the returned namespace ID for subsequent operations

### List keys in a namespace
1. Call `cloudflare_kv_list_keys` with `namespace_id`
2. Use `prefix` to filter keys by prefix
3. Use `cursor` for pagination through large key sets

### Read a value
1. Call `cloudflare_kv_read` with `namespace_id` and `key_name`
2. Returns the raw string value stored at the key

### Write a value
1. Call `cloudflare_kv_write` with `namespace_id`, `key_name`, and `value`
2. Optionally set `expiration_ttl` (minimum 60 seconds) for auto-expiring keys

### Delete a key
1. Call `cloudflare_kv_delete` with `namespace_id` and `key_name`
2. Confirm before deleting — operation is not reversible

### Delete a namespace (DESTRUCTIVE)
1. **WARNING:** This deletes the namespace and ALL keys within it
2. List keys first to confirm the namespace contents
3. Call `cloudflare_kv_namespace_delete` with `namespace_id`
4. Always ask for user confirmation before executing

## Tools Used

- `cloudflare_kv_namespace_list` — List all KV namespaces
- `cloudflare_kv_namespace_create` — Create a new namespace
- `cloudflare_kv_namespace_delete` — Delete a namespace (destructive)
- `cloudflare_kv_list_keys` — List keys with optional prefix filter
- `cloudflare_kv_read` — Read value by key
- `cloudflare_kv_write` — Write key-value pair with optional TTL
- `cloudflare_kv_delete` — Delete a key

## Rules

- Always list namespaces first if the user hasn't specified one
- Confirm before any delete operation (key or namespace)
- Namespace deletion is destructive — list keys first to show what will be lost
- KV keys are limited to 512 characters
- Values are stored as strings — for structured data, consider JSON encoding
