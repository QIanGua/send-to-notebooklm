import { createServer } from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.STN_BACKEND_PORT || 8788);
const DATA_FILE = resolve(process.env.STN_BACKEND_DATA_FILE || resolve(__dirname, 'data', 'store.json'));
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo';
const PRO_CAPABILITIES = ['batch_import', 'dedupe', 'auto_routing', 'import_history', 'presets'];

const DEFAULT_STORE = {
  users: {},
  licenses: {
    'STN-PRO-DEMO-2026': {
      code: 'STN-PRO-DEMO-2026',
      plan: 'pro',
      type: 'lifetime',
      status: 'active',
      boundUserId: null,
      redeemedAt: null,
      expiresAt: null,
    },
  },
};

function json(data, status = 200) {
  return {
    status,
    body: JSON.stringify(data),
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    },
  };
}

function maskCode(code) {
  if (!code || code.length < 8) return code;
  return `${code.slice(0, 8)}****${code.slice(-4)}`;
}

async function ensureStoreFile() {
  await mkdir(dirname(DATA_FILE), { recursive: true });
  try {
    await readFile(DATA_FILE, 'utf8');
  } catch {
    await writeFile(DATA_FILE, `${JSON.stringify(DEFAULT_STORE, null, 2)}\n`, 'utf8');
  }
}

async function readStore() {
  await ensureStoreFile();
  return JSON.parse(await readFile(DATA_FILE, 'utf8'));
}

async function writeStore(store) {
  await writeFile(DATA_FILE, `${JSON.stringify(store, null, 2)}\n`, 'utf8');
}

async function parseJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString('utf8').trim();
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
    sub: user.sub,
    email: user.email,
    name: user.name || user.email,
    picture: user.picture || '',
  };
}

function resolveEntitlements(store, userId) {
  const boundLicenses = Object.values(store.licenses).filter(
    (license) =>
      license.boundUserId === userId &&
      license.status === 'active' &&
      (!license.expiresAt || new Date(license.expiresAt).getTime() > Date.now()),
  );

  const activeLicense = boundLicenses[0] || null;
  const plan = activeLicense?.plan === 'pro' ? 'pro' : 'free';

  return {
    plan,
    capabilities: plan === 'pro' ? [...PRO_CAPABILITIES] : [],
    expiresAt: activeLicense?.expiresAt || null,
    lastSyncedAt: new Date().toISOString(),
    license: activeLicense
      ? {
          status: activeLicense.status,
          type: activeLicense.type || 'unknown',
          codeMasked: maskCode(activeLicense.code),
        }
      : {
          status: 'none',
          type: 'unknown',
        },
  };
}

async function handleEntitlements(req) {
  const user = await getGoogleUser(req);
  const store = await readStore();

  store.users[user.sub] = {
    id: user.sub,
    email: user.email,
    name: user.name,
    picture: user.picture,
    lastSeenAt: new Date().toISOString(),
  };
  await writeStore(store);

  return json(resolveEntitlements(store, user.sub));
}

async function handleRedeem(req) {
  const user = await getGoogleUser(req);
  const { code } = await parseJsonBody(req);
  const normalizedCode = String(code || '').trim().toUpperCase();

  if (!normalizedCode) {
    return json({ error: 'License code is required.' }, 400);
  }

  const store = await readStore();
  const license = store.licenses[normalizedCode];

  if (!license) {
    return json({ error: 'License code is invalid.' }, 404);
  }

  if (license.status === 'expired' || (license.expiresAt && new Date(license.expiresAt).getTime() <= Date.now())) {
    return json({ error: 'License code has expired.' }, 409);
  }

  if (license.boundUserId && license.boundUserId !== user.sub) {
    return json({ error: 'License code is already bound to another account.' }, 409);
  }

  license.boundUserId = user.sub;
  license.status = 'active';
  license.redeemedAt = new Date().toISOString();

  store.users[user.sub] = {
    id: user.sub,
    email: user.email,
    name: user.name,
    picture: user.picture,
    lastSeenAt: new Date().toISOString(),
  };

  await writeStore(store);
  return json(resolveEntitlements(store, user.sub));
}

function notFound() {
  return json({ error: 'Not found.' }, 404);
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
      response = json({ ok: true, dataFile: DATA_FILE });
    } else if (req.method === 'GET' && url.pathname === '/api/ext/entitlements') {
      response = await handleEntitlements(req);
    } else if (req.method === 'POST' && url.pathname === '/api/ext/licenses/redeem') {
      response = await handleRedeem(req);
    } else {
      response = notFound();
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

await ensureStoreFile();
server.listen(PORT, '127.0.0.1', () => {
  console.log(`[stn-backend] listening on http://127.0.0.1:${PORT}`);
  console.log(`[stn-backend] data file: ${DATA_FILE}`);
  console.log('[stn-backend] demo redeem code: STN-PRO-DEMO-2026');
});
