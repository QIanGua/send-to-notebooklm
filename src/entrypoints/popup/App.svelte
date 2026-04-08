<script lang="ts">
  import { onMount } from 'svelte';
  import { language, t, type Language } from '@/lib/i18n';
  import { getPreferredSourceUrl, isQuickImportPage } from '@/lib/page-context';
  import { browser } from 'wxt/browser';
  import SupportModal from '@/lib/components/SupportModal.svelte';

  // --- State ---
  let page: any = null;
  let notebooks: any[] = [];
  let selectedNotebookId = "";
  let sending = false;
  let showExistingNotebookPanel = false;
  let showSettings = false;
  let status = { text: "", tone: "" };
  let isBusy = false;
  let showSupportModal = false;

  // --- Computed ---
  $: localizedStatus = status.text;
  $: isQuickMode = isQuickImportPage(page);
  $: isArxivQuickMode = page?.site?.id === 'arxiv' && isQuickMode;
  $: isYoutubeQuickMode = page?.site?.id === 'youtube' && isQuickMode;
  $: isCustomQuickMode = isQuickMode && !isArxivQuickMode && !isYoutubeQuickMode;
  $: modeLabel = isArxivQuickMode
    ? $t('mode_arxiv_import')
    : isYoutubeQuickMode
      ? $t('mode_youtube_import')
      : isCustomQuickMode
        ? $t('mode_site_import', { site: page?.site?.displayName || $t('type_notebook') })
        : "";
  $: actionLabel = isQuickMode ? $t('label_create_new') : $t('label_send_ready');
  $: actionHint = isArxivQuickMode
    ? $t('hint_create_arxiv')
    : isYoutubeQuickMode
      ? $t('hint_create_youtube')
      : isCustomQuickMode
        ? $t('hint_create_site', { site: page?.site?.displayName || $t('type_notebook') })
        : $t('hint_send_url');
  $: btnLabel = isQuickMode ? $t('btn_create') : $t('btn_send_page');
  $: showOpenNotebookButton = status.tone === 'error';

  // --- Actions ---
  onMount(async () => {
    const saved = await browser.storage.local.get(["language", "selectedNotebookId"]);
    if (saved.language) language.set(saved.language as Language);
    selectedNotebookId = (saved.selectedNotebookId as string) || "";
    
    setStatus($t("status_loading"));
    try {
      await loadPageContext();
      if (!isQuickMode) {
        await loadNotebooks();
      } else {
        setStatus($t("status_ready"));
      }
      setStatus($t("status_ready"));
    } catch (e: any) {
      setStatus(e.message, "error");
    }
  });

  async function loadPageContext() {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    const response: any = await browser.runtime.sendMessage({
      type: "get-page-context",
      tabId: tab?.id
    });

    if (!response.ok) throw new Error(response.error || $t("status_fetch_failed"));
    page = response.page;
  }

  async function loadNotebooks() {
    isBusy = true;
    setStatus($t("status_fetching_notebooks"));
    try {
      const response: any = await browser.runtime.sendMessage({ type: "fetch-notebooks" });
      if (!response.ok) throw new Error(response.error || $t("status_fetch_failed"));
      
      notebooks = response.notebooks;
      if (!selectedNotebookId && notebooks.length > 0) {
        selectedNotebookId = notebooks[0].id;
      }
      setStatus(notebooks.length ? $t("status_choose_and_send") : $t("status_no_notebook_found"), "success");
    } catch (error: any) {
      notebooks = [];
      setStatus(error.message, "error");
    } finally {
      isBusy = false;
    }
  }

  async function createNotebookAndSelect() {
    isBusy = true;
    setStatus($t("status_creating_notebook"));
    try {
      const response: any = await browser.runtime.sendMessage({ type: "create-notebook" });
      if (!response.ok || !response.notebookId) throw new Error(response.error || $t("status_create_failed"));

      await loadNotebooks();
      selectedNotebookId = response.notebookId;
      await browser.storage.local.set({ selectedNotebookId });
      setStatus($t("status_new_notebook_selected"), "success");
    } catch (error: any) {
      setStatus(error.message, "error");
    } finally {
      isBusy = false;
    }
  }

  async function send() {
    if (sending) return;

    const targetUrl = getPreferredSourceUrl(page);

    if (!targetUrl) {
      setStatus($t("status_invalid_url"), "error");
      return;
    }

    sending = true;
    isBusy = true;
    setStatus(
      isArxivQuickMode
        ? $t("status_importing_arxiv")
        : isYoutubeQuickMode
          ? $t("status_importing_youtube")
          : isQuickMode
            ? $t("status_importing_source")
            : $t("status_sending"),
    );

    try {
      const response: any = isQuickMode
        ? await browser.runtime.sendMessage({ type: "create-notebook-and-send", urls: [targetUrl] })
        : await browser.runtime.sendMessage({ type: "send-to-notebook", notebookId: selectedNotebookId, urls: [targetUrl] });

      if (!response.ok) throw new Error(response.error || $t("status_send_failed"));

      setStatus($t("status_import_success"), "success");
      await browser.tabs.create({ url: response.notebookUrl });
      window.close();
    } catch (error: any) {
      setStatus(error.message, "error");
    } finally {
      sending = false;
      isBusy = false;
    }
  }

  async function addToExisting() {
    if (sending) return;
    const targetUrl = page?.site?.sourceUrl || "";
    if (!targetUrl || !selectedNotebookId) {
      setStatus($t("status_choose_existing"), "error");
      return;
    }

    sending = true;
    isBusy = true;
    setStatus(
      page?.site?.sourceKind === 'pdf'
        ? $t('status_adding_arxiv')
        : page?.site?.sourceKind === 'video'
          ? $t('status_adding_youtube')
          : $t('status_adding_source'),
    );

    try {
      const response: any = await browser.runtime.sendMessage({
        type: "send-to-notebook",
        notebookId: selectedNotebookId,
        urls: [targetUrl]
      });

      if (!response.ok) throw new Error(response.error || $t("status_send_failed"));
      setStatus(
        page?.site?.sourceKind === 'pdf'
          ? $t('status_add_success_arxiv')
          : page?.site?.sourceKind === 'video'
            ? $t('status_add_success_youtube')
            : $t('status_add_success_source'),
        "success",
      );
      await browser.tabs.create({ url: response.notebookUrl });
      window.close();
    } catch (error: any) {
      setStatus(error.message, "error");
    } finally {
      sending = false;
      isBusy = false;
    }
  }

  async function toggleExistingPanel() {
    showExistingNotebookPanel = !showExistingNotebookPanel;
    if (showExistingNotebookPanel && !notebooks.length) {
      await loadNotebooks();
    }
  }

  async function changeLanguage(e: Event) {
    const target = e.target as HTMLSelectElement;
    const lang = target.value as Language;
    language.set(lang);
    await browser.storage.local.set({ language: lang });
  }

  function setStatus(text: string, tone = "") {
    status = { text, tone };
  }

  function openNotebookLm() {
    browser.runtime.sendMessage({ type: "open-notebooklm" });
  }

  function handleNotebookChange(e: Event) {
    const target = e.target as HTMLSelectElement;
    selectedNotebookId = target.value;
    browser.storage.local.set({ selectedNotebookId });
    browser.runtime.sendMessage({ type: "save-selected-notebook", notebookId: selectedNotebookId });
  }

  function shortenUrl(url: string) {
    try {
      const parsed = new URL(url);
      return `${parsed.hostname}${parsed.pathname === "/" ? "" : parsed.pathname}`;
    } catch { return url; }
  }
</script>

<main class="w-[360px] min-h-[400px] bg-[#fffaf3] text-[#1c160f] p-4 flex flex-col gap-4 overflow-hidden relative">
  <!-- Header -->
  <header class="flex items-center justify-between">
    <div class="flex items-center gap-3">
      <div class="w-10 h-10 rounded-xl bg-white shadow-lg flex items-center justify-center overflow-hidden border border-orange-100">
        <img src={browser.runtime.getURL("/icon/48.png")} alt="Logo" class="w-8 h-8 object-contain" />
      </div>
      <div>
        <div class="text-[10px] uppercase tracking-widest font-bold text-orange-600/60 leading-none mb-1">{$t('hero_eyebrow')}</div>
        <h1 class="text-lg font-bold tracking-tight leading-none text-[#1c160f]">{$t('hero_title')}</h1>
      </div>
    </div>
    <div class="flex items-center gap-1">
      <button 
        on:click={() => browser.tabs.create({ url: browser.runtime.getURL('/options.html') })}
        class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-50 hover:bg-orange-100 text-orange-700 text-[11px] font-bold transition-all border border-orange-200/50"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.1a2 2 0 0 1-1-1.72v-.51a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
        {$t('settings_title')}
      </button>
    </div>
  </header>

  <!-- Removed small settings panel in favor of options page -->


  <!-- Page Info Card -->
  <div class="bg-white border border-stone-200/60 rounded-2xl p-4 shadow-sm relative group overflow-hidden">
    <div class="absolute top-0 right-0 p-3 opacity-0 group-hover:opacity-100 transition-opacity">
      <button
        on:click={() => page?.url && browser.tabs.create({ url: page.url })}
        aria-label={$t('btn_open')}
        title={$t('btn_open')}
        class="text-orange-500 hover:text-orange-600"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
      </button>
    </div>
    
    <div class="flex items-center gap-2 mb-2">
      <span class="px-2 py-0.5 rounded-full bg-stone-100 text-[10px] font-bold text-stone-500 uppercase tracking-tight">
        {$t('card_label_current')}
      </span>
      {#if modeLabel}
        <span class="px-2 py-0.5 rounded-full bg-orange-100 text-[10px] font-bold text-orange-600 uppercase tracking-tight animate-pulse">
          {modeLabel}
        </span>
      {/if}
    </div>

    <h2 class="text-sm font-bold truncate mb-1 pr-6">{page?.title || $t('page_title_loading')}</h2>
    <div class="text-[11px] text-stone-400 mb-2 truncate">
      {page?.byline ? `${page.byline}  ·  ` : ''}{shortenUrl(page?.canonicalUrl || page?.url || '')}
    </div>
    
    <p class="text-[11px] text-stone-600 line-clamp-2 leading-relaxed h-[32px]">
      {isArxivQuickMode
        ? $t('desc_arxiv', { url: shortenUrl(page.arxiv.pdfUrl) })
        : isYoutubeQuickMode
          ? $t('desc_youtube', { url: shortenUrl(page.youtube.videoUrl) })
          : isCustomQuickMode
            ? $t('desc_site_source', {
                site: page?.site?.displayName || $t('type_notebook'),
                url: shortenUrl(page?.site?.sourceUrl || ''),
              })
            : page?.description || $t('desc_default')}
    </p>

    {#if page?.selectedText}
      <div class="mt-3 p-3 bg-orange-50/50 border-l-2 border-orange-200 rounded-r-lg italic text-[11px] text-orange-950/70">
        “{page.selectedText.slice(0, 200)}{page.selectedText.length > 200 ? '...' : ''}”
      </div>
    {/if}
  </div>

  <!-- Selection / Action Section -->
  <div class="space-y-4">
    <!-- Target Selection -->
    {#if !isQuickMode}
      <div class="bg-white border border-stone-200/60 rounded-2xl p-4 shadow-sm">
        <div class="flex items-center justify-between mb-3">
          <span class="text-[10px] font-bold text-stone-500 uppercase tracking-tight">{$t('card_label_target')}</span>
          <button 
            on:click={loadNotebooks} 
            disabled={isBusy}
            aria-label={$t('btn_refresh')}
            title={$t('btn_refresh')}
            class="text-orange-500 hover:text-orange-600 p-1 rounded-full hover:bg-orange-50 transition-colors disabled:opacity-30"
          >
            <svg class="w-4 h-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><polyline points="21 3 21 8 16 8"/></svg>
          </button>
        </div>

        <div class="flex flex-col gap-2">
          <select 
            value={selectedNotebookId} 
            on:change={handleNotebookChange}
            disabled={isBusy}
            class="w-100% bg-stone-50 border border-stone-100 rounded-xl px-3 py-2 text-sm focus:bg-white focus:ring-2 focus:ring-orange-100 outline-none transition-all appearance-none cursor-pointer disabled:opacity-50"
          >
            {#if !notebooks.length}
              <option value="">{$t('no_notebooks')}</option>
            {/if}
            {#each notebooks as nb}
              <option value={nb.id}>{nb.emoji} {nb.name} ({nb.sources})</option>
            {/each}
          </select>

          <button 
            on:click={createNotebookAndSelect}
            disabled={isBusy}
            class="text-[11px] font-bold text-orange-600 hover:text-orange-700 flex items-center justify-center gap-1.5 py-1 disabled:opacity-30"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            {$t('btn_new_notebook')}
          </button>
        </div>
      </div>
    {:else}
      <!-- Quick Mode Add to Existing Toggle -->
      <div class="bg-white border border-stone-200/60 rounded-2xl p-4 shadow-sm">
        <div class="flex items-center justify-between mb-2">
          <span class="text-[10px] font-bold text-stone-500 uppercase tracking-tight">{$t('card_label_existing')}</span>
          <button 
            on:click={toggleExistingPanel}
            class="text-xs font-bold text-orange-600"
          >
            {showExistingNotebookPanel ? $t('btn_hide') : $t('btn_show')}
          </button>
        </div>

        {#if showExistingNotebookPanel}
          <div class="flex flex-col gap-3 animate-in fade-in slide-in-from-top-1">
            <div class="flex gap-2">
              <select 
                value={selectedNotebookId}
                on:change={handleNotebookChange}
                class="flex-1 bg-stone-50 border border-stone-100 rounded-xl px-3 py-2 text-xs focus:bg-white outline-none"
              >
                {#each notebooks as nb}
                  <option value={nb.id}>{nb.emoji} {nb.name}</option>
                {/each}
              </select>
              <button
                on:click={loadNotebooks}
                aria-label={$t('btn_refresh')}
                title={$t('btn_refresh')}
                class="p-2 bg-stone-100 rounded-xl"
              >
                <svg class="w-3 h-3" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><polyline points="21 3 21 8 16 8"/></svg>
              </button>
            </div>
            <button 
              on:click={addToExisting}
              disabled={isBusy}
              class="w-full py-2.5 rounded-xl bg-[#1c160f] text-white text-xs font-bold shadow-lg active:scale-95 transition-transform disabled:opacity-50"
            >
              {$t('btn_add')}
            </button>
          </div>
        {/if}
      </div>
    {/if}

    <!-- Main Action Panel -->
    <div class="flex flex-col gap-3">
      <div class="flex flex-col gap-1 items-center px-2">
        <div class="text-xs font-black tracking-tight text-stone-900 leading-none">{actionLabel}</div>
        <div class="text-[10px] text-stone-400 font-medium text-center">{actionHint}</div>
      </div>

      <button 
        on:click={send}
        disabled={isBusy || sending}
        class="w-full py-4 rounded-2xl bg-gradient-to-br from-orange-500 to-orange-700 text-white font-bold shadow-xl shadow-orange-300/40 hover:shadow-orange-400/50 active:scale-[0.98] transition-all disabled:opacity-50 disabled:scale-100 relative overflow-hidden group"
      >
        <span class="relative z-10 flex items-center justify-center gap-2">
          {#if sending}
            <svg class="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
          {/if}
          {btnLabel}
        </span>
        <div class="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
      </button>

      {#if showOpenNotebookButton}
        <button 
          on:click={openNotebookLm}
          class="text-[11px] font-bold text-orange-900/40 hover:text-orange-950 transition-colors py-1"
        >
          {$t('btn_open_notebooklm')}
        </button>
      {/if}
    </div>
  </div>

  <!-- Status Bar & Sponsors -->
  <footer class="mt-auto pt-4 flex flex-col items-center gap-3 border-t border-stone-200/40">
    <div class="flex items-center gap-2">
      <button 
        on:click={() => (showSupportModal = true)}
        title={$t('support.title')}
        class="group relative flex items-center justify-center p-2.5 rounded-full transition-all active:scale-95"
      >
        <div class="absolute inset-0 rounded-full bg-orange-400/20 animate-ping group-hover:bg-orange-400/30"></div>
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor" class="relative z-10 text-orange-500 transition-transform group-hover:scale-110 group-hover:text-orange-600"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
      </button>
      <button 
        on:click={() => (showSupportModal = true)}
        class="text-[11px] font-bold text-orange-600/80 hover:text-orange-600 transition-colors"
      >
        {$t('support.title')}
      </button>
    </div>

    <div class="flex items-center gap-2 px-3 py-1 rounded-full bg-stone-50 border border-stone-100 shadow-sm">
      {#if isBusy}
        <div class="flex space-x-1">
          <div class="w-1 h-1 bg-orange-400 rounded-full animate-bounce"></div>
          <div class="w-1 h-1 bg-orange-400 rounded-full animate-bounce [animation-delay:0.1s]"></div>
          <div class="w-1 h-1 bg-orange-400 rounded-full animate-bounce [animation-delay:0.2s]"></div>
        </div>
      {:else if status.tone === 'error'}
        <div class="w-2 h-2 bg-red-500 rounded-full"></div>
      {:else}
        <div class="w-2 h-2 bg-green-500 rounded-full shadow-[0_0_8px_rgba(34,197,94,0.4)]"></div>
      {/if}
      <span class="text-[10px] font-bold text-stone-500 max-w-[200px] truncate">{localizedStatus}</span>
    </div>
  </footer>
</main>

<SupportModal bind:show={showSupportModal} onClose={() => (showSupportModal = false)} />

<style>
  :global(body) {
    background-color: transparent;
  }
</style>
