import { reportOwnerAiFailure } from './ownerAiMonitor';

/**
 * API utility functions with error handling and retry logic
 */

export interface ApiOptions extends RequestInit {
  timeout?: number;
  retries?: number;
  retryDelay?: number;
}

export interface ApiResponse<T> {
  data: T | null;
  error: string | null;
  status: number;
}

const DEFAULT_TIMEOUT = 30000; // 30 seconds
const DEFAULT_RETRIES = 3;
const DEFAULT_RETRY_DELAY = 1000; // 1 second

/**
 * Sleep for a specified duration
 */
const sleep = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

/**
 * Fetch with timeout
 */
async function fetchWithTimeout(
  url: string,
  options: ApiOptions = {}
): Promise<Response> {
  const { timeout = DEFAULT_TIMEOUT, ...fetchOptions } = options;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

/**
 * Fetch with retry logic
 */
async function fetchWithRetry(
  url: string,
  options: ApiOptions = {}
): Promise<Response> {
  const { retries = DEFAULT_RETRIES, retryDelay = DEFAULT_RETRY_DELAY, ...fetchOptions } = options;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fetchWithTimeout(url, fetchOptions);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Don't retry on client errors (4xx)
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw error;
      }

      if (attempt < retries) {
        await sleep(retryDelay * Math.pow(2, attempt)); // Exponential backoff
      }
    }
  }

  throw lastError || new Error('Max retries reached');
}

/**
 * Generic API call function
 */
export async function apiCall<T = any>(
  url: string,
  options: ApiOptions = {}
): Promise<ApiResponse<T>> {
  try {
    const response = await fetchWithRetry(url, {
      ...options,
      timeout: options.timeout || DEFAULT_TIMEOUT,
      retries: options.retries ?? DEFAULT_RETRIES,
      retryDelay: options.retryDelay || DEFAULT_RETRY_DELAY,
    });

    if (!response.ok) {
      void reportOwnerAiFailure({
        source: 'api-client',
        operation: `${options.method || 'GET'} ${url}`,
        severity: response.status >= 500 ? 'critical' : 'warning',
        message: `API request failed with ${response.status}: ${response.statusText}`,
        details: { status: response.status, statusText: response.statusText },
      });
      return {
        data: null,
        error: `خطأ ${response.status}: ${response.statusText}`,
        status: response.status,
      };
    }

    const data = await response.json();

    return {
      data,
      error: null,
      status: response.status,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'حدث خطأ غير متوقع';
    void reportOwnerAiFailure({
      source: 'api-client',
      operation: `${options.method || 'GET'} ${url}`,
      severity: 'critical',
      message,
      stack: error instanceof Error ? error.stack : undefined,
    });
    return {
      data: null,
      error: message,
      status: 0,
    };
  }
}

/**
 * GET request
 */
export async function apiGet<T = any>(
  url: string,
  options: ApiOptions = {}
): Promise<ApiResponse<T>> {
  return apiCall<T>(url, {
    ...options,
    method: 'GET',
  });
}

/**
 * POST request
 */
export async function apiPost<T = any>(
  url: string,
  body: any,
  options: ApiOptions = {}
): Promise<ApiResponse<T>> {
  return apiCall<T>(url, {
    ...options,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    body: JSON.stringify(body),
  });
}

/**
 * PUT request
 */
export async function apiPut<T = any>(
  url: string,
  body: any,
  options: ApiOptions = {}
): Promise<ApiResponse<T>> {
  return apiCall<T>(url, {
    ...options,
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    body: JSON.stringify(body),
  });
}

/**
 * DELETE request
 */
export async function apiDelete<T = any>(
  url: string,
  options: ApiOptions = {}
): Promise<ApiResponse<T>> {
  return apiCall<T>(url, {
    ...options,
    method: 'DELETE',
  });
}

/**
 * PATCH request
 */
export async function apiPatch<T = any>(
  url: string,
  body: any,
  options: ApiOptions = {}
): Promise<ApiResponse<T>> {
  return apiCall<T>(url, {
    ...options,
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    body: JSON.stringify(body),
  });
}
