<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from 'wxt/browser';
  import { createNotebook, fetchNotebooks, type NotebookSummary } from '@/lib/notebooks';
  import { getSettings, saveSettings, type Settings, DEFAULT_SETTINGS } from '@/lib/settings';
  import { t, language as i18nLanguage } from '@/lib/i18n';
  import BulkImportPage from './pages/BulkImportPage.svelte';
  import NotebooksPage from './pages/NotebooksPage.svelte';
  import ChatSettingsPage from './pages/ChatSettingsPage.svelte';
  import SlideDeckPage from './pages/SlideDeckPage.svelte';
  import InfographicPage from './pages/InfographicPage.svelte';
  import ReportPage from './pages/ReportPage.svelte';
  import VideoOverviewPage from './pages/VideoOverviewPage.svelte';
  import GeneralSettingsPage from './pages/GeneralSettingsPage.svelte';
  import SupportModal from '@/lib/components/SupportModal.svelte';
  import type { ActiveTab, StatusTone, TabCandidate } from './types';

  $: toolLinks = [
    { id: 'bulk-import', label: $t('nav.bulkImport') },
    { id: 'notebooks', label: $t('nav.notebooks') },
    { id: 'settings', label: $t('nav.settings') }
  ] as Array<{ id: ActiveTab; label: string; badge?: string }>;

  $: enhancerLinks = [
    { id: 'chat', label: $t('nav.chat') },
    { id: 'slide', label: $t('nav.slide') },
    { id: 'infographic', label: $t('nav.infographic') },
    { id: 'report', label: $t('nav.report') },
    { id: 'video', label: $t('nav.video') },
  ] as Array<{ id: ActiveTab; label: string }>;

  $: bulkImportModes = [
    { id: 'links', label: $t('bulk.links') },
    { id: 'tabs', label: $t('bulk.tabs') },
    { id: 'page-links', label: $t('bulk.pageLinks') },
    { id: 'youtube-playlist', label: $t('bulk.youtube') },
    { id: 'bilibili-playlist', label: $t('bulk.bilibili') },
    { id: 'rss-feed', label: $t('bulk.rss') },
  ] as Array<{ id: string; label: string; badge?: string }>;

  let settings: Settings = { ...DEFAULT_SETTINGS };
  let activeTab: ActiveTab = 'bulk-import';
  let saving = false;
  let savedMessage = $t('status.autosaveOn');
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
  let bilibiliPlaylistUrl = '';
  let bilibiliLinks: string[] = [];
  let bilibiliLoading = false;
  let bilibiliError = '';
  let youtubePlaylistUrl = '';
  let youtubeLinks: string[] = [];
  let youtubeLoading = false;
  let youtubeError = '';
  let notebookStatus = '';
  let notebookStatusTone: StatusTone = 'neutral';

  let buildStatuses: Record<string, 'idle' | 'processing' | 'success' | 'error'> = {};
  let showSupportModal = false;

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
          : bulkImportMode === 'bilibili-playlist'
            ? bilibiliLinks
          : bulkImportMode === 'youtube-playlist'
            ? youtubeLinks
          : [];

  onMount(async () => {
    const [loadedSettings, saved] = await Promise.all([
      getSettings(),
      browser.storage.local.get(['selectedNotebookId']),
    ]);

    settings = loadedSettings || { ...DEFAULT_SETTINGS };
    i18nLanguage.set(settings.language);
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

  async function persistSettings(statusText? : string) {
    saving = true;
    try {
      await saveSettings(settings);
      lastSavedSettings = JSON.stringify(settings);
      savedMessage = statusText || $t('status.saved');
      setTimeout(() => {
        if (!saving) {
          savedMessage = $t('status.autosaveOn');
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

    savedMessage = $t('status.saving');
    autosaveTimer = setTimeout(() => {
      autosaveTimer = null;
      void persistSettings();
    }, delay);
  }

  function handleSettingsChange(delay = 250) {
    scheduleSettingsSave(delay);
  }

  async function handleCreateNotebook(urls?: string[]) {
    creatingNotebook = true;
    try {
      const { notebookId, notebookUrl } = await createNotebook(urls);
      selectedNotebookId = notebookId;
      defaultNotebookId = notebookId;
      await browser.storage.local.set({ selectedNotebookId: notebookId });
      await loadNotebooks();
      
      const isImporting = urls && urls.length > 0;
      bulkImportStatus = isImporting ? $t('bulk.importSuccess', { count: urls.length }) : $t('bulk.notebookCreated');
      bulkImportStatusTone = 'success';
      notebookStatus = isImporting ? $t('bulk.importSuccess', { count: urls.length }) : $t('bulk.notebookCreated');
      notebookStatusTone = 'success';

      if (notebookUrl) {
        await browser.tabs.create({ url: notebookUrl });
      }
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
    if (selectedImportModeLocked) return;
    const isBilibili = bulkImportMode === 'bilibili-playlist';
    if (importUrls.length === 0 || !['links', 'tabs', 'page-links', 'bilibili-playlist'].includes(bulkImportMode)) return;

    // If no notebook is selected, create a new one and import
    if (!selectedNotebookId) {
      await handleCreateNotebook(importUrls);
      return;
    }

    bulkImporting = true;
    bulkImportStatus =
      bulkImportMode === 'tabs'
        ? 'Importing browser tabs...'
        : bulkImportMode === 'page-links'
          ? 'Importing page links...'
          : isBilibili
            ? 'Importing Bilibili playlist...'
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

  async function handleFetchBilibiliPlaylistLinks() {
    if (!bilibiliPlaylistUrl) return;

    bilibiliLoading = true;
    bilibiliError = '';
    bilibiliLinks = [];

    try {
      const response = (await browser.runtime.sendMessage({
        type: 'fetch-bilibili-playlist-links',
        url: bilibiliPlaylistUrl,
      })) as { ok?: boolean; links?: string[]; error?: string };

      if (!response.ok) {
        throw new Error(response.error || 'Could not fetch Bilibili playlist.');
      }

      bilibiliLinks = response.links || [];
      bulkImportStatus = bilibiliLinks.length
        ? `Found ${bilibiliLinks.length} video${bilibiliLinks.length > 1 ? 's' : ''} in the playlist.`
        : 'Playlist is empty or could not be scanned.';
      bulkImportStatusTone = bilibiliLinks.length ? 'success' : 'neutral';
    } catch (error) {
      bilibiliLinks = [];
      bilibiliError = error instanceof Error ? error.message : 'Could not fetch Bilibili playlist.';
      bulkImportStatus = bilibiliError;
      bulkImportStatusTone = 'error';
    } finally {
      bilibiliLoading = false;
    }
  }

  async function handleFetchYoutubePlaylistLinks() {
    if (!youtubePlaylistUrl) return;

    youtubeLoading = true;
    youtubeError = '';
    youtubeLinks = [];

    try {
      const response = (await browser.runtime.sendMessage({
        type: 'fetch-youtube-playlist-links',
        url: youtubePlaylistUrl,
      })) as { ok?: boolean; links?: string[]; error?: string };

      if (!response.ok) {
        throw new Error(response.error || 'Could not fetch YouTube playlist.');
      }

      youtubeLinks = response.links || [];
      bulkImportStatus = youtubeLinks.length
        ? `Found ${youtubeLinks.length} video${youtubeLinks.length > 1 ? 's' : ''} in the playlist.`
        : 'Playlist is empty or could not be scanned.';
      bulkImportStatusTone = youtubeLinks.length ? 'success' : 'neutral';
    } catch (error) {
      youtubeLinks = [];
      youtubeError = error instanceof Error ? error.message : 'Could not fetch YouTube playlist.';
      bulkImportStatus = youtubeError;
      bulkImportStatusTone = 'error';
    } finally {
      youtubeLoading = false;
    }
  }

  async function handleAddSourceToNotebook(notebookId: string, urls: string[]) {
    if (urls.length === 0) return;

    const key = `${notebookId}:add-source`;
    buildStatuses[key] = 'processing';
    buildStatuses = { ...buildStatuses };

    try {
      const response = (await browser.runtime.sendMessage({
        type: 'send-to-notebook',
        notebookId,
        urls,
      })) as { ok?: boolean; error?: string; notebookUrl?: string };

      if (!response.ok) {
        throw new Error(response.error || 'Import failed.');
      }

      buildStatuses[key] = 'success';
      notebookStatus = $t('bulk.importSuccess', { count: urls.length });
      notebookStatusTone = 'success';
    } catch (error) {
      buildStatuses[key] = 'error';
      notebookStatus = error instanceof Error ? error.message : 'Import failed.';
      notebookStatusTone = 'error';
    } finally {
      buildStatuses = { ...buildStatuses };
    }
  }

  async function handleBuildArtifact(notebookId: string, type: string) {
    const key = `${notebookId}:${type}`;
    buildStatuses[key] = 'processing';
    buildStatuses = { ...buildStatuses };

    try {
      const response = await browser.runtime.sendMessage({
        type: 'start-background-build',
        notebookId,
        artifactType: type,
      }) as { ok: boolean; error?: string };

      if (!response.ok) {
        throw new Error(response.error);
      }
    } catch (error) {
      console.error('[STN] Build failed:', error);
      buildStatuses[key] = 'error';
      buildStatuses = { ...buildStatuses };
    }
  }

  onMount(() => {
    const listener = (message: any) => {
      if (message.type === 'build-status') {
        const { notebookId, artifactType, status } = message;
        const key = `${notebookId}:${artifactType}`;
        buildStatuses[key] = status;
        buildStatuses = { ...buildStatuses };
      }
    };
    browser.runtime.onMessage.addListener(listener);
    return () => browser.runtime.onMessage.removeListener(listener);
  });
</script>

<main class="flex min-h-screen w-full overflow-hidden bg-[#f4efe8] text-[#1c160f]">
  <aside class="flex w-[290px] shrink-0 flex-col border-r border-[#e6ddd3] bg-[#f7f2eb]">
    <div class="border-b border-[#e6ddd3] px-6 py-6">
      <div class="mb-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8e8882]">{$t('app.title')}</div>
      <h1 class="text-xl font-semibold tracking-tight text-[#17120d]">{$t('app.workspace')}</h1>
      <p class="mt-2 text-sm text-[#6d655e]">{$t('app.description')}</p>
    </div>

    <div class="flex-1 space-y-8 overflow-y-auto px-4 py-6">
      <div class="space-y-2">
        <h2 class="px-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8e8882]">{$t('nav.tools')}</h2>
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
        <h2 class="px-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8e8882]">{$t('nav.enhancer')}</h2>
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

      <div class="px-6 pb-20">
        <div class="inline-flex items-center gap-2 rounded-full bg-white/50 px-3 py-1.5 text-xs font-medium text-[#514b45] shadow-sm border border-[#e6ddd3]/50">
          <div class={`h-1.5 w-1.5 shrink-0 rounded-full ${saving ? 'animate-pulse bg-[#8b6b4c]' : 'bg-green-500'}`}></div>
          <span class="truncate">{savedMessage}</span>
        </div>
      </div>
    </aside>

  <section class="flex-1 overflow-y-auto relative">
    <!-- Redesigned Support Button -->
    <div class="absolute top-6 right-8 z-10">
      <button
        on:click={() => (showSupportModal = true)}
        class="group relative flex items-center gap-3 rounded-full bg-gradient-to-r from-orange-500 to-orange-600 px-7 py-3.5 text-sm font-bold text-white shadow-xl shadow-orange-200 transition-all active:scale-95 hover:from-orange-600 hover:to-orange-700 hover:shadow-orange-300"
      >
        <div class="pulse-ring absolute inset-0 rounded-full bg-orange-400 opacity-40"></div>
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor" class="relative z-10 transition-transform group-hover:scale-110"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
        <span class="relative z-10">{$t('support.title')}</span>
      </button>
    </div>

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
          bind:bilibiliPlaylistUrl
          {bilibiliLinks}
          {bilibiliLoading}
          {bilibiliError}
          bind:youtubePlaylistUrl
          {youtubeLinks}
          {youtubeLoading}
          {youtubeError}
          onSelectBulkImportMode={handleBulkImportModeChange}
          onCreateNotebook={handleCreateNotebook}
          onBulkImport={handleBulkImport}
          onLoadNotebooks={loadNotebooks}
          onLoadBrowserTabs={loadBrowserTabs}
          onToggleBrowserTab={toggleBrowserTab}
          onSelectAllVisibleBrowserTabs={selectAllVisibleBrowserTabs}
          onSelectCurrentBrowserTab={selectCurrentBrowserTab}
          onFetchPageLinks={fetchPageLinksForSource}
          onFetchBilibiliPlaylistLinks={handleFetchBilibiliPlaylistLinks}
          onFetchYoutubePlaylistLinks={handleFetchYoutubePlaylistLinks}
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
          onBuildArtifact={handleBuildArtifact}
          onAddSource={handleAddSourceToNotebook}
          {buildStatuses}
        />
      {:else if activeTab === 'chat'}
        <ChatSettingsPage {settings} onSettingsChange={handleSettingsChange} />
      {:else if activeTab === 'slide'}
        <SlideDeckPage {settings} onSettingsChange={handleSettingsChange} />
      {:else if activeTab === 'infographic'}
        <InfographicPage {settings} onSettingsChange={handleSettingsChange} />
      {:else if activeTab === 'report'}
        <ReportPage {settings} onSettingsChange={handleSettingsChange} />
      {:else if activeTab === 'video'}
        <VideoOverviewPage {settings} onSettingsChange={handleSettingsChange} />
      {:else if activeTab === 'settings'}
        <GeneralSettingsPage {settings} onSettingsChange={handleSettingsChange} />
      {/if}
    </div>
  </section>
</main>

<SupportModal bind:show={showSupportModal} onClose={() => (showSupportModal = false)} />

<style>
  @keyframes pulse-ring {
    0% { transform: scale(0.95); opacity: 0.5; }
    50% { transform: scale(1.05); opacity: 0.2; }
    100% { transform: scale(0.95); opacity: 0.5; }
  }

  .pulse-ring {
    animation: pulse-ring 3s cubic-bezier(0.4, 0, 0.6, 1) infinite;
  }
</style>
