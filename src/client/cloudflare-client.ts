import axios, { type AxiosInstance } from "axios";
import type { CloudflareConfig, CloudflareResponse, Zone } from "./types.js";
import { CloudflareApiError, extractError } from "../utils/errors.js";

const CF_BASE_URL = "https://api.cloudflare.com/client/v4";

export class CloudflareClient {
  private readonly http: AxiosInstance;
  private readonly config: CloudflareConfig;

  constructor(config: CloudflareConfig) {
    this.config = config;

    this.http = axios.create({
      baseURL: CF_BASE_URL,
      timeout: config.timeout ?? 30000,
      headers: {
        Authorization: `Bearer ${config.apiToken}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    });
  }

  async get<T>(path: string, params?: Record<string, unknown>): Promise<T> {
    try {
      const response = await this.http.get<CloudflareResponse<T>>(path, { params });
      this.assertSuccess(response.data, `GET ${path}`);
      return response.data.result;
    } catch (error: unknown) {
      throw extractError(error, `GET ${path}`);
    }
  }

  async post<T>(path: string, data?: unknown): Promise<T> {
    try {
      const response = await this.http.post<CloudflareResponse<T>>(path, data ?? {});
      this.assertSuccess(response.data, `POST ${path}`);
      return response.data.result;
    } catch (error: unknown) {
      throw extractError(error, `POST ${path}`);
    }
  }

  async put<T>(path: string, data?: unknown): Promise<T> {
    try {
      const response = await this.http.put<CloudflareResponse<T>>(path, data ?? {});
      this.assertSuccess(response.data, `PUT ${path}`);
      return response.data.result;
    } catch (error: unknown) {
      throw extractError(error, `PUT ${path}`);
    }
  }

  async patch<T>(path: string, data?: unknown): Promise<T> {
    try {
      const response = await this.http.patch<CloudflareResponse<T>>(path, data ?? {});
      this.assertSuccess(response.data, `PATCH ${path}`);
      return response.data.result;
    } catch (error: unknown) {
      throw extractError(error, `PATCH ${path}`);
    }
  }

  async delete<T>(path: string): Promise<T> {
    try {
      const response = await this.http.delete<CloudflareResponse<T>>(path);
      this.assertSuccess(response.data, `DELETE ${path}`);
      return response.data.result;
    } catch (error: unknown) {
      throw extractError(error, `DELETE ${path}`);
    }
  }

  /**
   * GET a raw text response (not JSON). Used for endpoints like DNS export
   * that return BIND zone text rather than a JSON CloudflareResponse envelope.
   */
  async getRaw(path: string, params?: Record<string, unknown>): Promise<string> {
    try {
      const response = await this.http.get<string>(path, {
        params,
        headers: { Accept: "text/plain" },
        transformResponse: (data: string) => data,
      });
      return response.data;
    } catch (error: unknown) {
      throw extractError(error, `GET ${path}`);
    }
  }

  /**
   * GET a response and return both the parsed result and the response headers.
   * Used for endpoints where we need header values (e.g., X-RateLimit-*).
   */
  async getWithHeaders<T>(
    path: string,
    params?: Record<string, unknown>,
  ): Promise<{ result: T; headers: Record<string, string> }> {
    try {
      const response = await this.http.get<CloudflareResponse<T>>(path, { params });
      this.assertSuccess(response.data, `GET ${path}`);
      const headers: Record<string, string> = {};
      for (const [key, value] of Object.entries(response.headers)) {
        if (typeof value === "string") {
          headers[key] = value;
        }
      }
      return { result: response.data.result, headers };
    } catch (error: unknown) {
      throw extractError(error, `GET ${path}`);
    }
  }

  /**
   * POST with multipart/form-data (used for DNS import endpoint).
   */
  async postForm<T>(path: string, formData: FormData): Promise<T> {
    try {
      const response = await this.http.post<CloudflareResponse<T>>(path, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      this.assertSuccess(response.data, `POST ${path}`);
      return response.data.result;
    } catch (error: unknown) {
      throw extractError(error, `POST ${path}`);
    }
  }

  async graphql<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
    try {
      const response = await this.http.post<{ data: T; errors?: Array<{ message: string }> }>(
        "/graphql",
        { query, variables },
      );
      if (response.data.errors && response.data.errors.length > 0) {
        const msg = response.data.errors.map((e) => e.message).join("; ");
        throw new CloudflareApiError(`GraphQL error: ${msg}`, "POST /graphql");
      }
      return response.data.data;
    } catch (error: unknown) {
      throw extractError(error, "POST /graphql");
    }
  }

  /**
   * Resolve a zone name or ID to a zone ID.
   * If `nameOrId` is a 32-character hex string, it is treated as an ID and returned as-is.
   * Otherwise, the zone name is looked up via the Cloudflare API.
   */
  async resolveZoneId(nameOrId: string): Promise<string> {
    if (/^[0-9a-f]{32}$/i.test(nameOrId)) {
      return nameOrId;
    }
    // Look up by zone name
    const results = await this.get<Zone[]>("/zones", { name: nameOrId, per_page: 1 });
    if (!results || results.length === 0) {
      throw new CloudflareApiError(`Zone not found: ${nameOrId}`, "GET /zones");
    }
    return results[0].id;
  }

  private assertSuccess<T>(response: CloudflareResponse<T>, endpoint: string): void {
    if (!response.success) {
      const firstError = response.errors[0];
      const code = firstError?.code ?? 0;
      const msg = firstError?.message ?? "Unknown Cloudflare API error";
      throw new CloudflareApiError(
        `Cloudflare API error [${code}] at ${endpoint}: ${msg}`,
        endpoint,
        undefined,
        code,
        response.errors.length > 1 ? JSON.stringify(response.errors) : undefined,
      );
    }
  }

  static fromEnv(): CloudflareClient {
    const apiToken = process.env["CLOUDFLARE_API_TOKEN"];

    if (!apiToken) {
      throw new Error("CLOUDFLARE_API_TOKEN environment variable is required");
    }

    const accountId = process.env["CLOUDFLARE_ACCOUNT_ID"];
    const rawTimeout = parseInt(process.env["CLOUDFLARE_TIMEOUT"] ?? "30000", 10);
    const timeout = Number.isNaN(rawTimeout) ? 30000 : rawTimeout;

    return new CloudflareClient({ apiToken, accountId, timeout });
  }
}
