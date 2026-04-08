<script lang="ts">
  import { t } from '@/lib/i18n';
  import type { NotebookSummary } from '@/lib/notebooks';
  import type { StatusTone, TabCandidate } from '../types';

  export let notebooks: NotebookSummary[] = [];
  export let notebooksLoading = false;
  export let notebooksError = '';
  export let selectedNotebookId = '';
  export let creatingNotebook = false;

  export let bulkImportModes: Array<{ id: string; label: string; badge?: string }> = [];
  export let bulkImportMode = 'links';
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
  export let onSelectBulkImportMode: (modeId: string) => void | Promise<void>;
  export let onLoadNotebooks: () => void | Promise<void>;
  export let onLoadBrowserTabs: () => void | Promise<void>;
  export let onToggleBrowserTab: (tabId: number) => void | Promise<void>;
  export let onSelectAllVisibleBrowserTabs: () => void | Promise<void>;
  export let onSelectCurrentBrowserTab: () => void | Promise<void>;
  export let onFetchPageLinks: () => void | Promise<void>;
  export let onFetchBilibiliPlaylistLinks: () => void | Promise<void>;
  export let bilibiliPlaylistUrl = '';
  export let bilibiliLinks: string[] = [];
  export let bilibiliLoading = false;
  export let bilibiliError = '';
  export let youtubePlaylistUrl = '';
  export let youtubeLinks: string[] = [];
  export let youtubeLoading = false;
  export let youtubeError = '';
  export let onFetchYoutubePlaylistLinks: () => void | Promise<void>;
</script>

<header class="mb-8 border-b border-[#ebe5df] pb-5">
  <p class="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8e8882]">{$t('nav.tools')}</p>
  <h2 class="mt-1 text-3xl font-semibold tracking-tight text-[#17120d]">{$t('bulk.title')}</h2>
  <p class="mt-1 text-sm text-[#6d655e]">{$t('bulk.description')}</p>
</header>

<section class="rounded-[28px] border border-[#ebe5df] bg-white p-6 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
  <div class="space-y-8">
    <div>
      <div class="mb-3 flex items-center justify-between gap-4">
        <h3 class="text-lg font-semibold text-[#17120d]">{$t('bulk.step1')}</h3>
        <button
          on:click={onCreateNotebook}
          disabled={creatingNotebook}
          class="rounded-2xl border border-[#ddd6ce] px-4 py-2 text-sm font-medium text-[#2a241f] transition hover:bg-[#f7f3ee] disabled:bg-[#f5f1eb]"
        >
          {creatingNotebook ? $t('bulk.creating') : $t('bulk.createNew')}
        </button>
      </div>

      <div class="rounded-2xl border border-[#e5ddd5] bg-[#fcfaf7] p-4">
        {#if notebooksLoading}
          <p class="text-sm text-[#6d655e]">{$t('bulk.loadingNotebooks')}</p>
        {:else if notebooksError}
          <div class="flex flex-wrap items-center gap-3">
            <p class="text-sm text-[#8b3a2b]">{notebooksError}</p>
            <button
              on:click={onLoadNotebooks}
              class="rounded-xl border border-[#ddd6ce] px-3 py-1.5 text-sm font-medium text-[#2a241f] transition hover:bg-white"
            >
              {$t('notebooks.retry')}
            </button>
          </div>
        {:else}
          <label class="block">
            <span class="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-[#8e8882]">{$t('bulk.targetNotebook')}</span>
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
        <h3 class="text-lg font-semibold text-[#17120d]">{$t('bulk.step2')}</h3>
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

      {#if bulkImportMode === 'links'}
        <div class="mt-4 rounded-2xl border border-[#e5ddd5] bg-[#fcfaf7] p-5">
          <label for="bulk-import-links" class="mb-3 block text-sm font-semibold text-[#2a241f]">{$t('bulk.enterLinks')}</label>
          <textarea
            id="bulk-import-links"
            bind:value={bulkImportInput}
            class="min-h-[220px] w-full rounded-2xl border border-[#ddd6ce] bg-white px-4 py-3 font-mono text-sm leading-6 text-[#2a241f] outline-none"
            placeholder={`https://example.com/page1\nhttps://example.com/page2`}
          ></textarea>

          <div class="mt-4 flex flex-wrap items-center justify-between gap-4">
            <div class="flex flex-wrap gap-2 text-sm text-[#6d655e]">
              <span class="rounded-full bg-white px-3 py-1">{$t('bulk.parsed')}: {parsedLinks.length}</span>
              <span class="rounded-full bg-white px-3 py-1">{$t('bulk.valid')}: {validLinks.length}</span>
              {#if invalidLinkCount > 0}
                <span class="rounded-full bg-[#fff1ed] px-3 py-1 text-[#8b3a2b]">{$t('bulk.invalid')}: {invalidLinkCount}</span>
              {/if}
            </div>

            <button
              on:click={onBulkImport}
              disabled={importUrls.length === 0 || bulkImporting}
              class="rounded-2xl bg-[#2f2924] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#17120d] disabled:cursor-not-allowed disabled:bg-[#b7aea4]"
            >
              {bulkImporting ? $t('bulk.importing') : (!selectedNotebookId && importUrls.length > 0) ? $t('bulk.createAndImportShort') : $t('bulk.import')}
            </button>
          </div>
        </div>
      {:else if bulkImportMode === 'tabs'}
        <div class="mt-4 rounded-2xl border border-[#e5ddd5] bg-[#fcfaf7] p-5">
          <div class="mb-4 flex items-center justify-between gap-4">
            <div>
              <h4 class="text-sm font-semibold text-[#2a241f]">{$t('bulk.tabs')}</h4>
              <p class="mt-1 text-sm text-[#6d655e]">Collect all HTTP(S) tabs in this window, or narrow it down to just the current active tab.</p>
            </div>
            <button
              on:click={onLoadBrowserTabs}
              class="rounded-2xl border border-[#ddd6ce] px-4 py-2 text-sm font-medium text-[#2a241f] transition hover:bg-white"
            >
              {$t('bulk.refreshTabs')}
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
              {$t('bulk.allTabs')}
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
              {$t('bulk.currentTab')}
            </button>
            <button
              on:click={onSelectAllVisibleBrowserTabs}
              disabled={visibleBrowserTabs.length === 0}
              class="rounded-full border border-[#ddd6ce] bg-white px-3 py-1.5 text-sm font-medium text-[#2a241f] transition hover:bg-[#f7f3ee] disabled:cursor-not-allowed disabled:bg-[#f5f1eb] disabled:text-[#9a938c]"
            >
              {$t('bulk.selectVisible')}
            </button>
            <button
              on:click={onSelectCurrentBrowserTab}
              disabled={currentTabId === null}
              class="rounded-full border border-[#ddd6ce] bg-white px-3 py-1.5 text-sm font-medium text-[#2a241f] transition hover:bg-[#f7f3ee] disabled:cursor-not-allowed disabled:bg-[#f5f1eb] disabled:text-[#9a938c]"
            >
              {$t('bulk.selectCurrent')}
            </button>
          </div>

          {#if tabsLoading}
            <p class="text-sm text-[#6d655e]">{$t('bulk.loadingTabs')}</p>
          {:else if tabsError}
            <p class="text-sm text-[#8b3a2b]">{tabsError}</p>
          {:else if browserTabs.length === 0}
            <p class="text-sm text-[#6d655e]">{$t('bulk.noTabsFound')}</p>
          {:else if visibleBrowserTabs.length === 0}
            <p class="text-sm text-[#6d655e]">{$t('bulk.noMatchFound')}</p>
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
                        <span class="rounded-full bg-[#efe4d8] px-2 py-0.5 text-[11px] font-semibold text-[#8b6b4c]">{$t('bulk.current')}</span>
                      {/if}
                      {#if currentWindowId !== null && tab.windowId === currentWindowId}
                        <span class="rounded-full bg-[#f2efe9] px-2 py-0.5 text-[11px] font-semibold text-[#6d655e]">{$t('bulk.thisWindow')}</span>
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
            </div>

            <button
              on:click={onBulkImport}
              disabled={importUrls.length === 0 || bulkImporting}
              class="rounded-2xl bg-[#2f2924] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#17120d] disabled:cursor-not-allowed disabled:bg-[#b7aea4]"
            >
              {bulkImporting ? $t('bulk.importing') : (!selectedNotebookId && importUrls.length > 0) ? $t('bulk.createAndImportShort') : $t('bulk.import')}
            </button>
          </div>
        </div>
      {:else if bulkImportMode === 'page-links'}
        <div class="mt-4 rounded-2xl border border-[#e5ddd5] bg-[#fcfaf7] p-5">
          <div class="mb-4 flex items-center justify-between gap-4">
            <div>
              <h4 class="text-sm font-semibold text-[#2a241f]">{$t('bulk.extractLinks')}</h4>
              <p class="mt-1 text-sm text-[#6d655e]">{$t('bulk.scanDescription')}</p>
            </div>
            <button
              on:click={onFetchPageLinks}
              disabled={!pageLinkSourceUrl || pageLinksLoading}
              class="rounded-2xl border border-[#ddd6ce] px-4 py-2 text-sm font-medium text-[#2a241f] transition hover:bg-white disabled:bg-[#f5f1eb]"
            >
              {pageLinksLoading ? $t('bulk.scanning') : $t('bulk.scanLinks')}
            </button>
          </div>

          <label class="block">
            <span class="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-[#8e8882]">{$t('bulk.sourceTab')}</span>
            <select
              bind:value={pageLinkSourceUrl}
              class="w-full rounded-2xl border border-[#ddd6ce] bg-white px-4 py-3 text-sm text-[#17120d] outline-none transition focus:border-[#c2b4a5]"
            >
              <option value="" disabled>{$t('bulk.selectTab')}</option>
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
              <span class="rounded-full bg-white px-3 py-1">Links found: {pageLinks.length}</span>
            </div>

            <button
              on:click={onBulkImport}
              disabled={importUrls.length === 0 || bulkImporting}
              class="rounded-2xl bg-[#2f2924] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#17120d] disabled:cursor-not-allowed disabled:bg-[#b7aea4]"
            >
              {bulkImporting ? $t('bulk.importing') : (!selectedNotebookId && importUrls.length > 0) ? $t('bulk.createAndImportShort') : $t('bulk.import')}
            </button>
          </div>
        </div>
      {:else if bulkImportMode === 'bilibili-playlist'}
        <div class="mt-4 rounded-2xl border border-[#e5ddd5] bg-[#fcfaf7] p-5">
          <div class="mb-4 flex items-center justify-between gap-4">
            <div>
              <h4 class="text-sm font-semibold text-[#2a241f]">{$t('bulk.bilibiliTitle')}</h4>
              <p class="mt-1 text-sm text-[#6d655e]">{$t('bulk.bilibiliDescription')}</p>
            </div>
            <button
              on:click={onFetchBilibiliPlaylistLinks}
              disabled={!bilibiliPlaylistUrl || bilibiliLoading}
              class="rounded-2xl border border-[#ddd6ce] px-4 py-2 text-sm font-medium text-[#2a241f] transition hover:bg-white disabled:bg-[#f5f1eb]"
            >
              {bilibiliLoading ? $t('bulk.scanning') : $t('bulk.scanPlaylist')}
            </button>
          </div>

          <label class="block">
            <span class="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-[#8e8882]">{$t('bulk.playlistUrl')}</span>
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
              <p class="px-1 text-xs font-medium text-[#8e8882]">{$t('bulk.videosFound', { count: bilibiliLinks.length })}:</p>
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
              <span class="rounded-full bg-white px-3 py-1">{$t('bulk.readyToImport')}: {bilibiliLinks.length}</span>
            </div>

            <button
              on:click={onBulkImport}
              disabled={bilibiliLinks.length === 0 || bulkImporting}
              class="rounded-2xl bg-[#2f2924] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#17120d] disabled:cursor-not-allowed disabled:bg-[#b7aea4]"
            >
              {bulkImporting ? $t('bulk.importing') : (!selectedNotebookId && bilibiliLinks.length > 0) ? $t('bulk.createAndImportShort') : $t('bulk.import')}
            </button>
          </div>
        </div>
      {:else if bulkImportMode === 'youtube-playlist'}
        <div class="mt-4 rounded-2xl border border-[#e5ddd5] bg-[#fcfaf7] p-5">
          <div class="mb-4 flex items-center justify-between gap-4">
            <div>
              <h4 class="text-sm font-semibold text-[#2a241f]">YouTube Playlist Import</h4>
              <p class="mt-1 text-sm text-[#6d655e]">Enter a YouTube playlist URL to extract all video links.</p>
            </div>
            <button
              on:click={onFetchYoutubePlaylistLinks}
              disabled={!youtubePlaylistUrl || youtubeLoading}
              class="rounded-2xl border border-[#ddd6ce] px-4 py-2 text-sm font-medium text-[#2a241f] transition hover:bg-white disabled:bg-[#f5f1eb]"
            >
              {youtubeLoading ? $t('bulk.scanning') : $t('bulk.scanPlaylist')}
            </button>
          </div>

          <label class="block">
            <span class="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-[#8e8882]">Playlist URL</span>
            <input
              type="text"
              bind:value={youtubePlaylistUrl}
              placeholder="https://www.youtube.com/playlist?list=PL..."
              class="w-full rounded-2xl border border-[#ddd6ce] bg-white px-4 py-3 text-sm text-[#17120d] outline-none transition focus:border-[#c2b4a5]"
            />
          </label>

          {#if youtubeError}
            <p class="mt-4 text-sm text-[#8b3a2b]">{youtubeError}</p>
          {/if}

          {#if youtubeLinks.length > 0}
            <div class="mt-4 space-y-2 rounded-2xl border border-[#e5ddd5] bg-white p-3">
              <p class="px-1 text-xs font-medium text-[#8e8882]">{$t('bulk.videosFound', { count: youtubeLinks.length })}:</p>
              {#each youtubeLinks.slice(0, 5) as link}
                <div class="truncate rounded-2xl border border-[#efe7de] bg-[#fcfaf7] px-4 py-2 text-xs text-[#2a241f]">
                  {link}
                </div>
              {/each}
              {#if youtubeLinks.length > 5}
                <p class="px-1 text-center text-xs text-[#6d655e]">... and {youtubeLinks.length - 5} more</p>
              {/if}
            </div>
          {/if}

          <div class="mt-4 flex flex-wrap items-center justify-between gap-4">
            <div class="flex flex-wrap gap-2 text-sm text-[#6d655e]">
              <span class="rounded-full bg-white px-3 py-1">{$t('bulk.readyToImport')}: {youtubeLinks.length}</span>
            </div>

            <button
              on:click={onBulkImport}
              disabled={youtubeLinks.length === 0 || bulkImporting}
              class="rounded-2xl bg-[#2f2924] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#17120d] disabled:cursor-not-allowed disabled:bg-[#b7aea4]"
            >
              {bulkImporting ? $t('bulk.importing') : (!selectedNotebookId && youtubeLinks.length > 0) ? $t('bulk.createAndImportShort') : $t('bulk.import')}
            </button>
          </div>
        </div>
      {:else}
        <div class="mt-4 rounded-2xl border border-dashed border-[#d8cec4] bg-white/80 px-6 py-8 text-center">
          <p class="text-sm font-semibold text-[#2a241f]">{$t('bulk.nextSource', { source: $t('bulk.rss') })}</p>
          <p class="mt-2 text-sm text-[#6d655e]">{$t('bulk.nextDescription')}</p>
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
