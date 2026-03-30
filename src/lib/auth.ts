import { browser } from 'wxt/browser';
import { FREE_ENTITLEMENTS, type EntitlementState } from './entitlements';

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  picture: string;
}

export interface AuthSession {
  user: UserProfile;
  accessToken: string;
  plan: EntitlementState['plan'];
  entitlements: EntitlementState;
  signedInAt: string;
}

const STORAGE_KEYS = {
  authSession: 'authSession',
} as const;

const GOOGLE_OAUTH_PLACEHOLDER = 'REPLACE_WITH_GOOGLE_OAUTH_CLIENT_ID.apps.googleusercontent.com';

interface GoogleUserInfoResponse {
  sub: string;
  email?: string;
  name?: string;
  picture?: string;
}

export function getGoogleOauthClientId(): string {
  return browser.runtime.getManifest().oauth2?.client_id || '';
}

export function isGoogleAuthConfigured(): boolean {
  const clientId = getGoogleOauthClientId();
  return Boolean(clientId && clientId !== GOOGLE_OAUTH_PLACEHOLDER);
}

export async function loadAuthSession(): Promise<AuthSession | null> {
  const stored = await browser.storage.local.get(STORAGE_KEYS.authSession);
  const session = stored[STORAGE_KEYS.authSession] as AuthSession | undefined;

  if (!session) return null;
  return session;
}

export async function signInWithGoogle(): Promise<AuthSession> {
  if (!browser.identity?.getAuthToken) {
    throw new Error('Google sign-in is only available in the Chrome extension runtime.');
  }

  if (!isGoogleAuthConfigured()) {
    throw new Error('Google OAuth client ID is not configured yet. Add WXT_GOOGLE_OAUTH_CLIENT_ID before using sign-in.');
  }

  const tokenResult = await browser.identity.getAuthToken({ interactive: true });
  const accessToken = typeof tokenResult === 'string' ? tokenResult : tokenResult?.token;

  if (!accessToken) {
    throw new Error('Google sign-in did not return an access token.');
  }

  const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error('Could not fetch Google account information.');
  }

  const user = (await response.json()) as GoogleUserInfoResponse;
  if (!user.sub || !user.email) {
    throw new Error('Google account information is incomplete.');
  }

  const session: AuthSession = {
    user: {
      id: user.sub,
      email: user.email,
      name: user.name || user.email,
      picture: user.picture || '',
    },
    accessToken,
    plan: 'free',
    entitlements: FREE_ENTITLEMENTS,
    signedInAt: new Date().toISOString(),
  };

  await browser.storage.local.set({
    [STORAGE_KEYS.authSession]: session,
  });

  return session;
}

export async function signOut(): Promise<void> {
  const session = await loadAuthSession();

  if (session?.accessToken && browser.identity?.removeCachedAuthToken) {
    try {
      await browser.identity.removeCachedAuthToken({ token: session.accessToken });
    } catch {
      // Ignore cached token cleanup failures so sign-out remains resilient.
    }
  }

  await browser.storage.local.remove(STORAGE_KEYS.authSession);
}

export async function getEffectiveEntitlements(): Promise<EntitlementState> {
  // Always return PRO entitlements without requiring login.
  return FREE_ENTITLEMENTS;
}
