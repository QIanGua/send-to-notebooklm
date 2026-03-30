export function getApiBaseUrl(): string {
  return '';
}

export function isApiConfigured(): boolean {
  return false;
}

export function getApiUrl(path: string): string {
  throw new Error(`API calls are disabled in standalone mode. Attempted: ${path}`);
}

export async function apiRequest<T>(path: string, _init: RequestInit = {}): Promise<T> {
  throw new Error(`API requests are disabled in standalone mode. Attempted: ${path}`);
}

