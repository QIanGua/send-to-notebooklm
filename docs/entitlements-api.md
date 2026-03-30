# Entitlements API Contract

This extension now supports:

- Google sign-in through `chrome.identity.getAuthToken`
- remote Pro entitlement sync
- license redemption
- short-lived offline cache for Pro capabilities

This repo includes a matching local Node implementation:

- [backend/minimal-entitlements-server.mjs](/Users/qianlong/tries/2026-03-19-send-to-notebooklm/send-to-notebooklm/backend/minimal-entitlements-server.mjs)

## Base URL

Configure:

```dotenv
WXT_API_BASE_URL=http://127.0.0.1:8788
```

The extension will call:

- `GET /api/ext/entitlements`
- `POST /api/ext/licenses/redeem`

For local testing, the bundled backend ships with a demo code:

- `STN-PRO-DEMO-2026`

## Authentication

The extension sends the Google OAuth access token as a bearer token:

```http
Authorization: Bearer <google-access-token>
```

Your backend should validate the Google identity from this token and map it to an internal user.

## GET /api/ext/entitlements

### Purpose

Return the current plan and capability set for the signed-in Google user.

### Response

```json
{
  "plan": "pro",
  "capabilities": [
    "batch_import",
    "dedupe",
    "auto_routing",
    "import_history",
    "presets"
  ],
  "expiresAt": "2026-04-01T00:00:00.000Z",
  "lastSyncedAt": "2026-03-23T12:00:00.000Z",
  "license": {
    "status": "active",
    "type": "lifetime",
    "codeMasked": "STN-PRO-****-9X2Q"
  }
}
```

### Notes

- `plan` should be `free` or `pro`
- `capabilities` should be explicit, even when `plan` is `pro`
- `expiresAt` is used as the local offline validity boundary
- when omitted, the extension defaults to a 48-hour offline grace window

## POST /api/ext/licenses/redeem

### Purpose

Bind a user-provided license code to the signed-in Google user and return the updated entitlement state.

### Request

```json
{
  "code": "STN-PRO-7K4M-92QX-ABCD"
}
```

### Response

Use the same payload shape as `GET /api/ext/entitlements`.

## Error Responses

Use an HTTP error status and one of these shapes:

```json
{
  "error": "License code is invalid."
}
```

or

```json
{
  "message": "License code is already bound to another account."
}
```

The extension will surface `error` first, then `message`.

## Capability Names

The current extension recognizes:

- `batch_import`
- `dedupe`
- `auto_routing`
- `import_history`
- `presets`

## Current Extension Files

- [api.ts](/Users/qianlong/tries/2026-03-19-send-to-notebooklm/send-to-notebooklm/src/lib/api.ts)
- [license.ts](/Users/qianlong/tries/2026-03-19-send-to-notebooklm/send-to-notebooklm/src/lib/license.ts)
- [entitlements.ts](/Users/qianlong/tries/2026-03-19-send-to-notebooklm/send-to-notebooklm/src/lib/entitlements.ts)
- [App.svelte](/Users/qianlong/tries/2026-03-19-send-to-notebooklm/send-to-notebooklm/src/entrypoints/options/App.svelte)

## Local Runbook

1. Start the backend:

```bash
npm run backend:dev
```

2. Set `.env.local`:

```dotenv
WXT_GOOGLE_OAUTH_CLIENT_ID=your-chrome-extension-client-id.apps.googleusercontent.com
WXT_API_BASE_URL=http://127.0.0.1:8788
```

3. Rebuild the extension:

```bash
npm run build
```

4. Reload `.output/chrome-mv3`

5. Sign in with Google and redeem:

```text
STN-PRO-DEMO-2026
```
