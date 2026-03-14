import axios, { type AxiosInstance } from "axios";
import type { CloudflareConfig, CloudflareResponse, Zone } from "./types.js";
import { extractError } from "../utils/errors.js";

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

  async graphql<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
    try {
      const response = await this.http.post<{ data: T; errors?: Array<{ message: string }> }>(
        "/graphql",
        { query, variables },
      );
      if (response.data.errors && response.data.errors.length > 0) {
        const msg = response.data.errors.map((e) => e.message).join("; ");
        throw new Error(`GraphQL error: ${msg}`);
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
    const zones = await this.http.get<CloudflareResponse<Zone[]>>("/zones", {
      params: { name: nameOrId, per_page: 1 },
    });
    this.assertSuccess(zones.data, "GET /zones");
    const results = zones.data.result;
    if (!results || results.length === 0) {
      throw new Error(`Zone not found: ${nameOrId}`);
    }
    return results[0].id;
  }

  private assertSuccess<T>(response: CloudflareResponse<T>, endpoint: string): void {
    if (!response.success) {
      const firstError = response.errors[0];
      const code = firstError?.code ?? 0;
      const msg = firstError?.message ?? "Unknown Cloudflare API error";
      throw new Error(`Cloudflare API error [${code}] at ${endpoint}: ${msg}`);
    }
  }

  static fromEnv(): CloudflareClient {
    const apiToken = process.env["CLOUDFLARE_API_TOKEN"];

    if (!apiToken) {
      throw new Error("CLOUDFLARE_API_TOKEN environment variable is required");
    }

    const accountId = process.env["CLOUDFLARE_ACCOUNT_ID"];
    const timeout = parseInt(process.env["CLOUDFLARE_TIMEOUT"] ?? "30000", 10);

    return new CloudflareClient({ apiToken, accountId, timeout });
  }
}
