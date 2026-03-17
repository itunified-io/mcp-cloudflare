// Cloudflare API v4 response and entity types

export interface CloudflareConfig {
  apiToken: string;
  accountId?: string;
  timeout?: number;
}

export interface CloudflareError {
  code: number;
  message: string;
}

export interface ResultInfo {
  page: number;
  per_page: number;
  total_count: number;
  count: number;
}

export interface CloudflareResponse<T> {
  success: boolean;
  errors: CloudflareError[];
  messages: string[];
  result: T;
  result_info?: ResultInfo;
}

// Zone types

export interface Zone {
  id: string;
  name: string;
  status: string;
  paused: boolean;
  type: string;
  development_mode: number;
  name_servers: string[];
  original_name_servers: string[];
  account: {
    id: string;
    name: string;
  };
  plan: {
    id: string;
    name: string;
    price: number;
  };
  created_on: string;
  modified_on: string;
  activated_on: string;
}

export interface ZoneSetting {
  id: string;
  value: string | number | boolean | Record<string, unknown>;
  editable: boolean;
  modified_on: string;
}

// DNS types

export interface DnsRecord {
  id: string;
  zone_id: string;
  zone_name: string;
  name: string;
  type: string;
  content: string;
  proxiable: boolean;
  proxied: boolean;
  ttl: number;
  priority?: number;
  locked: boolean;
  meta: Record<string, unknown>;
  created_on: string;
  modified_on: string;
}

// Tunnel types

export interface TunnelConnection {
  id: string;
  client_id: string;
  client_version: string;
  opened_at: string;
  is_pending_reconnect: boolean;
  origin_ip: string;
  uuid: string;
}

export interface Tunnel {
  id: string;
  name: string;
  created_at: string;
  deleted_at: string | null;
  connections: TunnelConnection[];
  conns_active_at: string | null;
  conns_inactive_at: string | null;
  status: string;
  remote_config: boolean;
}

export interface TunnelIngressRule {
  hostname?: string;
  path?: string;
  service: string;
  origin_request?: Record<string, unknown>;
}

export interface TunnelConfig {
  config: {
    ingress: TunnelIngressRule[];
  };
  source: string;
  created_at: string;
}

// WAF types

export interface WafRuleset {
  id: string;
  name: string;
  description: string;
  kind: string;
  version: string;
  last_updated: string;
  phase: string;
}

export interface WafRule {
  id: string;
  version: string;
  action: string;
  description: string;
  last_updated: string;
  ref: string;
  enabled: boolean;
}

export interface CustomRuleAction {
  response?: {
    status_code: number;
    content_type: string;
    content: string;
  };
}

export interface CustomRule {
  id: string;
  version: string;
  action: string;
  action_parameters?: CustomRuleAction;
  expression: string;
  description: string;
  last_updated: string;
  ref: string;
  enabled: boolean;
}

// Zero Trust types

export interface AccessApp {
  id: string;
  name: string;
  domain: string;
  type: string;
  session_duration: string;
  auto_redirect_to_identity: boolean;
  enable_binding_cookie: boolean;
  http_only_cookie_attribute: boolean;
  same_site_cookie_attribute: string;
  logo_url: string;
  skip_interstitial: boolean;
  app_launcher_visible: boolean;
  custom_deny_url: string;
  custom_deny_message: string;
  allowed_idps: string[];
  created_at: string;
  updated_at: string;
}

export interface AccessPolicyRequire {
  [key: string]: unknown;
}

export interface AccessPolicy {
  id: string;
  precedence: number;
  name: string;
  decision: string;
  include: AccessPolicyRequire[];
  exclude: AccessPolicyRequire[];
  require: AccessPolicyRequire[];
  created_at: string;
  updated_at: string;
}

export interface IdentityProvider {
  id: string;
  name: string;
  type: string;
  config: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface GatewayStatus {
  id: string;
  name: string;
  status: string;
  gateway_tag: string;
  created_at: string;
  updated_at: string;
}

// Security types

export interface SecurityEvent {
  ray_id: string;
  timestamp: string;
  rule_id: string;
  filter: string;
  action: string;
  source: string;
  matches: Record<string, unknown>[];
  origin_response_code: number;
  response_code: number;
  host: string;
  method: string;
  proto: string;
  uri: string;
  ua: string;
  client_ip: string;
  country: string;
}

export interface DdosAnalytics {
  totals: Record<string, number>;
  timeseries: Array<{
    timestamp: string;
    value: number;
  }>;
}

export interface IpAccessRule {
  id: string;
  notes: string;
  allowed_modes: string[];
  mode: string;
  configuration: {
    target: string;
    value: string;
  };
  scope: {
    id: string;
    name: string;
    type: string;
  };
  created_on: string;
  modified_on: string;
}

// Security Center types

export interface SecurityInsight {
  id: string;
  dismissed: boolean;
  issue_class: string;
  issue_type: string;
  payload: Record<string, unknown>;
  resolve_link: string;
  resolve_text: string;
  severity: "low" | "moderate" | "critical";
  since: string;
  subject: string;
  timestamp: string;
}

export interface SecurityInsightSeverityCount {
  count: number;
  value: string;
}

// SSL/TLS Certificate types

export interface CertificatePack {
  id: string;
  type: string;
  hosts: string[];
  status: string;
  validation_method: string;
  validity_days: number;
  certificate_authority: string;
  certificates: Array<{
    id?: string;
    hosts: string[];
    issuer: string;
    signature: string;
    status: string;
    bundle_method: string;
    expires_on: string;
    uploaded_on?: string;
  }>;
  primary_certificate: string;
  created_on: string;
}

export interface SslVerification {
  certificate_status: string;
  verification_type: string;
  verification_status: boolean;
  verification_info?: Record<string, unknown>;
  brand_check: boolean;
  cert_pack_uuid: string;
  hostname: string;
}

// Workers KV types

export interface KvNamespace {
  id: string;
  title: string;
  supports_url_encoding: boolean;
}

export interface KvKey {
  name: string;
  expiration?: number;
  metadata?: Record<string, unknown>;
}

// Workers Script types

export interface WorkerScript {
  id: string;
  etag: string;
  handlers: string[];
  named_handlers?: Array<{ name: string; entrypoint: string }>;
  modified_on: string;
  created_on: string;
  usage_model: string;
  compatibility_date?: string;
  compatibility_flags?: string[];
}

export interface WorkerRoute {
  id: string;
  pattern: string;
  script: string;
}

// Worker Secret types

export interface WorkerSecret {
  name: string;
  type: string;
}

// Worker Analytics types

export interface WorkerAnalyticsRow {
  dimensions: {
    scriptName: string;
    datetime?: string;
  };
  sum: {
    requests: number;
    errors: number;
    subrequests: number;
  };
  quantiles: {
    cpuTimeP50: number;
    cpuTimeP99: number;
  };
}
