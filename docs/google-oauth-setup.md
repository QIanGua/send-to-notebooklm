# Google OAuth Setup For Chrome MV3

This project uses Chrome MV3 `identity` plus manifest `oauth2` to sign in a Google user inside the extension.

## What You Need

- A Google Cloud project
- A stable Chrome extension ID
- A Chrome Extension type OAuth client
- A local `.env.local` file with the OAuth client ID

## 1. Keep A Stable Extension ID

Chrome's official OAuth tutorial recommends keeping a consistent extension ID during development. A practical approach is:

1. Build the extension once.
2. Zip the extension and upload it to the Chrome Web Store developer dashboard as a draft item.
3. In the dashboard, open the item and copy the extension Item ID.
4. Make sure the extension you test in `chrome://extensions` uses the same ID before wiring Google OAuth.

Official references:

- [OAuth 2.0: authenticate users with Google](https://developer.chrome.com/docs/extensions/how-to/integrate/oauth)
- [Manifest - key](https://developer.chrome.com/docs/extensions/reference/manifest/key)
- [Manifest - oauth2](https://developer.chrome.com/docs/extensions/reference/manifest/oauth2)

### Important

For Chrome Extension OAuth clients, Google Cloud binds the client to the extension's Item ID. If your local extension ID differs, sign-in can fail even if the client ID looks valid.

## 2. Create The OAuth Client In Google Cloud Console

Use the Chrome Extension app type.

1. Open Google Cloud Console.
2. Create or choose a project.
3. Configure the OAuth consent screen if Google prompts you.
4. Create a new OAuth client.
5. Select `Chrome Extension` as the application type.
6. Enter a readable name, for example `Send to NotebookLM Chrome`.
7. Paste the extension Item ID into the `Item ID` field.
8. Create the client and copy the generated client ID.

Official reference:

- [OAuth 2.0: authenticate users with Google](https://developer.chrome.com/docs/extensions/how-to/integrate/oauth)

## 3. Redirect URI And Extension ID

For the current implementation, the extension uses `chrome.identity.getAuthToken`.

That means:

- You do not manually register a web redirect URI for the current sign-in flow.
- The important configuration is the Chrome Extension OAuth client plus the correct extension Item ID.

If you later switch to `launchWebAuthFlow` or a backend code exchange flow, then redirect handling becomes relevant. For the current flow, the extension ID is the main thing to get right.

Google's broader OpenID docs for web and backend flows are here:

- [Google OpenID Connect](https://developers.google.com/identity/openid-connect/openid-connect)

## 4. Scopes Used In This Project

This project requests:

- `openid`
- `email`
- `profile`

Google recommends using `sub` as the durable user identifier rather than email.

Official reference:

- [Google OpenID Connect](https://developers.google.com/identity/openid-connect/openid-connect)

## 5. Local Environment Configuration

Create a local env file:

```bash
cp .env.example .env.local
```

Then set:

```dotenv
WXT_GOOGLE_OAUTH_CLIENT_ID=your-chrome-extension-client-id.apps.googleusercontent.com
```

Notes:

- This value is safe to embed in the extension manifest, but local env files should still stay out of git.
- The current project reads this value from `wxt.config.ts`.

## 6. Build And Verify

After setting `.env.local`, rebuild:

```bash
npm run build
```

Then verify:

1. Open `.output/chrome-mv3/manifest.json`.
2. Confirm `oauth2.client_id` is your real client ID, not the placeholder.
3. Reload the unpacked extension from `.output/chrome-mv3`.
4. Test `Sign In with Google` again.

## 7. Common Failure Cases

### `bad client id`

Usually means one of these:

- The manifest still contains the placeholder client ID.
- The Google Cloud OAuth client was created as the wrong application type.
- The Item ID in Google Cloud does not match the extension ID actually loaded in Chrome.

### Login starts but fails immediately

Usually means:

- The OAuth consent screen is incomplete.
- The wrong Google Cloud project or client is being used.
- The extension ID changed between builds.

## 8. Current Project Wiring

Relevant files in this repo:

- [wxt.config.ts](/Users/qianlong/tries/2026-03-19-send-to-notebooklm/send-to-notebooklm/wxt.config.ts)
- [auth.ts](/Users/qianlong/tries/2026-03-19-send-to-notebooklm/send-to-notebooklm/src/lib/auth.ts)
- [App.svelte](/Users/qianlong/tries/2026-03-19-send-to-notebooklm/send-to-notebooklm/src/entrypoints/options/App.svelte)

The current implementation intentionally disables the sign-in button when the OAuth client ID is still the placeholder.
