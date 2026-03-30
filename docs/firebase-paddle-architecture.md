# Firebase + Paddle Architecture

This document describes the production-oriented monetization stack for this extension:

- Chrome extension identity through Google sign-in
- Firestore as the entitlement source of truth
- Paddle for subscription billing
- Paddle webhooks for entitlement state changes

## Recommended Topology

1. The extension signs in a Google user with `chrome.identity.getAuthToken`.
2. The extension sends the Google access token to your backend.
3. The backend resolves the Google user and upserts `users/{googleSub}` in Firestore.
4. The extension asks for `GET /api/ext/entitlements`.
5. The backend reads `entitlements/{googleSub}` and returns capabilities.
6. For upgrades, the extension opens a hosted billing page or checkout link powered by Paddle.
7. Paddle sends webhooks to your backend.
8. The backend updates `subscriptions/*` and `entitlements/{googleSub}` in Firestore.
9. The extension refreshes entitlements and unlocks Pro UI through `hasCapability(...)`.

## Firestore Collections

### `users/{googleSub}`

```json
{
  "googleSub": "1234567890",
  "email": "user@example.com",
  "name": "Alice",
  "picture": "https://...",
  "authProvider": "google",
  "createdAt": "server timestamp",
  "updatedAt": "2026-03-24T10:00:00.000Z",
  "lastSeenAt": "2026-03-24T10:00:00.000Z"
}
```

### `entitlements/{googleSub}`

```json
{
  "userId": "1234567890",
  "plan": "pro",
  "capabilities": [
    "batch_import",
    "dedupe",
    "auto_routing",
    "import_history",
    "presets"
  ],
  "source": "paddle",
  "status": "active",
  "expiresAt": "2026-04-24T00:00:00.000Z",
  "updatedAt": "2026-03-24T10:00:00.000Z",
  "license": {
    "status": "active",
    "type": "subscription"
  }
}
```

### `subscriptions/{paddleSubscriptionId}`

```json
{
  "subscriptionId": "sub_...",
  "userId": "1234567890",
  "customerId": "ctm_...",
  "status": "active",
  "priceId": "pri_...",
  "productId": "pro_...",
  "currentPeriodStartsAt": "2026-03-24T00:00:00.000Z",
  "currentPeriodEndsAt": "2026-04-24T00:00:00.000Z",
  "cancelAtPeriodEnd": false,
  "updatedAt": "2026-03-24T10:00:00.000Z"
}
```

### `licenses/{licenseCode}`

```json
{
  "code": "STN-PRO-XXXX-XXXX",
  "plan": "pro",
  "type": "lifetime",
  "status": "active",
  "boundUserId": "1234567890",
  "redeemedAt": "2026-03-24T10:00:00.000Z",
  "expiresAt": null
}
```

### `webhook_events/{eventId}`

```json
{
  "eventId": "evt_...",
  "source": "paddle",
  "eventType": "subscription.updated",
  "processed": true,
  "receivedAt": "2026-03-24T10:00:00.000Z"
}
```

## Paddle Webhook Flow

1. Paddle POSTs to `/api/paddle/webhook`
2. Read raw body
3. Verify `Paddle-Signature`
4. Check whether `event_id` has already been processed
5. Handle events like:
   - `subscription.created`
   - `subscription.updated`
   - `subscription.canceled`
   - `subscription.paused`
   - `subscription.resumed`
   - `subscription.past_due`
   - `transaction.completed`
6. Upsert `subscriptions/{subscriptionId}`
7. Update `entitlements/{googleSub}`
8. Mark `webhook_events/{eventId}` as processed

## Expected Paddle Custom Data

Your checkout flow should include a user identifier in Paddle custom data, ideally:

```json
{
  "googleSub": "1234567890"
}
```

The backend uses that field to map subscription changes back to Firestore users.

## Extension API Surface

The extension currently supports:

- `POST /api/ext/session`
- `GET /api/ext/entitlements`
- `POST /api/ext/licenses/redeem`
- `POST /api/ext/billing/checkout-link`
- `POST /api/ext/billing/portal-link`

## Reference Server

There is a server skeleton in:

- [backend/firebase-paddle-server.mjs](/Users/qianlong/tries/2026-03-19-send-to-notebooklm/send-to-notebooklm/backend/firebase-paddle-server.mjs)

It expects `firebase-admin` plus these environment variables:

- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`
- `PADDLE_WEBHOOK_SECRET`
- `PADDLE_CHECKOUT_URL`
- `PADDLE_CUSTOMER_PORTAL_URL`
- `STN_BACKEND_PORT`
