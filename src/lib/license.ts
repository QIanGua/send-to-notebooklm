import { browser } from 'wxt/browser';
import { apiRequest, isApiConfigured } from './api';
import {
  FREE_ENTITLEMENTS,
  PRO_CAPABILITIES,
  type Capability,
  type EntitlementState,
  type PlanTier,
} from './entitlements';
import type { AuthSession } from './auth';

const STORAGE_KEYS = {
  entitlementCache: 'entitlementCache',
} as const;

const OFFLINE_GRACE_MS = 1000 * 60 * 60 * 48;

export interface LicenseInfo {
  status: 'none' | 'active' | 'redeemed' | 'expired';
  type: 'lifetime' | 'subscription' | 'trial' | 'unknown';
  codeMasked?: string;
}

export interface EntitlementCache {
  userId: string;
  entitlements: EntitlementState;
  lastSyncedAt: string;
  validUntil: string;
  license: LicenseInfo;
}

export interface EntitlementSummary {
  entitlements: EntitlementState;
  cache: EntitlementCache | null;
  status: 'anonymous' | 'cached' | 'stale' | 'remote';
}

interface RemoteEntitlementResponse {
  plan?: string;
  capabilities?: string[];
  expiresAt?: string | null;
  lastSyncedAt?: string | null;
  license?: {
    status?: string;
    type?: string;
    codeMasked?: string;
  };
}

interface BillingLinkResponse {
  url?: string;
}

function normalizePlan(plan: string | undefined): PlanTier {
  return plan === 'pro' ? 'pro' : 'free';
}

function normalizeCapabilities(capabilities: string[] | undefined, plan: PlanTier): Capability[] {
  const valid = new Set(PRO_CAPABILITIES);
  const normalized = (capabilities || []).filter((capability): capability is Capability => valid.has(capability as Capability));

  if (normalized.length > 0) return normalized;
  return plan === 'pro' ? [...PRO_CAPABILITIES] : [];
}

function normalizeLicenseInfo(raw?: RemoteEntitlementResponse['license']): LicenseInfo {
  return {
    status: raw?.status === 'active' || raw?.status === 'redeemed' || raw?.status === 'expired' ? raw.status : 'none',
    type:
      raw?.type === 'lifetime' || raw?.type === 'subscription' || raw?.type === 'trial'
        ? raw.type
        : 'unknown',
    codeMasked: raw?.codeMasked,
  };
}

function createCache(userId: string, response: RemoteEntitlementResponse): EntitlementCache {
  const plan = normalizePlan(response.plan);
  const entitlements: EntitlementState = {
    plan,
    capabilities: normalizeCapabilities(response.capabilities, plan),
    source: 'remote',
    updatedAt: response.lastSyncedAt || new Date().toISOString(),
  };
  const now = Date.now();
  const validUntil = response.expiresAt
    ? new Date(response.expiresAt).toISOString()
    : new Date(now + OFFLINE_GRACE_MS).toISOString();

  return {
    userId,
    entitlements,
    lastSyncedAt: response.lastSyncedAt || new Date(now).toISOString(),
    validUntil,
    license: normalizeLicenseInfo(response.license),
  };
}

export async function loadEntitlementCache(userId?: string): Promise<EntitlementCache | null> {
  const stored = await browser.storage.local.get(STORAGE_KEYS.entitlementCache);
  const cache = stored[STORAGE_KEYS.entitlementCache] as EntitlementCache | undefined;

  if (!cache) return null;
  if (userId && cache.userId !== userId) return null;
  return cache;
}

export async function saveEntitlementCache(cache: EntitlementCache): Promise<void> {
  await browser.storage.local.set({
    [STORAGE_KEYS.entitlementCache]: cache,
  });
}

export async function clearEntitlementCache(): Promise<void> {
  await browser.storage.local.remove(STORAGE_KEYS.entitlementCache);
}

export function isEntitlementCacheValid(cache: EntitlementCache | null): boolean {
  if (!cache) return false;
  return new Date(cache.validUntil).getTime() > Date.now();
}

export async function getEffectiveEntitlementsForSession(session: AuthSession | null): Promise<EntitlementSummary> {
  if (!session) {
    return {
      entitlements: FREE_ENTITLEMENTS,
      cache: null,
      status: 'anonymous',
    };
  }

  const cache = await loadEntitlementCache(session.user.id);
  if (!cache) {
    return {
      entitlements: FREE_ENTITLEMENTS,
      cache: null,
      status: 'cached',
    };
  }

  return {
    entitlements: cache.entitlements,
    cache,
    status: isEntitlementCacheValid(cache) ? 'cached' : 'stale',
  };
}

function buildRemoteHeaders(session: AuthSession): HeadersInit {
  return {
    Authorization: `Bearer ${session.accessToken}`,
  };
}

export async function refreshRemoteEntitlements(session: AuthSession): Promise<EntitlementCache> {
  if (!isApiConfigured()) {
    throw new Error('Entitlement API is not configured yet. Add WXT_API_BASE_URL and rebuild the extension.');
  }

  const response = await apiRequest<RemoteEntitlementResponse>('/api/ext/entitlements', {
    method: 'GET',
    headers: buildRemoteHeaders(session),
  });

  const cache = createCache(session.user.id, response);
  await saveEntitlementCache(cache);
  return cache;
}

export async function redeemLicense(session: AuthSession, code: string): Promise<EntitlementCache> {
  if (!isApiConfigured()) {
    throw new Error('Entitlement API is not configured yet. Add WXT_API_BASE_URL and rebuild the extension.');
  }

  const response = await apiRequest<RemoteEntitlementResponse>('/api/ext/licenses/redeem', {
    method: 'POST',
    headers: buildRemoteHeaders(session),
    body: JSON.stringify({ code }),
  });

  const cache = createCache(session.user.id, response);
  await saveEntitlementCache(cache);
  return cache;
}

async function fetchBillingLink(session: AuthSession, path: string): Promise<string> {
  if (!isApiConfigured()) {
    throw new Error('Entitlement API is not configured yet. Add WXT_API_BASE_URL and rebuild the extension.');
  }

  const response = await apiRequest<BillingLinkResponse>(path, {
    method: 'POST',
    headers: buildRemoteHeaders(session),
    body: JSON.stringify({}),
  });

  if (!response.url) {
    throw new Error('Billing link response did not include a URL.');
  }

  return response.url;
}

export async function createCheckoutLink(session: AuthSession): Promise<string> {
  return fetchBillingLink(session, '/api/ext/billing/checkout-link');
}

export async function getCustomerPortalLink(session: AuthSession): Promise<string> {
  return fetchBillingLink(session, '/api/ext/billing/portal-link');
}
