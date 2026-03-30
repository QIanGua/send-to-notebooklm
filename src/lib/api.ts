export function getApiBaseUrl(): string {
  return (import.meta.env.WXT_API_BASE_URL || '').trim().replace(/\/+$/, '');
}

export function isApiConfigured(): boolean {
  return Boolean(getApiBaseUrl());
}

export function getApiUrl(path: string): string {
  const baseUrl = getApiBaseUrl();
  if (!baseUrl) {
    throw new Error('Entitlement API is not configured yet. Add WXT_API_BASE_URL and rebuild the extension.');
  }

  return `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
}

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(getApiUrl(path), {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      typeof payload?.error === 'string'
        ? payload.error
        : typeof payload?.message === 'string'
          ? payload.message
          : `Request failed with status ${response.status}.`;
    throw new Error(message);
  }

  return payload as T;
}
