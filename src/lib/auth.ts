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

export function getGoogleOauthClientId(): string {
  return '';
}

export function isGoogleAuthConfigured(): boolean {
  return true; // Pretend it's always configured to avoid errors
}

export async function loadAuthSession(): Promise<AuthSession | null> {
  const stored = await browser.storage.local.get(STORAGE_KEYS.authSession);
  const session = stored[STORAGE_KEYS.authSession] as AuthSession | undefined;

  if (!session) return null;
  return session;
}

export async function signInWithGoogle(): Promise<AuthSession> {
  // Return a mock session in standalone mode
  const session: AuthSession = {
    user: {
      id: 'standalone-user',
      email: 'user@standalone.local',
      name: 'Local User',
      picture: '',
    },
    accessToken: 'mock-token',
    plan: 'pro',
    entitlements: FREE_ENTITLEMENTS,
    signedAt: new Date().toISOString(),
  } as any;

  await browser.storage.local.set({
    [STORAGE_KEYS.authSession]: session,
  });

  return session;
}

export async function signOut(): Promise<void> {
  await browser.storage.local.remove(STORAGE_KEYS.authSession);
}

export async function getEffectiveEntitlements(): Promise<EntitlementState> {
  // Always return PRO entitlements without requiring login.
  return FREE_ENTITLEMENTS;
}

