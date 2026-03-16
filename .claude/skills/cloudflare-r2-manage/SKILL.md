---
name: cloudflare-r2-manage
description: Manage Cloudflare R2 storage buckets and objects — create, list, inspect, delete buckets and objects
---

# Cloudflare R2 Storage Management

Manage R2 object storage buckets and objects using Cloudflare API.

## Prerequisites

- `CLOUDFLARE_API_TOKEN` with R2 Storage permissions (read + write)
- `CLOUDFLARE_ACCOUNT_ID` set (required for all R2 operations)

## Workflows

### List all buckets
1. Call `cloudflare_r2_bucket_list` to see all R2 buckets in the account
2. Use `name_contains` to filter by name substring

### Create a bucket
1. Call `cloudflare_r2_bucket_create` with a name (3-63 chars, lowercase alphanumeric + hyphens)
2. Optionally specify `location_hint` for geographic placement:
   - `weur` — Western Europe
   - `eeur` — Eastern Europe
   - `enam` — Eastern North America
   - `wnam` — Western North America
   - `apac` — Asia Pacific
3. Follow naming convention: `assets-<zone-slug>` (prod) or `assets-uat-<zone-slug>` (UAT)

### Get bucket details
1. Call `cloudflare_r2_bucket_get` with `bucket_name`
2. Returns creation date, location, and configuration

### List objects in a bucket
1. Call `cloudflare_r2_object_list` with `bucket_name`
2. Use `prefix` to filter by path (e.g., `brand/` for brand assets)
3. Use `delimiter` with `/` for directory-like listing
4. Use `cursor` for pagination through large object sets

### Get object metadata
1. Call `cloudflare_r2_object_get` with `bucket_name` and `object_key`
2. Returns size, etag, content type, last modified — does NOT return object body

### Delete an object
1. Call `cloudflare_r2_object_delete` with `bucket_name` and `object_key`
2. Confirm before deleting — operation is not reversible

### Delete a bucket (DESTRUCTIVE)
1. **WARNING:** Bucket must be empty before deletion
2. List objects first to verify the bucket is empty
3. Call `cloudflare_r2_bucket_delete` with `bucket_name`
4. Always ask for user confirmation before executing

### Enable public access via custom domain
1. Call `cloudflare_r2_bucket_domain_add` with `bucket_name` and `domain`
2. The domain must belong to a Cloudflare zone in the same account
3. Cloudflare automatically creates a CNAME DNS record for the domain
4. Bucket becomes publicly readable at `https://<domain>/`
5. Writes still require API authentication — public = read-only

### List custom domains on a bucket
1. Call `cloudflare_r2_bucket_domain_list` with `bucket_name`
2. Returns domain names, status (active/pending), and zone info

### Remove a custom domain
1. Call `cloudflare_r2_bucket_domain_remove` with `bucket_name` and `domain`
2. This disables public access via that domain
3. Confirm before removing — may break live websites referencing the domain

### R2 Bucket Audit
1. Call `cloudflare_r2_bucket_list` to get all buckets
2. For each bucket, call `cloudflare_r2_bucket_get` for details
3. For each bucket, call `cloudflare_r2_object_list` with `delimiter: "/"` for top-level overview
4. Report: bucket count, per-bucket object summary, naming convention compliance

## Tools Used

- `cloudflare_r2_bucket_list` — List all R2 buckets with optional name filter
- `cloudflare_r2_bucket_create` — Create a new bucket with optional location hint
- `cloudflare_r2_bucket_get` — Get bucket details (creation date, location)
- `cloudflare_r2_bucket_delete` — Delete an empty bucket (destructive)
- `cloudflare_r2_object_list` — List objects with prefix/delimiter filtering
- `cloudflare_r2_object_get` — Get object metadata (size, type, etag)
- `cloudflare_r2_object_delete` — Delete an object from a bucket
- `cloudflare_r2_bucket_domain_list` — List custom domains attached to a bucket
- `cloudflare_r2_bucket_domain_add` — Attach a custom domain (enables public read access)
- `cloudflare_r2_bucket_domain_remove` — Remove a custom domain from a bucket

## Naming Convention (ADR-0035)

| Type | Pattern | Example |
|------|---------|---------|
| Public prod assets | `assets-<zone-slug>` | `assets-itunified-de` |
| Public UAT assets | `assets-uat-<zone-slug>` | `assets-uat-itunified-de` |
| Private internal | `internal-<purpose>` | `internal-backups` |

## Rules

- Always list buckets first if the user hasn't specified one
- Confirm before any delete operation (object or bucket)
- Bucket deletion requires the bucket to be empty first — list objects to verify
- Bucket names: 3-63 chars, lowercase alphanumeric and hyphens, no leading/trailing hyphens
- Object keys are limited to 1024 characters
- For binary file uploads (images, etc.), use `wrangler r2 object put` or the Cloudflare dashboard
- Follow ADR-0035 naming conventions for zone asset buckets
