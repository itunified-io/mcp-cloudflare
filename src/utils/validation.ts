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

/** Whether a DNS record is proxied through Cloudflare */
export const ProxiedSchema = z.boolean();

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
