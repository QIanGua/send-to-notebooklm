<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from 'wxt/browser';
  import { createNotebook, fetchNotebooks, type NotebookSummary } from '@/lib/notebooks';
  import { getSettings, saveSettings, type Settings, DEFAULT_SETTINGS } from '@/lib/settings';
  import BulkImportPage from './pages/BulkImportPage.svelte';
  import NotebooksPage from './pages/NotebooksPage.svelte';
  import PodcastsPage from './pages/PodcastsPage.svelte';
  import ChatSettingsPage from './pages/ChatSettingsPage.svelte';
  import SlideDeckPage from './pages/SlideDeckPage.svelte';
  import InfographicPage from './pages/InfographicPage.svelte';
  import type { ActiveTab, StatusTone, TabCandidate } from './types';

  const toolLinks: Array<{ id: ActiveTab; label: string; badge?: string }> = [
    { id: 'bulk-import', label: 'Bulk Import' },
    { id: 'notebooks', label: 'Notebooks' },
    { id: 'podcasts', label: 'Podcasts', badge: 'Soon' },
  ];

  const enhancerLinks: Array<{ id: ActiveTab; label: string }> = [
    { id: 'chat', label: 'Configure Chat' },
    { id: 'slide', label: 'Slide Deck' },
    { id: 'infographic', label: 'Infographic' },
  ];

  const bulkImportModes: Array<{ id: string; label: string; badge?: string }> = [
    { id: 'links', label: 'Links' },
    { id: 'tabs', label: 'Browser Tabs', badge: 'Pro' },
    { id: 'page-links', label: 'Page Links', badge: 'Pro' },
    { id: 'youtube-playlist', label: 'YouTube Playlist', badge: 'Pro' },
    { id: 'rss-feed', label: 'RSS Feed', badge: 'Pro' },
  ];

  let settings: Settings = { ...DEFAULT_SETTINGS };
  let activeTab: ActiveTab = 'bulk-import';
  let saving = false;
  let savedMessage = 'Auto-save on';
  let autosaveTimer: ReturnType<typeof setTimeout> | null = null;
  let settingsReady = false;
  let lastSavedSettings = '';

  let notebooks: NotebookSummary[] = [];
  let notebooksLoading = false;
  let notebooksError = '';
  let selectedNotebookId = '';
  let defaultNotebookId = '';
  let notebookSearch = '';
  let creatingNotebook = false;

  let bulkImportMode = 'links';
  let bulkImportInput = '';
  let bulkImporting = false;
  let bulkImportStatus = '';
  let bulkImportStatusTone: StatusTone = 'neutral';
  let browserTabs: TabCandidate[] = [];
  let currentTabId: number | null = null;
  let currentWindowId: number | null = null;
  let tabsFilterMode: 'all' | 'current' = 'all';
  let selectedBrowserTabIds: number[] = [];
  let tabsLoading = false;
  let tabsError = '';
  let pageLinkSourceUrl = '';
  let pageLinks: string[] = [];
  let pageLinksLoading = false;
  let pageLinksError = '';
  let notebookStatus = '';
  let notebookStatusTone: StatusTone = 'neutral';

  $: filteredNotebooks = notebooks.filter((notebook) =>
    notebook.name.toLowerCase().includes(notebookSearch.trim().toLowerCase()),
  );

  $: parsedLinks = bulkImportInput
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  $: validLinks = parsedLinks.filter((line) => {
    try {
      const url = new URL(line);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
      return false;
    }
  });

  $: invalidLinkCount = parsedLinks.length - validLinks.length;
  $: visibleBrowserTabs =
    tabsFilterMode === 'current' && currentTabId !== null
      ? browserTabs.filter((tab) => tab.id === currentTabId)
      : browserTabs;
  $: selectedBrowserTabs = visibleBrowserTabs.filter((tab) => selectedBrowserTabIds.includes(tab.id));
  $: importUrls =
    bulkImportMode === 'links'
      ? validLinks
      : bulkImportMode === 'tabs'
        ? selectedBrowserTabs.map((tab) => tab.url)
        : bulkImportMode === 'page-links'
          ? pageLinks
        : [];

  onMount(async () => {
    const [loadedSettings, saved] = await Promise.all([
      getSettings(),
      browser.storage.local.get(['selectedNotebookId']),
    ]);

    settings = loadedSettings || { ...DEFAULT_SETTINGS };
    lastSavedSettings = JSON.stringify(settings);
    settingsReady = true;
    selectedNotebookId = (saved.selectedNotebookId as string) || '';
    defaultNotebookId = selectedNotebookId;
    await Promise.all([loadNotebooks(), loadBrowserTabs()]);
  });

  async function loadNotebooks() {
    notebooksLoading = true;
    notebooksError = '';

    try {
      notebooks = await fetchNotebooks();
      if (!selectedNotebookId && notebooks.length > 0) {
        selectedNotebookId = notebooks[0].id;
        defaultNotebookId ||= notebooks[0].id;
      }
    } catch (error) {
      notebooks = [];
      notebooksError = error instanceof Error ? error.message : 'Could not fetch notebooks.';
    } finally {
      notebooksLoading = false;
    }
  }

  async function persistSettings(statusText = 'Saved automatically') {
    saving = true;
    try {
      await saveSettings(settings);
      lastSavedSettings = JSON.stringify(settings);
      savedMessage = statusText;
      setTimeout(() => {
        if (!saving) {
          savedMessage = 'Auto-save on';
        }
      }, 2000);
    } finally {
      saving = false;
    }
  }

  function scheduleSettingsSave(delay = 250) {
    if (!settingsReady) return;

    const serialized = JSON.stringify(settings);
    if (serialized === lastSavedSettings) return;

    if (autosaveTimer) {
      clearTimeout(autosaveTimer);
    }

    savedMessage = 'Saving...';
    autosaveTimer = setTimeout(() => {
      autosaveTimer = null;
      void persistSettings();
    }, delay);
  }

  function handleSettingsChange(delay = 250) {
    scheduleSettingsSave(delay);
  }

  async function handleCreateNotebook() {
    creatingNotebook = true;
    try {
      const notebookId = await createNotebook();
      selectedNotebookId = notebookId;
      defaultNotebookId = notebookId;
      await browser.storage.local.set({ selectedNotebookId: notebookId });
      await loadNotebooks();
      bulkImportStatus = 'New notebook created and selected.';
      bulkImportStatusTone = 'success';
      notebookStatus = 'Notebook created and set as default.';
      notebookStatusTone = 'success';
    } catch (error) {
      bulkImportStatus = error instanceof Error ? error.message : 'Could not create notebook.';
      bulkImportStatusTone = 'error';
      notebookStatus = bulkImportStatus;
      notebookStatusTone = 'error';
    } finally {
      creatingNotebook = false;
    }
  }

  async function handleBulkImport() {
    if (!selectedNotebookId || importUrls.length === 0 || !['links', 'tabs', 'page-links'].includes(bulkImportMode)) return;

    bulkImporting = true;
    bulkImportStatus =
      bulkImportMode === 'tabs'
        ? 'Importing browser tabs...'
        : bulkImportMode === 'page-links'
          ? 'Importing page links...'
          : 'Importing links...';
    bulkImportStatusTone = 'neutral';

    try {
      const response = (await browser.runtime.sendMessage({
        type: 'send-to-notebook',
        notebookId: selectedNotebookId,
        urls: importUrls,
      })) as { ok?: boolean; error?: string; notebookUrl?: string };

      if (!response.ok) {
        throw new Error(response.error || 'Import failed.');
      }

      await browser.storage.local.set({ selectedNotebookId });
      defaultNotebookId = selectedNotebookId;
      bulkImportStatus = `Imported ${importUrls.length} source${importUrls.length > 1 ? 's' : ''}.`;
      bulkImportStatusTone = 'success';

      if (response.notebookUrl) {
        await browser.tabs.create({ url: response.notebookUrl });
      }
    } catch (error) {
      bulkImportStatus = error instanceof Error ? error.message : 'Import failed.';
      bulkImportStatusTone = 'error';
    } finally {
      bulkImporting = false;
    }
  }

  async function setDefaultNotebook(notebookId: string) {
    defaultNotebookId = notebookId;
    selectedNotebookId = notebookId;
    await browser.storage.local.set({ selectedNotebookId: notebookId });
    notebookStatus = 'Default notebook updated.';
    notebookStatusTone = 'success';
  }

  async function loadBrowserTabs() {
    tabsLoading = true;
    tabsError = '';

    try {
      const [currentActiveTab, tabs] = await Promise.all([
        browser.tabs.query({ active: true, currentWindow: true }),
        browser.tabs.query({}),
      ]);
      const seen = new Set<string>();
      currentTabId = currentActiveTab[0]?.id ?? null;
      currentWindowId = currentActiveTab[0]?.windowId ?? null;

      browserTabs = tabs
        .map((tab) => {
          const rawUrl = String(tab.url || '').trim();
          if (!rawUrl.startsWith('http://') && !rawUrl.startsWith('https://')) return null;

          try {
            const parsed = new URL(rawUrl);
            if (seen.has(parsed.href)) return null;
            seen.add(parsed.href);

            return {
              id: tab.id || 0,
              title: tab.title || parsed.hostname,
              url: parsed.href,
              hostname: parsed.hostname,
              windowId: tab.windowId || 0,
              isActive: Boolean(tab.active),
              isCurrentWindow: currentWindowId !== null && tab.windowId === currentWindowId,
            } satisfies TabCandidate;
          } catch {
            return null;
          }
        })
        .filter((tab): tab is TabCandidate => Boolean(tab));

      const visibleIds = new Set(visibleBrowserTabs.map((tab) => tab.id));
      selectedBrowserTabIds = selectedBrowserTabIds.filter((id) => visibleIds.has(id));

      if (selectedBrowserTabIds.length === 0) {
        selectedBrowserTabIds = currentTabId !== null ? [currentTabId] : browserTabs.slice(0, 1).map((tab) => tab.id);
      }

      if (!pageLinkSourceUrl || !browserTabs.some((tab) => tab.url === pageLinkSourceUrl)) {
        pageLinkSourceUrl = browserTabs[0]?.url || '';
      }
    } catch (error) {
      browserTabs = [];
      currentTabId = null;
      currentWindowId = null;
      selectedBrowserTabIds = [];
      tabsError = error instanceof Error ? error.message : 'Could not load browser tabs.';
    } finally {
      tabsLoading = false;
    }
  }

  function handleBulkImportModeChange(modeId: string) {
    bulkImportMode = modeId;
    if (modeId === 'tabs' && browserTabs.length === 0 && !tabsLoading) {
      void loadBrowserTabs();
    }
  }

  function toggleBrowserTab(tabId: number) {
    selectedBrowserTabIds = selectedBrowserTabIds.includes(tabId)
      ? selectedBrowserTabIds.filter((id) => id !== tabId)
      : [...selectedBrowserTabIds, tabId];
  }

  function selectAllVisibleBrowserTabs() {
    selectedBrowserTabIds = visibleBrowserTabs.map((tab) => tab.id);
  }

  function selectCurrentBrowserTab() {
    selectedBrowserTabIds = currentTabId !== null ? [currentTabId] : [];
    tabsFilterMode = 'current';
  }

  async function fetchPageLinksForSource() {
    if (!pageLinkSourceUrl) return;

    pageLinksLoading = true;
    pageLinksError = '';

    try {
      const response = (await browser.runtime.sendMessage({
        type: 'fetch-page-links',
        url: pageLinkSourceUrl,
      })) as { ok?: boolean; links?: string[]; error?: string };

      if (!response.ok) {
        throw new Error(response.error || 'Could not fetch page links.');
      }

      pageLinks = response.links || [];
      bulkImportStatus = pageLinks.length
        ? `Scanned page and found ${pageLinks.length} link${pageLinks.length > 1 ? 's' : ''}.`
        : 'Scanned page but found no importable links.';
      bulkImportStatusTone = pageLinks.length ? 'success' : 'neutral';
    } catch (error) {
      pageLinks = [];
      pageLinksError = error instanceof Error ? error.message : 'Could not fetch page links.';
      bulkImportStatus = pageLinksError;
      bulkImportStatusTone = 'error';
    } finally {
      pageLinksLoading = false;
    }
  }
</script>

<main class="flex min-h-screen w-full overflow-hidden bg-[#f4efe8] text-[#1c160f]">
  <aside class="flex w-[290px] flex-col border-r border-[#e6ddd3] bg-[#f7f2eb]">
    <div class="border-b border-[#e6ddd3] px-6 py-6">
      <div class="mb-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8e8882]">Send to NotebookLM</div>
      <h1 class="text-xl font-semibold tracking-tight text-[#17120d]">Workspace</h1>
      <p class="mt-2 text-sm text-[#6d655e]">Organize imports, manage notebooks, and keep your enhancer defaults in one place.</p>
    </div>

    <div class="flex-1 space-y-8 overflow-y-auto px-4 py-6">
      <div class="space-y-2">
        <h2 class="px-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8e8882]">Tools</h2>
        <nav class="space-y-1">
          {#each toolLinks as link}
            <button
              on:click={() => (activeTab = link.id)}
              class={`flex w-full items-center justify-between rounded-2xl px-3 py-2.5 text-left text-sm font-medium transition ${
                activeTab === link.id ? 'bg-white text-[#17120d]' : 'text-[#514b45] hover:bg-white/70'
              }`}
            >
              <span>{link.label}</span>
              {#if link.badge}
                <span class="rounded-full border border-[#ddd6ce] bg-[#f8f4ef] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#8b6b4c]">
                  {link.badge}
                </span>
              {/if}
            </button>
          {/each}
        </nav>
      </div>

      <div class="space-y-2">
        <h2 class="px-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8e8882]">Enhancer</h2>
        <nav class="space-y-1">
          {#each enhancerLinks as link}
            <button
              on:click={() => (activeTab = link.id)}
              class={`flex w-full rounded-2xl px-3 py-2.5 text-left text-sm font-medium transition ${
                activeTab === link.id ? 'bg-white text-[#17120d]' : 'text-[#514b45] hover:bg-white/70'
              }`}
            >
              {link.label}
            </button>
          {/each}
        </nav>
      </div>
    </div>

    <div class="border-t border-[#e6ddd3] bg-[#f7f2eb] p-4">
      <div class="rounded-2xl border border-[#ddd6ce] bg-white px-4 py-3 text-sm font-medium text-[#6d655e]">
        {savedMessage}
      </div>
    </div>
  </aside>

  <section class="flex-1 overflow-y-auto">
    <div class="mx-auto max-w-[1180px] px-8 py-8">
      {#if activeTab === 'bulk-import'}
        <BulkImportPage
          {notebooks}
          {notebooksLoading}
          {notebooksError}
          bind:selectedNotebookId
          {creatingNotebook}
          {bulkImportModes}
          {bulkImportMode}
          bind:bulkImportInput
          {parsedLinks}
          {validLinks}
          {invalidLinkCount}
          {importUrls}
          {bulkImporting}
          {bulkImportStatus}
          {bulkImportStatusTone}
          {browserTabs}
          {visibleBrowserTabs}
          {currentTabId}
          {currentWindowId}
          {selectedBrowserTabIds}
          bind:tabsFilterMode
          {tabsLoading}
          {tabsError}
          bind:pageLinkSourceUrl
          {pageLinks}
          {pageLinksLoading}
          {pageLinksError}
          onSelectBulkImportMode={handleBulkImportModeChange}
          onCreateNotebook={handleCreateNotebook}
          onBulkImport={handleBulkImport}
          onLoadNotebooks={loadNotebooks}
          onLoadBrowserTabs={loadBrowserTabs}
          onToggleBrowserTab={toggleBrowserTab}
          onSelectAllVisibleBrowserTabs={selectAllVisibleBrowserTabs}
          onSelectCurrentBrowserTab={selectCurrentBrowserTab}
          onFetchPageLinks={fetchPageLinksForSource}
        />
      {:else if activeTab === 'notebooks'}
        <NotebooksPage
          {notebooksLoading}
          {notebooksError}
          {filteredNotebooks}
          bind:notebookSearch
          {defaultNotebookId}
          {creatingNotebook}
          {notebookStatus}
          {notebookStatusTone}
          onCreateNotebook={handleCreateNotebook}
          onLoadNotebooks={loadNotebooks}
          onSetDefaultNotebook={setDefaultNotebook}
        />
      {:else if activeTab === 'podcasts'}
        <PodcastsPage />
      {:else if activeTab === 'chat'}
        <ChatSettingsPage {settings} onSettingsChange={handleSettingsChange} />
      {:else if activeTab === 'slide'}
        <SlideDeckPage {settings} onSettingsChange={handleSettingsChange} />
      {:else if activeTab === 'infographic'}
        <InfographicPage {settings} onSettingsChange={handleSettingsChange} />
      {/if}
    </div>
  </section>
</main>
