import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';
import { existsSync } from 'node:fs';

for (const envFile of ['.env.local', '.env']) {
  if (existsSync(envFile)) {
    process.loadEnvFile(envFile);
  }
}

// See https://wxt.dev/api/config.html
export default defineConfig({
  srcDir: 'src',
  modules: ['@wxt-dev/module-svelte'],
  manifest: {
    name: 'Send to NotebookLM',
    description: 'One-click capture for web pages, arXiv PDFs, and YouTube videos to NotebookLM.',
    version: '2.1.0',
    permissions: ['storage', 'contextMenus', 'tabs', 'identity'],
    host_permissions: [
      'https://notebooklm.google.com/*',
      'https://www.googleapis.com/*',
      'http://*/*',
      'https://*/*',
    ],
    oauth2: {
      client_id: process.env.WXT_GOOGLE_OAUTH_CLIENT_ID || 'REPLACE_WITH_GOOGLE_OAUTH_CLIENT_ID.apps.googleusercontent.com',
      scopes: ['openid', 'email', 'profile'],
    },
    icons: {
      16: 'icon/16.png',
      32: 'icon/32.png',
      48: 'icon/48.png',
      96: 'icon/96.png',
      128: 'icon/128.png',
    },
    action: {
      default_icon: {
        16: 'icon/16.png',
        32: 'icon/32.png',
        48: 'icon/48.png',
        128: 'icon/128.png',
      },
    },
    options_ui: {
      page: 'entrypoints/options/index.html',
      open_in_tab: true,
    },
    web_accessible_resources: [
      {
        resources: ['icon/*'],
        matches: ['*://*/*'],
      },
    ],
  },
  vite: () => ({
    plugins: [tailwindcss()],
  }),
});
