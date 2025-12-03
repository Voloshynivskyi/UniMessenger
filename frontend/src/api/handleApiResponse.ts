/**
 * Unified API response handler for the UniMessenger frontend.
 *
 * Purpose:
 *  This function ensures that all HTTP responses conform to a predictable structure.
 *  It converts raw backend responses into either:
 *   - Clean data object (if success: status === "ok")
 *   - Throws ApiError (if status === "error")
 *
 * Why this matters:
 *  - Components no longer need to manually check status or parse errors.
 *  - Centralized validation makes adding new API endpoints easier.
 *  - Guarantees consistent UX across the entire application.
 */

import { ApiError, type ApiErrorCode } from "./ApiError";

interface BackendOkResponse<T> {
  status: "ok";
  data: T;
}

interface BackendErrorResponse {
  status: "error";
  code: ApiErrorCode;
  message: string;
  details?: string[];
  retryAfter?: number;
}

/**
 * Processes HTTP response from apiClient (Axios instance).
 *
 * @param response - The raw Axios response object
 * @returns The actual data payload (if response.status === "ok")
 * @throws ApiError if response contains an error object
 */
export function handleApiResponse<T = any>(response: {
  data: BackendOkResponse<T> | BackendErrorResponse;
  status: number;
}): T {
  const { status, data } = response;

  // Success case
  if (data.status === "ok") {
    return (data as BackendOkResponse<T>).data;
  }

  // Error case: transform backend error into ApiError
  const error = data as BackendErrorResponse;
  throw new ApiError(error.code, error.message, status, {
    details: error.details,
    retryAfter: error.retryAfter,
  });
}
