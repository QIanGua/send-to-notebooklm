import {
  FREE_ENTITLEMENTS,
  type EntitlementState,
} from './entitlements';
import type { AuthSession } from './auth';

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

export async function getEffectiveEntitlementsForSession(_session: AuthSession | null): Promise<EntitlementSummary> {
  return {
    entitlements: FREE_ENTITLEMENTS,
    cache: null,
    status: 'anonymous',
  };
}

export function isEntitlementCacheValid(_cache: EntitlementCache | null): boolean {
  return true;
}

export async function clearEntitlementCache(): Promise<void> {
  // No-op in standalone mode
}

export async function refreshRemoteEntitlements(_session: AuthSession): Promise<EntitlementCache> {
  throw new Error('Remote entitlements are disabled in standalone mode.');
}

export async function redeemLicense(_session: AuthSession, _code: string): Promise<EntitlementCache> {
  throw new Error('License redemption is disabled in standalone mode.');
}

export async function createCheckoutLink(_session: AuthSession): Promise<string> {
  throw new Error('Billing is disabled in standalone mode.');
}

export async function getCustomerPortalLink(_session: AuthSession): Promise<string> {
  throw new Error('Billing is disabled in standalone mode.');
}


