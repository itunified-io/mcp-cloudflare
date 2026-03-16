import { z } from "zod";

/** 32-character hex string used as Cloudflare zone or record IDs */
export const ZoneIdSchema = z
  .string()
  .regex(/^[0-9a-f]{32}$/i, "Invalid Cloudflare zone ID (expected 32-character hex string)");

/** 32-character hex string used as Cloudflare DNS record IDs */
export const RecordIdSchema = z
  .string()
  .regex(/^[0-9a-f]{32}$/i, "Invalid Cloudflare record ID (expected 32-character hex string)");

/** UUID format used for Cloudflare Tunnel IDs */
export const TunnelIdSchema = z
  .string()
  .uuid("Invalid Cloudflare tunnel ID (expected UUID format)");

/** Supported DNS record types */
export const DnsRecordTypeSchema = z.enum([
  "A",
  "AAAA",
  "CNAME",
  "MX",
  "TXT",
  "SRV",
  "CAA",
  "NS",
]);

/** IPv4 address */
export const IpAddressSchema = z
  .string()
  .regex(
    /^(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)$/,
    "Invalid IPv4 address",
  );

/** Basic IPv6 address validation */
export const Ipv6AddressSchema = z
  .string()
  .regex(
    /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$|^(?:[0-9a-fA-F]{1,4}:){1,7}:$|^::(?:[0-9a-fA-F]{1,4}:){0,6}[0-9a-fA-F]{1,4}$|^(?:[0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}$|^(?:[0-9a-fA-F]{1,4}:){1,5}(?::[0-9a-fA-F]{1,4}){1,2}$|^(?:[0-9a-fA-F]{1,4}:){1,4}(?::[0-9a-fA-F]{1,4}){1,3}$|^(?:[0-9a-fA-F]{1,4}:){1,3}(?::[0-9a-fA-F]{1,4}){1,4}$|^(?:[0-9a-fA-F]{1,4}:){1,2}(?::[0-9a-fA-F]{1,4}){1,5}$|^[0-9a-fA-F]{1,4}:(?::[0-9a-fA-F]{1,4}){1,6}$|^::(?:[fF]{4}(?::0{1,4})?:)?(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)$|^(?:[0-9a-fA-F]{1,4}:){1,4}:(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)$/,
    "Invalid IPv6 address",
  );

/** Domain name (must include a TLD) */
export const DomainSchema = z
  .string()
  .regex(
    /^(?!-)[a-zA-Z0-9-]{1,63}(?<!-)(?:\.(?!-)[a-zA-Z0-9-]{1,63}(?<!-))*\.[a-zA-Z]{2,}$/,
    "Invalid domain name",
  );

/** DNS TTL — 1 means auto (Cloudflare-managed), otherwise 60–86400 seconds */
export const TtlSchema = z
  .number()
  .int()
  .refine(
    (v) => v === 1 || (v >= 60 && v <= 86400),
    "TTL must be 1 (auto) or between 60 and 86400 seconds",
  );

/**
 * Boolean schema that accepts both native booleans and string representations.
 * MCP protocol may send boolean parameters as strings ("true"/"false").
 */
export const CoercedBooleanSchema = z.preprocess((v) => {
  if (typeof v === "string") return v === "true";
  return v;
}, z.boolean());

/** Whether a DNS record is proxied through Cloudflare */
export const ProxiedSchema = CoercedBooleanSchema;

/** 32-character hex string used as Cloudflare account IDs */
export const AccountIdSchema = z
  .string()
  .regex(/^[0-9a-f]{32}$/i, "Invalid Cloudflare account ID (expected 32-character hex string)");

/** Cloudflare security level settings */
export const SecurityLevelSchema = z.enum([
  "off",
  "essentially_off",
  "low",
  "medium",
  "high",
  "under_attack",
]);

/** Target types for IP access rules */
export const IpAccessRuleTargetSchema = z.enum(["ip", "ip_range", "asn", "country"]);

/** Zone name or ID — accepts either a 32-char hex ID or a domain name */
export const ZoneNameOrIdSchema = z
  .string()
  .min(1, "Zone name or ID is required");

/** 32-character hex string used as Workers KV namespace IDs */
export const NamespaceIdSchema = z
  .string()
  .regex(/^[0-9a-f]{32}$/i, "Invalid KV namespace ID (expected 32-character hex string)");

/** Worker script name — lowercase alphanumeric with hyphens */
export const ScriptNameSchema = z
  .string()
  .min(1, "Script name is required")
  .regex(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/, "Invalid script name (lowercase alphanumeric and hyphens only)");

/** Worker secret name */
export const SecretNameSchema = z
  .string()
  .min(1, "Secret name is required");

/** KV key name — max 512 bytes */
export const KvKeySchema = z
  .string()
  .min(1, "KV key is required")
  .max(512, "KV key must be 512 characters or less");

/** R2 bucket name — 3-63 chars, lowercase alphanumeric and hyphens */
export const R2BucketNameSchema = z
  .string()
  .min(3, "Bucket name must be at least 3 characters")
  .max(63, "Bucket name must be 63 characters or less")
  .regex(
    /^[a-z0-9][a-z0-9-]*[a-z0-9]$/,
    "Bucket name must be lowercase alphanumeric with hyphens, cannot start or end with hyphen",
  );

/** R2 object key — the path/name of an object in a bucket */
export const R2ObjectKeySchema = z
  .string()
  .min(1, "Object key is required")
  .max(1024, "Object key must be 1024 characters or less");

/** R2 location hint for bucket creation */
export const R2LocationHintSchema = z.enum([
  "apac",
  "eeur",
  "enam",
  "weur",
  "wnam",
]);
