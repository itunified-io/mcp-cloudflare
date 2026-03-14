import axios from "axios";

export class CloudflareApiError extends Error {
  readonly status: number | undefined;
  readonly endpoint: string;
  readonly errorCode: number | undefined;
  readonly details: string | undefined;

  constructor(
    message: string,
    endpoint: string,
    status?: number,
    errorCode?: number,
    details?: string,
  ) {
    super(message);
    this.name = "CloudflareApiError";
    this.endpoint = endpoint;
    this.status = status;
    this.errorCode = errorCode;
    this.details = details;
  }
}

function sanitizeDetails(data: unknown): string | undefined {
  if (data == null) return undefined;
  if (typeof data === "string") return data;
  if (typeof data === "object") {
    return JSON.stringify(data);
  }
  return String(data);
}

export function extractError(
  error: unknown,
  endpoint: string,
): CloudflareApiError {
  // Handle errors already thrown as CloudflareApiError (from assertSuccess)
  if (error instanceof CloudflareApiError) {
    return error;
  }

  // Pass-through plain Error messages from assertSuccess
  if (error instanceof Error && !axios.isAxiosError(error)) {
    return new CloudflareApiError(error.message, endpoint);
  }

  if (axios.isAxiosError(error)) {
    const response = error.response;

    // Rate limit handling
    if (response?.status === 429) {
      return new CloudflareApiError(
        "Cloudflare API rate limit exceeded — retry after a moment",
        endpoint,
        429,
      );
    }

    if (response) {
      const data = response.data as {
        success?: boolean;
        errors?: Array<{ code?: number; message?: string }>;
        message?: string;
      } | undefined;

      // Extract Cloudflare-style error
      if (data?.errors && data.errors.length > 0) {
        const firstError = data.errors[0];
        const code = firstError?.code;
        const msg = firstError?.message ?? `Cloudflare API error: ${response.status} ${response.statusText}`;
        return new CloudflareApiError(msg, endpoint, response.status, code, sanitizeDetails(data.errors));
      }

      const message =
        typeof data?.message === "string"
          ? data.message
          : `Cloudflare API error: ${response.status} ${response.statusText}`;

      return new CloudflareApiError(message, endpoint, response.status);
    }

    // Network-level errors
    if (
      error.code === "ECONNREFUSED" ||
      error.code === "ENOTFOUND" ||
      error.code === "ETIMEDOUT"
    ) {
      return new CloudflareApiError(
        `Network error: ${error.code} — unable to reach Cloudflare API`,
        endpoint,
      );
    }

    return new CloudflareApiError(
      error.message || "Unknown network error",
      endpoint,
    );
  }

  if (error instanceof Error) {
    return new CloudflareApiError(error.message, endpoint);
  }

  return new CloudflareApiError("Unknown error occurred", endpoint);
}
