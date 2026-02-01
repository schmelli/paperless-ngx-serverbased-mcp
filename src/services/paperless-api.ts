/**
 * Paperless NGX API Client Service
 * 
 * This module provides a centralized HTTP client for communicating with the
 * Paperless NGX REST API. It handles authentication, error responses, and
 * provides type-safe request/response handling.
 * 
 * All API interactions should go through this service to ensure consistent
 * error handling and authentication across all tools.
 */

import {
  PAPERLESS_URL,
  PAPERLESS_TOKEN,
  REQUEST_TIMEOUT_MS
} from "../constants.js";
import type { ApiErrorResponse } from "../types.js";

/**
 * Custom error class for Paperless API errors.
 * Provides structured error information including HTTP status codes.
 */
export class PaperlessApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly responseBody?: unknown
  ) {
    super(message);
    this.name = "PaperlessApiError";
  }
}

/**
 * Validates that required configuration is present.
 * Throws descriptive errors if configuration is missing.
 */
function validateConfig(): void {
  if (!PAPERLESS_URL) {
    throw new PaperlessApiError(
      "PAPERLESS_URL environment variable is not set. " +
      "Please configure it with your Paperless NGX server URL (e.g., https://paperless.example.com)"
    );
  }
  if (!PAPERLESS_TOKEN) {
    throw new PaperlessApiError(
      "PAPERLESS_TOKEN environment variable is not set. " +
      "Please configure it with an API token from your Paperless NGX server. " +
      "You can create one in Settings → API Tokens."
    );
  }
}

/**
 * Build authorization headers for API requests.
 * Uses token-based authentication as required by Paperless NGX.
 */
function getHeaders(contentType: string = "application/json"): Record<string, string> {
  return {
    "Authorization": `Token ${PAPERLESS_TOKEN}`,
    "Content-Type": contentType,
    "Accept": "application/json"
  };
}

/**
 * Parse error response body into a human-readable message.
 * Paperless may return errors in different formats depending on the endpoint.
 */
function parseErrorResponse(body: unknown): string {
  if (!body) return "Unknown error";
  
  if (typeof body === "string") {
    try {
      body = JSON.parse(body) as unknown;
    } catch {
      return body as string;
    }
  }
  
  const error = body as ApiErrorResponse;
  
  // Check various error response formats used by Paperless
  if (error.detail) return error.detail;
  if (error.error) return error.error;
  if (error.non_field_errors?.length) return error.non_field_errors.join(", ");
  
  // Check for field-specific errors
  const fieldErrors = Object.entries(error)
    .filter(([key]) => !["detail", "error", "non_field_errors"].includes(key))
    .filter(([, value]) => Array.isArray(value) || typeof value === "string")
    .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(", ") : value}`);
  
  if (fieldErrors.length > 0) return fieldErrors.join("; ");
  
  return JSON.stringify(body);
}

/**
 * Format HTTP errors into actionable user-friendly messages.
 * Includes specific guidance for common error scenarios.
 */
function formatHttpError(status: number, body: unknown): string {
  const detail = parseErrorResponse(body);
  
  switch (status) {
    case 400:
      return `Bad request: ${detail}. Please check your input parameters.`;
    case 401:
      return "Authentication failed. Your PAPERLESS_TOKEN may be invalid or expired. " +
             "Please verify the token in your Paperless NGX settings.";
    case 403:
      return `Permission denied: ${detail}. Your API token may lack the required permissions for this operation.`;
    case 404:
      return "Resource not found. Please verify the ID exists in Paperless NGX.";
    case 409:
      return `Conflict: ${detail}. The resource may have been modified by another user.`;
    case 413:
      return "File too large. Please reduce the file size and try again.";
    case 429:
      return "Rate limit exceeded. Please wait a moment before making more requests.";
    case 500:
    case 502:
    case 503:
    case 504:
      return `Paperless server error (HTTP ${status}). The server may be unavailable or overloaded. Please try again later.`;
    default:
      return `HTTP ${status} error: ${detail}`;
  }
}

/**
 * Make an authenticated request to the Paperless NGX API.
 * 
 * This is the core function for all API interactions. It handles:
 * - Configuration validation
 * - Authentication headers
 * - Request timeout
 * - Error response parsing
 * - Type-safe response handling
 * 
 * @param method - HTTP method (GET, POST, PUT, PATCH, DELETE)
 * @param endpoint - API endpoint path starting with / (e.g., "/api/documents/")
 * @param options - Optional request configuration
 * @returns Parsed JSON response with the specified type
 * @throws PaperlessApiError on any request failure
 */
export async function apiRequest<T>(
  method: string,
  endpoint: string,
  options: {
    params?: Record<string, string | number | boolean | undefined>;
    body?: unknown;
    formData?: FormData;
  } = {}
): Promise<T> {
  // Ensure configuration is valid before making requests
  validateConfig();
  
  // Build the full URL with query parameters
  const url = new URL(`${PAPERLESS_URL}${endpoint}`);
  
  if (options.params) {
    Object.entries(options.params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.append(key, String(value));
      }
    });
  }
  
  // Prepare request options
  const fetchOptions: RequestInit = {
    method,
    headers: options.formData 
      ? { "Authorization": `Token ${PAPERLESS_TOKEN}`, "Accept": "application/json" }
      : getHeaders(),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  };
  
  // Add request body if present
  if (options.formData) {
    fetchOptions.body = options.formData;
  } else if (options.body !== undefined) {
    fetchOptions.body = JSON.stringify(options.body);
    // Debug: Log the actual body being sent
    console.error(`[API DEBUG] ${method} ${endpoint}`);
    console.error(`[API DEBUG] Body: ${fetchOptions.body}`);
  }
  
  try {
    const response = await fetch(url.toString(), fetchOptions);
    
    // Handle non-2xx responses
    if (!response.ok) {
      let errorBody: unknown;
      try {
        errorBody = await response.json();
      } catch {
        errorBody = await response.text().catch(() => null);
      }
      
      throw new PaperlessApiError(
        formatHttpError(response.status, errorBody),
        response.status,
        errorBody
      );
    }
    
    // Handle empty responses (e.g., DELETE operations return 204)
    if (response.status === 204 || response.headers.get("content-length") === "0") {
      return { status: "success" } as T;
    }
    
    // Parse and return JSON response
    return await response.json() as T;
    
  } catch (error) {
    // Re-throw our custom errors as-is
    if (error instanceof PaperlessApiError) {
      throw error;
    }
    
    // Handle network and timeout errors
    if (error instanceof Error) {
      if (error.name === "TimeoutError" || error.name === "AbortError") {
        throw new PaperlessApiError(
          `Request timed out after ${REQUEST_TIMEOUT_MS / 1000} seconds. ` +
          "The Paperless server may be slow or unreachable.",
          undefined,
          undefined
        );
      }
      
      if (error.message.includes("fetch") || error.message.includes("network")) {
        throw new PaperlessApiError(
          `Could not connect to Paperless at ${PAPERLESS_URL}. ` +
          "Please verify the URL is correct and the server is running.",
          undefined,
          undefined
        );
      }
      
      throw new PaperlessApiError(
        `Request failed: ${error.message}`,
        undefined,
        undefined
      );
    }
    
    throw new PaperlessApiError(
      "An unexpected error occurred while communicating with Paperless NGX.",
      undefined,
      undefined
    );
  }
}

/**
 * Convenience wrapper for GET requests.
 */
export async function get<T>(
  endpoint: string,
  params?: Record<string, string | number | boolean | undefined>
): Promise<T> {
  return apiRequest<T>("GET", endpoint, { params });
}

/**
 * Convenience wrapper for POST requests.
 */
export async function post<T>(
  endpoint: string,
  body?: unknown,
  formData?: FormData
): Promise<T> {
  return apiRequest<T>("POST", endpoint, { body, formData });
}

/**
 * Convenience wrapper for PATCH requests.
 */
export async function patch<T>(
  endpoint: string,
  body: unknown
): Promise<T> {
  return apiRequest<T>("PATCH", endpoint, { body });
}

/**
 * Convenience wrapper for DELETE requests.
 */
export async function del<T>(endpoint: string): Promise<T> {
  return apiRequest<T>("DELETE", endpoint);
}
