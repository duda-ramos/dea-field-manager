/**
 * API helper for Lovable API calls through BFF/Proxy
 * Prevents CORS issues by routing through /api/lovable/... 
 */

export const API_BASE = "/api/lovable";

export class ApiError extends Error {
  constructor(public status: number, message: string, public response?: Response) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const url = `${API_BASE}${path.startsWith("/") ? "" : "/"}${path}`;
  
  const response = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new ApiError(
      response.status,
      `API ${response.status}: ${text || response.statusText}`,
      response
    );
  }

  return response;
}

export async function apiJson<T = any>(path: string, init?: RequestInit): Promise<T> {
  const response = await apiFetch(path, init);
  return response.json();
}

/**
 * OAuth token endpoint with proper x-www-form-urlencoded format
 * Fixes 400 Bad Request issues
 */
export async function getToken({ 
  username, 
  password, 
  clientId 
}: { 
  username: string; 
  password: string; 
  clientId?: string;
}): Promise<any> {
  const body = new URLSearchParams({
    grant_type: "password",
    username,
    password,
    ...(clientId && { client_id: clientId }),
  });

  const response = await fetch("/api/lovable/oauth/token", {
    method: "POST",
    headers: { 
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new ApiError(
      response.status,
      `Token error ${response.status}: ${text || response.statusText}`,
      response
    );
  }

  return response.json();
}

/**
 * Generic API call helper with authentication
 */
export async function authenticatedApiCall(
  path: string, 
  token: string, 
  init?: RequestInit
): Promise<Response> {
  return apiFetch(path, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...init?.headers,
    },
  });
}