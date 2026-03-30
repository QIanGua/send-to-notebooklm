<script lang="ts">
  import type { NotebookSummary } from '@/lib/notebooks';
  import type { AuthSession } from '@/lib/auth';
  import type { Capability } from '@/lib/entitlements';
  import type { StatusTone, TabCandidate } from '../types';

  export let notebooks: NotebookSummary[] = [];
  export let notebooksLoading = false;
  export let notebooksError = '';
  export let selectedNotebookId = '';
  export let creatingNotebook = false;

  export let bulkImportModes: Array<{ id: string; label: string; badge?: string; capability?: Capability }> = [];
  export let bulkImportMode = 'links';
  export let selectedImportMode: { id: string; label: string; badge?: string; capability?: Capability } = {
    id: 'links',
    label: 'Links',
  };
  export let selectedImportModeLocked = false;
  export let authSession: AuthSession | null = null;
  export let authLoading = false;
  export let authConfigured = true;
  export let bulkImportInput = '';
  export let parsedLinks: string[] = [];
  export let validLinks: string[] = [];
  export let invalidLinkCount = 0;
  export let importUrls: string[] = [];
  export let bulkImporting = false;
  export let bulkImportStatus = '';
  export let bulkImportStatusTone: StatusTone = 'neutral';

  export let browserTabs: TabCandidate[] = [];
  export let visibleBrowserTabs: TabCandidate[] = [];
  export let currentTabId: number | null = null;
  export let currentWindowId: number | null = null;
  export let selectedBrowserTabIds: number[] = [];
  export let tabsFilterMode: 'all' | 'current' = 'all';
  export let tabsLoading = false;
  export let tabsError = '';
  export let pageLinkSourceUrl = '';
  export let pageLinks: string[] = [];
  export let pageLinksLoading = false;
  export let pageLinksError = '';

  export let onCreateNotebook: () => void | Promise<void>;
  export let onBulkImport: () => void | Promise<void>;
  export let onGoogleSignIn: () => void | Promise<void>;
  export let onSelectBulkImportMode: (modeId: string) => void | Promise<void>;
  export let onLoadNotebooks: () => void | Promise<void>;
  export let onLoadBrowserTabs: () => void | Promise<void>;
  export let onToggleBrowserTab: (tabId: number) => void | Promise<void>;
  export let onSelectAllVisibleBrowserTabs: () => void | Promise<void>;
  export let onSelectCurrentBrowserTab: () => void | Promise<void>;
  export let onFetchPageLinks: () => void | Promise<void>;
  export let bilibiliPlaylistUrl = '';
  export let bilibiliLinks: string[] = [];
  export let bilibiliLoading = false;
  export let bilibiliError = '';
  export let onFetchBilibiliPlaylistLinks: () => void | Promise<void>;
</script>

<header class="mb-8 border-b border-[#ebe5df] pb-5">
  <p class="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8e8882]">Tools</p>
  <h2 class="mt-1 text-3xl font-semibold tracking-tight text-[#17120d]">Bulk Import</h2>
  <p class="mt-1 text-sm text-[#6d655e]">Import multiple sources into a NotebookLM notebook with room for Pro workflows like dedupe and routing.</p>
</header>

<section class="rounded-[28px] border border-[#ebe5df] bg-white p-6 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
  <div class="space-y-8">
    <div>
      <div class="mb-3 flex items-center justify-between gap-4">
        <h3 class="text-lg font-semibold text-[#17120d]">1. Choose a Notebook</h3>
        <button
          on:click={onCreateNotebook}
          disabled={creatingNotebook}
          class="rounded-2xl border border-[#ddd6ce] px-4 py-2 text-sm font-medium text-[#2a241f] transition hover:bg-[#f7f3ee] disabled:bg-[#f5f1eb]"
        >
          {creatingNotebook ? 'Creating…' : 'Create New Notebook'}
        </button>
      </div>

      <div class="rounded-2xl border border-[#e5ddd5] bg-[#fcfaf7] p-4">
        {#if notebooksLoading}
          <p class="text-sm text-[#6d655e]">Loading available notebooks...</p>
        {:else if notebooksError}
          <div class="flex flex-wrap items-center gap-3">
            <p class="text-sm text-[#8b3a2b]">{notebooksError}</p>
            <button
              on:click={onLoadNotebooks}
              class="rounded-xl border border-[#ddd6ce] px-3 py-1.5 text-sm font-medium text-[#2a241f] transition hover:bg-white"
            >
              Retry
            </button>
          </div>
        {:else}
          <label class="block">
            <span class="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-[#8e8882]">Target notebook</span>
            <select
              bind:value={selectedNotebookId}
              class="w-full rounded-2xl border border-[#ddd6ce] bg-white px-4 py-3 text-sm text-[#17120d] outline-none transition focus:border-[#c2b4a5]"
            >
              {#each notebooks as notebook}
                <option value={notebook.id}>{notebook.emoji} {notebook.name}</option>
              {/each}
            </select>
          </label>
        {/if}
      </div>
    </div>

    <div>
      <div class="mb-3 flex items-center justify-between gap-4">
        <h3 class="text-lg font-semibold text-[#17120d]">2. Add sources</h3>
        <p class="text-xs font-medium uppercase tracking-[0.14em] text-[#8e8882]">MVP: links first</p>
      </div>

      <div class="grid gap-2 rounded-2xl bg-[#f5f1eb] p-2 md:grid-cols-3 lg:grid-cols-6">
        {#each bulkImportModes as mode}
          <button
            on:click={() => onSelectBulkImportMode(mode.id)}
            class={`flex items-center justify-center gap-2 rounded-xl px-3 py-3 text-sm font-medium transition ${
              bulkImportMode === mode.id ? 'bg-white text-[#17120d]' : 'text-[#6d655e] hover:bg-white/60'
            }`}
          >
            <span>{mode.label}</span>
            {#if mode.badge}
              <span class="text-[11px] text-[#9a7c58]">{mode.badge}</span>
            {/if}
          </button>
        {/each}
      </div>

      {#if selectedImportModeLocked}
        <div class="mt-4 rounded-2xl border border-[#eadfd2] bg-[#fff8f1] p-5">
          <div class="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h4 class="text-sm font-semibold text-[#2a241f]">{selectedImportMode.label} is a Pro workflow</h4>
              <p class="mt-1 text-sm text-[#6d655e]">
                {#if authSession}
                  Your Google account is connected, but this workspace does not have an active Pro entitlement yet.
                {:else}
                  Sign in with Google first so we can attach Pro billing and entitlements to your account.
                {/if}
              </p>
            </div>
            {#if !authSession}
              <button
                on:click={onGoogleSignIn}
                disabled={authLoading || !authConfigured}
                class="rounded-2xl bg-[#2f2924] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#17120d] disabled:bg-[#b7aea4]"
              >
                {authLoading ? 'Signing in…' : authConfigured ? 'Sign In with Google' : 'Google Login Unavailable'}
              </button>
            {/if}
          </div>
          <p class={`mt-4 text-sm ${authConfigured ? 'text-[#8b6b4c]' : 'text-[#8b3a2b]'}`}>
            {#if authConfigured}
              Pro unlocks batch import, dedupe, routing, import history, and presets. Free single-source sending stays unchanged.
            {:else}
              This build is missing a Google OAuth client ID. Configure `WXT_GOOGLE_OAUTH_CLIENT_ID`, rebuild, and reload the extension before testing Pro sign-in.
            {/if}
          </p>
        </div>
      {:else if bulkImportMode === 'links'}
        <div class="mt-4 rounded-2xl border border-[#e5ddd5] bg-[#fcfaf7] p-5">
          <label for="bulk-import-links" class="mb-3 block text-sm font-semibold text-[#2a241f]">Enter links (one per line)</label>
          <textarea
            id="bulk-import-links"
            bind:value={bulkImportInput}
            class="min-h-[220px] w-full rounded-2xl border border-[#ddd6ce] bg-white px-4 py-3 font-mono text-sm leading-6 text-[#2a241f] outline-none"
            placeholder={`https://example.com/page1\nhttps://example.com/page2`}
          ></textarea>

          <div class="mt-4 flex flex-wrap items-center justify-between gap-4">
            <div class="flex flex-wrap gap-2 text-sm text-[#6d655e]">
              <span class="rounded-full bg-white px-3 py-1">Parsed: {parsedLinks.length}</span>
              <span class="rounded-full bg-white px-3 py-1">Valid: {validLinks.length}</span>
              {#if invalidLinkCount > 0}
                <span class="rounded-full bg-[#fff1ed] px-3 py-1 text-[#8b3a2b]">Invalid: {invalidLinkCount}</span>
              {/if}
            </div>

            <button
              on:click={onBulkImport}
              disabled={!selectedNotebookId || importUrls.length === 0 || bulkImporting}
              class="rounded-2xl bg-[#2f2924] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#17120d] disabled:cursor-not-allowed disabled:bg-[#b7aea4]"
            >
              {bulkImporting ? 'Importing…' : 'Import'}
            </button>
          </div>
        </div>
      {:else if bulkImportMode === 'tabs'}
        <div class="mt-4 rounded-2xl border border-[#e5ddd5] bg-[#fcfaf7] p-5">
          <div class="mb-4 flex items-center justify-between gap-4">
            <div>
              <h4 class="text-sm font-semibold text-[#2a241f]">Import from current browser window</h4>
              <p class="mt-1 text-sm text-[#6d655e]">Collect all HTTP(S) tabs in this window, or narrow it down to just the current active tab.</p>
            </div>
            <button
              on:click={onLoadBrowserTabs}
              class="rounded-2xl border border-[#ddd6ce] px-4 py-2 text-sm font-medium text-[#2a241f] transition hover:bg-white"
            >
              Refresh Tabs
            </button>
          </div>

          <div class="mb-4 flex flex-wrap items-center gap-2">
            <button
              on:click={() => (tabsFilterMode = 'all')}
              class={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
                tabsFilterMode === 'all'
                  ? 'bg-[#2f2924] text-white'
                  : 'border border-[#ddd6ce] bg-white text-[#2a241f] hover:bg-[#f7f3ee]'
              }`}
            >
              All tabs
            </button>
            <button
              on:click={() => (tabsFilterMode = 'current')}
              disabled={currentTabId === null}
              class={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
                tabsFilterMode === 'current'
                  ? 'bg-[#2f2924] text-white'
                  : 'border border-[#ddd6ce] bg-white text-[#2a241f] hover:bg-[#f7f3ee]'
              } disabled:cursor-not-allowed disabled:bg-[#f5f1eb] disabled:text-[#9a938c]`}
            >
              Current tab
            </button>
            <button
              on:click={onSelectAllVisibleBrowserTabs}
              disabled={visibleBrowserTabs.length === 0}
              class="rounded-full border border-[#ddd6ce] bg-white px-3 py-1.5 text-sm font-medium text-[#2a241f] transition hover:bg-[#f7f3ee] disabled:cursor-not-allowed disabled:bg-[#f5f1eb] disabled:text-[#9a938c]"
            >
              Select visible
            </button>
            <button
              on:click={onSelectCurrentBrowserTab}
              disabled={currentTabId === null}
              class="rounded-full border border-[#ddd6ce] bg-white px-3 py-1.5 text-sm font-medium text-[#2a241f] transition hover:bg-[#f7f3ee] disabled:cursor-not-allowed disabled:bg-[#f5f1eb] disabled:text-[#9a938c]"
            >
              Select current
            </button>
          </div>

          {#if tabsLoading}
            <p class="text-sm text-[#6d655e]">Loading browser tabs...</p>
          {:else if tabsError}
            <p class="text-sm text-[#8b3a2b]">{tabsError}</p>
          {:else if browserTabs.length === 0}
            <p class="text-sm text-[#6d655e]">No importable tabs found in the current window.</p>
          {:else if visibleBrowserTabs.length === 0}
            <p class="text-sm text-[#6d655e]">No tabs match the current filter.</p>
          {:else}
            <div class="space-y-2 rounded-2xl border border-[#e5ddd5] bg-white p-3">
              {#each visibleBrowserTabs as tab}
                <label class="flex cursor-pointer items-start gap-3 rounded-2xl border border-[#efe7de] bg-[#fcfaf7] px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selectedBrowserTabIds.includes(tab.id)}
                    on:change={() => onToggleBrowserTab(tab.id)}
                    class="mt-1 h-4 w-4 rounded border-[#c9bfb4] text-[#2f2924] focus:ring-[#c2b4a5]"
                  />
                  <div class="min-w-0 flex-1">
                    <div class="flex flex-wrap items-center gap-2">
                      <div class="truncate text-sm font-medium text-[#17120d]">{tab.title}</div>
                      {#if tab.id === currentTabId}
                        <span class="rounded-full bg-[#efe4d8] px-2 py-0.5 text-[11px] font-semibold text-[#8b6b4c]">Current</span>
                      {/if}
                      {#if currentWindowId !== null && tab.windowId === currentWindowId}
                        <span class="rounded-full bg-[#f2efe9] px-2 py-0.5 text-[11px] font-semibold text-[#6d655e]">This window</span>
                      {/if}
                    </div>
                    <div class="mt-1 text-xs text-[#8e8882]">{tab.hostname}</div>
                    <div class="mt-1 truncate text-xs text-[#a19890]">{tab.url}</div>
                  </div>
                </label>
              {/each}
            </div>
          {/if}

          <div class="mt-4 flex flex-wrap items-center justify-between gap-4">
            <div class="flex flex-wrap gap-2 text-sm text-[#6d655e]">
              <span class="rounded-full bg-white px-3 py-1">Tabs: {browserTabs.length}</span>
              <span class="rounded-full bg-white px-3 py-1">Visible: {visibleBrowserTabs.length}</span>
              <span class="rounded-full bg-white px-3 py-1">Selected: {selectedBrowserTabIds.length}</span>
              <span class="rounded-full bg-white px-3 py-1">Ready: {importUrls.length}</span>
            </div>

            <button
              on:click={onBulkImport}
              disabled={!selectedNotebookId || importUrls.length === 0 || bulkImporting}
              class="rounded-2xl bg-[#2f2924] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#17120d] disabled:cursor-not-allowed disabled:bg-[#b7aea4]"
            >
              {bulkImporting ? 'Importing…' : 'Import Tabs'}
            </button>
          </div>
        </div>
      {:else if bulkImportMode === 'page-links'}
        <div class="mt-4 rounded-2xl border border-[#e5ddd5] bg-[#fcfaf7] p-5">
          <div class="mb-4 flex items-center justify-between gap-4">
            <div>
              <h4 class="text-sm font-semibold text-[#2a241f]">Extract links from a page</h4>
              <p class="mt-1 text-sm text-[#6d655e]">Choose a source tab, scan its page HTML, and import the links you discover.</p>
            </div>
            <button
              on:click={onFetchPageLinks}
              disabled={!pageLinkSourceUrl || pageLinksLoading}
              class="rounded-2xl border border-[#ddd6ce] px-4 py-2 text-sm font-medium text-[#2a241f] transition hover:bg-white disabled:bg-[#f5f1eb]"
            >
              {pageLinksLoading ? 'Scanning…' : 'Scan Page Links'}
            </button>
          </div>

          <label class="block">
            <span class="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-[#8e8882]">Source tab</span>
            <select
              bind:value={pageLinkSourceUrl}
              class="w-full rounded-2xl border border-[#ddd6ce] bg-white px-4 py-3 text-sm text-[#17120d] outline-none transition focus:border-[#c2b4a5]"
            >
              <option value="" disabled>Select a tab</option>
              {#each browserTabs as tab}
                <option value={tab.url}>{tab.title} ({tab.hostname})</option>
              {/each}
            </select>
          </label>

          {#if pageLinksError}
            <p class="mt-4 text-sm text-[#8b3a2b]">{pageLinksError}</p>
          {/if}

          {#if pageLinks.length > 0}
            <div class="mt-4 space-y-2 rounded-2xl border border-[#e5ddd5] bg-white p-3">
              {#each pageLinks as link}
                <div class="truncate rounded-2xl border border-[#efe7de] bg-[#fcfaf7] px-4 py-3 text-sm text-[#2a241f]">
                  {link}
                </div>
              {/each}
            </div>
          {/if}

          <div class="mt-4 flex flex-wrap items-center justify-between gap-4">
            <div class="flex flex-wrap gap-2 text-sm text-[#6d655e]">
              <span class="rounded-full bg-white px-3 py-1">Source page: {pageLinkSourceUrl ? 'Selected' : 'None'}</span>
              <span class="rounded-full bg-white px-3 py-1">Links found: {pageLinks.length}</span>
            </div>

            <button
              on:click={onBulkImport}
              disabled={!selectedNotebookId || importUrls.length === 0 || bulkImporting}
              class="rounded-2xl bg-[#2f2924] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#17120d] disabled:cursor-not-allowed disabled:bg-[#b7aea4]"
            >
              {bulkImporting ? 'Importing…' : 'Import Links'}
            </button>
          </div>
        </div>
      {:else if bulkImportMode === 'bilibili-playlist'}
        <div class="mt-4 rounded-2xl border border-[#e5ddd5] bg-[#fcfaf7] p-5">
          <div class="mb-4 flex items-center justify-between gap-4">
            <div>
              <h4 class="text-sm font-semibold text-[#2a241f]">Bilibili Playlist Import</h4>
              <p class="mt-1 text-sm text-[#6d655e]">Enter a Bilibili Space List URL (Season/Series) to extract all video links.</p>
            </div>
            <button
              on:click={onFetchBilibiliPlaylistLinks}
              disabled={!bilibiliPlaylistUrl || bilibiliLoading}
              class="rounded-2xl border border-[#ddd6ce] px-4 py-2 text-sm font-medium text-[#2a241f] transition hover:bg-white disabled:bg-[#f5f1eb]"
            >
              {bilibiliLoading ? 'Scanning…' : 'Scan Playlist'}
            </button>
          </div>

          <label class="block">
            <span class="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-[#8e8882]">Playlist URL</span>
            <input
              type="text"
              bind:value={bilibiliPlaylistUrl}
              placeholder="https://space.bilibili.com/401005433/lists/864780?type=season"
              class="w-full rounded-2xl border border-[#ddd6ce] bg-white px-4 py-3 text-sm text-[#17120d] outline-none transition focus:border-[#c2b4a5]"
            />
          </label>

          {#if bilibiliError}
            <p class="mt-4 text-sm text-[#8b3a2b]">{bilibiliError}</p>
          {/if}

          {#if bilibiliLinks.length > 0}
            <div class="mt-4 space-y-2 rounded-2xl border border-[#e5ddd5] bg-white p-3">
              <p class="px-1 text-xs font-medium text-[#8e8882]">Discovered {bilibiliLinks.length} videos:</p>
              {#each bilibiliLinks.slice(0, 5) as link}
                <div class="truncate rounded-2xl border border-[#efe7de] bg-[#fcfaf7] px-4 py-2 text-xs text-[#2a241f]">
                  {link}
                </div>
              {/each}
              {#if bilibiliLinks.length > 5}
                <p class="px-1 text-center text-xs text-[#6d655e]">... and {bilibiliLinks.length - 5} more</p>
              {/if}
            </div>
          {/if}

          <div class="mt-4 flex flex-wrap items-center justify-between gap-4">
            <div class="flex flex-wrap gap-2 text-sm text-[#6d655e]">
              <span class="rounded-full bg-white px-3 py-1">Ready to import: {bilibiliLinks.length}</span>
            </div>

            <button
              on:click={onBulkImport}
              disabled={!selectedNotebookId || bilibiliLinks.length === 0 || bulkImporting}
              class="rounded-2xl bg-[#2f2924] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#17120d] disabled:cursor-not-allowed disabled:bg-[#b7aea4]"
            >
              {bulkImporting ? 'Importing…' : 'Import Bilibili Videos'}
            </button>
          </div>
        </div>
      {:else}
        <div class="mt-4 rounded-2xl border border-dashed border-[#d8cec4] bg-white/80 px-6 py-8 text-center">
          <p class="text-sm font-semibold text-[#2a241f]">{bulkImportMode === 'youtube-playlist' ? 'YouTube Playlist' : 'RSS Feed'} is the next import source.</p>
          <p class="mt-2 text-sm text-[#6d655e]">This source mode will plug into the same bulk import pipeline after dedupe, history, and routing are in place.</p>
        </div>
      {/if}

      {#if bulkImportStatus}
        <p class={`mt-4 text-sm ${bulkImportStatusTone === 'error' ? 'text-[#8b3a2b]' : bulkImportStatusTone === 'success' ? 'text-[#2f6b3f]' : 'text-[#6d655e]'}`}>
          {bulkImportStatus}
        </p>
      {/if}
    </div>
  </div>
</section>
