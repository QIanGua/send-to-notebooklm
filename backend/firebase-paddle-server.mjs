import { createHmac, timingSafeEqual } from 'node:crypto';
import { createServer } from 'node:http';

const PORT = Number(process.env.STN_BACKEND_PORT || 8788);
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo';
const PRO_CAPABILITIES = ['batch_import', 'dedupe', 'auto_routing', 'import_history', 'presets'];
const OFFLINE_GRACE_MS = 1000 * 60 * 60 * 48;

async function loadFirebaseAdmin() {
  try {
    const appModule = await import('firebase-admin/app');
    const firestoreModule = await import('firebase-admin/firestore');

    const projectId = process.env.FIREBASE_PROJECT_ID || '';
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL || '';
    const privateKey = (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n');

    if (!projectId || !clientEmail || !privateKey) {
      throw new Error('Missing Firebase Admin env vars. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY.');
    }

    const app = appModule.initializeApp({
      credential: appModule.cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    });

    return {
      db: firestoreModule.getFirestore(app),
      FieldValue: firestoreModule.FieldValue,
    };
  } catch (error) {
    if (error instanceof Error && error.message.includes('Cannot find package')) {
      throw new Error('firebase-admin is not installed. Run `npm install firebase-admin` before starting the Firebase backend.');
    }
    throw error;
  }
}

const firebase = await loadFirebaseAdmin();
const db = firebase.db;
const FieldValue = firebase.FieldValue;

function json(data, status = 200) {
  return {
    status,
    body: JSON.stringify(data),
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, Paddle-Signature',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    },
  };
}

function maskCode(code) {
  if (!code || code.length < 8) return code;
  return `${code.slice(0, 8)}****${code.slice(-4)}`;
}

async function readRawBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

function parseJson(buffer) {
  const raw = buffer.toString('utf8').trim();
  return raw ? JSON.parse(raw) : {};
}

async function getGoogleUser(req) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice('Bearer '.length).trim() : '';

  if (!token) {
    throw { status: 401, message: 'Missing bearer token.' };
  }

  const response = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    throw { status: 401, message: 'Google access token is invalid or expired.' };
  }

  const user = await response.json();
  if (!user.sub || !user.email) {
    throw { status: 401, message: 'Google account information is incomplete.' };
  }

  return {
    id: user.sub,
    email: user.email,
    name: user.name || user.email,
    picture: user.picture || '',
  };
}

async function upsertUser(user) {
  await db.collection('users').doc(user.id).set(
    {
      googleSub: user.id,
      email: user.email,
      name: user.name,
      picture: user.picture,
      authProvider: 'google',
      updatedAt: new Date().toISOString(),
      lastSeenAt: new Date().toISOString(),
      createdAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
}

async function getEntitlementDoc(userId) {
  const snapshot = await db.collection('entitlements').doc(userId).get();
  return snapshot.exists ? snapshot.data() : null;
}

function normalizeEntitlement(doc) {
  if (!doc) {
    return {
      plan: 'free',
      capabilities: [],
      expiresAt: null,
      lastSyncedAt: new Date().toISOString(),
      license: {
        status: 'none',
        type: 'unknown',
      },
    };
  }

  return {
    plan: doc.plan === 'pro' ? 'pro' : 'free',
    capabilities: Array.isArray(doc.capabilities) ? doc.capabilities : [],
    expiresAt: doc.expiresAt || null,
    lastSyncedAt: new Date().toISOString(),
    license: {
      status: doc.license?.status || 'none',
      type: doc.license?.type || 'unknown',
      codeMasked: doc.license?.codeMasked,
    },
  };
}

async function getEntitlementsForUser(user) {
  await upsertUser(user);
  const doc = await getEntitlementDoc(user.id);
  return normalizeEntitlement(doc);
}

async function redeemLicenseForUser(user, code) {
  const normalizedCode = String(code || '').trim().toUpperCase();
  if (!normalizedCode) {
    throw { status: 400, message: 'License code is required.' };
  }

  const licenseRef = db.collection('licenses').doc(normalizedCode);
  const entitlementRef = db.collection('entitlements').doc(user.id);

  await db.runTransaction(async (transaction) => {
    const licenseSnap = await transaction.get(licenseRef);
    if (!licenseSnap.exists) {
      throw { status: 404, message: 'License code is invalid.' };
    }

    const license = licenseSnap.data();
    if (license.boundUserId && license.boundUserId !== user.id) {
      throw { status: 409, message: 'License code is already bound to another account.' };
    }

    if (license.status === 'expired') {
      throw { status: 409, message: 'License code has expired.' };
    }

    transaction.set(
      licenseRef,
      {
        boundUserId: user.id,
        redeemedAt: new Date().toISOString(),
        status: 'active',
      },
      { merge: true },
    );

    transaction.set(
      entitlementRef,
      {
        userId: user.id,
        plan: license.plan === 'pro' ? 'pro' : 'free',
        capabilities: license.plan === 'pro' ? [...PRO_CAPABILITIES] : [],
        status: 'active',
        source: 'license',
        updatedAt: new Date().toISOString(),
        expiresAt: license.expiresAt || null,
        license: {
          status: 'active',
          type: license.type || 'lifetime',
          codeMasked: maskCode(normalizedCode),
        },
      },
      { merge: true },
    );
  });

  return getEntitlementsForUser(user);
}

function verifyPaddleSignature(rawBody, signatureHeader) {
  const secret = process.env.PADDLE_WEBHOOK_SECRET || '';
  if (!secret) {
    throw { status: 500, message: 'Missing PADDLE_WEBHOOK_SECRET.' };
  }

  if (!signatureHeader) {
    throw { status: 400, message: 'Missing Paddle-Signature header.' };
  }

  const parsed = Object.fromEntries(
    signatureHeader.split(';').map((part) => {
      const [key, value] = part.split('=');
      return [key, value];
    }),
  );

  const timestamp = parsed.ts;
  const incomingSignature = parsed.h1;

  if (!timestamp || !incomingSignature) {
    throw { status: 400, message: 'Malformed Paddle-Signature header.' };
  }

  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (age > 300) {
    throw { status: 400, message: 'Paddle webhook timestamp is too old.' };
  }

  const signedPayload = `${timestamp}:${rawBody.toString('utf8')}`;
  const expected = createHmac('sha256', secret).update(signedPayload).digest('hex');
  const incoming = Buffer.from(incomingSignature, 'hex');
  const local = Buffer.from(expected, 'hex');

  if (incoming.length !== local.length || !timingSafeEqual(incoming, local)) {
    throw { status: 401, message: 'Invalid Paddle webhook signature.' };
  }
}

async function markWebhookProcessed(eventId, eventType) {
  await db.collection('webhook_events').doc(eventId).set(
    {
      eventId,
      source: 'paddle',
      eventType,
      processed: true,
      receivedAt: new Date().toISOString(),
    },
    { merge: true },
  );
}

async function hasProcessedWebhook(eventId) {
  const snapshot = await db.collection('webhook_events').doc(eventId).get();
  return snapshot.exists && snapshot.data()?.processed;
}

function resolveUserIdFromPaddleEntity(entity) {
  return (
    entity?.custom_data?.googleSub ||
    entity?.custom_data?.google_sub ||
    entity?.custom_data?.userId ||
    entity?.metadata?.googleSub ||
    entity?.metadata?.userId ||
    null
  );
}

function deriveSubscriptionStatus(entity) {
  const status = entity?.status || '';
  return typeof status === 'string' ? status : 'inactive';
}

async function syncEntitlementFromSubscription(entity) {
  const userId = resolveUserIdFromPaddleEntity(entity);
  if (!userId) return;

  const subscriptionId = entity?.id || entity?.subscription_id || '';
  const priceId = entity?.items?.[0]?.price?.id || entity?.items?.[0]?.price_id || null;
  const customerId = entity?.customer_id || entity?.customer?.id || null;
  const status = deriveSubscriptionStatus(entity);
  const active = ['active', 'trialing'].includes(status);
  const periodEnd = entity?.current_billing_period?.ends_at || entity?.next_billed_at || null;

  await db.collection('subscriptions').doc(String(subscriptionId)).set(
    {
      subscriptionId,
      userId,
      customerId,
      status,
      priceId,
      productId: entity?.items?.[0]?.price?.product_id || null,
      currentPeriodStartsAt: entity?.current_billing_period?.starts_at || null,
      currentPeriodEndsAt: periodEnd,
      cancelAtPeriodEnd: Boolean(entity?.scheduled_change),
      updatedAt: new Date().toISOString(),
      raw: entity,
    },
    { merge: true },
  );

  await db.collection('entitlements').doc(String(userId)).set(
    {
      userId,
      plan: active ? 'pro' : 'free',
      capabilities: active ? [...PRO_CAPABILITIES] : [],
      source: 'paddle',
      status,
      updatedAt: new Date().toISOString(),
      expiresAt: active ? periodEnd || new Date(Date.now() + OFFLINE_GRACE_MS).toISOString() : null,
      license: {
        status: active ? 'active' : status,
        type: 'subscription',
      },
    },
    { merge: true },
  );
}

async function handlePaddleWebhook(req) {
  const rawBody = await readRawBody(req);
  verifyPaddleSignature(rawBody, String(req.headers['paddle-signature'] || ''));

  const payload = parseJson(rawBody);
  const eventId = payload?.event_id || payload?.eventId || payload?.notification_id;
  const eventType = payload?.event_type || payload?.eventType || '';

  if (!eventId || !eventType) {
    throw { status: 400, message: 'Malformed Paddle webhook payload.' };
  }

  if (await hasProcessedWebhook(eventId)) {
    return json({ ok: true, deduped: true });
  }

  const entity = payload?.data || {};

  if (
    eventType === 'subscription.created' ||
    eventType === 'subscription.updated' ||
    eventType === 'subscription.canceled' ||
    eventType === 'subscription.resumed' ||
    eventType === 'subscription.paused' ||
    eventType === 'subscription.past_due' ||
    eventType === 'transaction.completed'
  ) {
    await syncEntitlementFromSubscription(entity);
  }

  await markWebhookProcessed(String(eventId), String(eventType));
  return json({ ok: true });
}

async function createCheckoutLink(req) {
  const user = await getGoogleUser(req);
  await upsertUser(user);

  const checkoutUrl = process.env.PADDLE_CHECKOUT_URL || '';
  if (!checkoutUrl) {
    throw { status: 500, message: 'Missing PADDLE_CHECKOUT_URL.' };
  }

  const url = new URL(checkoutUrl);
  url.searchParams.set('user_id', user.id);
  url.searchParams.set('email', user.email);
  return json({ url: url.toString() });
}

async function createPortalLink(req) {
  const user = await getGoogleUser(req);
  await upsertUser(user);

  const portalUrl = process.env.PADDLE_CUSTOMER_PORTAL_URL || '';
  if (!portalUrl) {
    throw { status: 500, message: 'Missing PADDLE_CUSTOMER_PORTAL_URL.' };
  }

  const url = new URL(portalUrl);
  url.searchParams.set('user_id', user.id);
  url.searchParams.set('email', user.email);
  return json({ url: url.toString() });
}

const server = createServer(async (req, res) => {
  try {
    if (!req.url || !req.method) {
      throw { status: 400, message: 'Invalid request.' };
    }

    if (req.method === 'OPTIONS') {
      const response = json({}, 204);
      res.writeHead(response.status, response.headers);
      res.end();
      return;
    }

    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    let response;

    if (req.method === 'GET' && url.pathname === '/healthz') {
      response = json({ ok: true, firestore: true });
    } else if (req.method === 'POST' && url.pathname === '/api/ext/session') {
      response = json(await getEntitlementsForUser(await getGoogleUser(req)));
    } else if (req.method === 'GET' && url.pathname === '/api/ext/entitlements') {
      response = json(await getEntitlementsForUser(await getGoogleUser(req)));
    } else if (req.method === 'POST' && url.pathname === '/api/ext/licenses/redeem') {
      const user = await getGoogleUser(req);
      const body = parseJson(await readRawBody(req));
      response = json(await redeemLicenseForUser(user, body.code));
    } else if (req.method === 'POST' && url.pathname === '/api/ext/billing/checkout-link') {
      response = await createCheckoutLink(req);
    } else if (req.method === 'POST' && url.pathname === '/api/ext/billing/portal-link') {
      response = await createPortalLink(req);
    } else if (req.method === 'POST' && url.pathname === '/api/paddle/webhook') {
      response = await handlePaddleWebhook(req);
    } else {
      response = json({ error: 'Not found.' }, 404);
    }

    res.writeHead(response.status, response.headers);
    res.end(response.body);
  } catch (error) {
    const status = Number(error?.status || 500);
    const message = typeof error?.message === 'string' ? error.message : 'Internal server error.';
    const response = json({ error: message }, status);
    res.writeHead(response.status, response.headers);
    res.end(response.body);
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[stn-firebase-backend] listening on http://127.0.0.1:${PORT}`);
});
