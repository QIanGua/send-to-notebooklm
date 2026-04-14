<script lang="ts">
  import { onMount } from 'svelte';
  import { language, t, type Language } from '@/lib/i18n';
  import { getImportBehavior, getPreferredSourceUrl, isQuickImportPage } from '@/lib/page-context';
  import { browser } from 'wxt/browser';

  export let page: any;
  export let host: string = 'default';

  let panelOpen = false;
  let existingOpen = false;
  let notebooks: any[] = [];
  let selectedNotebookId = "";
  let status = { text: "", tone: "" };
  let isBusy = false;
  let storageListener: ((changes: Record<string, { newValue?: unknown }>, areaName: string) => void) | null = null;

  $: sourceUrl = getPreferredSourceUrl(page);
  $: importBehavior = getImportBehavior(page);
  $: isPlaylist = page?.site?.pageType === 'playlist';
  $: importNote = importBehavior === 'video_source'
    ? $t('import_note_video')
    : (page?.site?.pageType === 'video' || page?.site?.pageType === 'playlist')
      ? $t('import_note_video_page')
      : '';
  $: currentSourceLabel = page?.site?.sourceKind === 'pdf'
    ? $t('type_pdf')
    : page?.site?.sourceKind === 'video'
      ? isPlaylist ? $t('type_playlist') : $t('type_video')
      : $t('type_notebook');
  $: siteLabel = page?.site?.displayName || (host === 'arxiv' ? 'arXiv' : host === 'youtube' ? 'YouTube' : $t('type_notebook'));
  $: showOpenNotebookButton = status.tone === 'error';

  onMount(() => {
    void (async () => {
      const saved = await browser.storage.local.get(["language", "selectedNotebookId"]);
      if (saved.language) language.set(saved.language as Language);
      selectedNotebookId = (saved.selectedNotebookId as string) || "";
      
      // Warmup tokens if on a supported page to reduce initial latency
      if (isQuickImportPage(page)) {
        browser.runtime.sendMessage({ type: "warmup-tokens" }).catch(() => {});
      }
    })();

    storageListener = (changes: Record<string, { newValue?: unknown }>, areaName: string) => {
      if (areaName !== "local") return;

      if (changes.language?.newValue) {
        language.set(changes.language.newValue as Language);
      }

      if (typeof changes.selectedNotebookId?.newValue === "string") {
        selectedNotebookId = changes.selectedNotebookId.newValue;
      }
    };

    browser.storage.onChanged.addListener(storageListener);

    return () => {
      if (storageListener) {
        browser.storage.onChanged.removeListener(storageListener);
      }
    };
  });

  async function loadNotebooks() {
    setStatus($t("status_fetching_notebooks"));
    try {
      const response: any = await browser.runtime.sendMessage({ type: "fetch-notebooks" });
      if (!response.ok) throw new Error(response.error || $t("status_fetch_failed"));
      notebooks = response.notebooks || [];
      // Restore saved selection or default to first notebook
      if (notebooks.length > 0) {
        const saved = await browser.storage.local.get("selectedNotebookId");
        const savedId = (saved.selectedNotebookId as string) || "";
        const found = notebooks.find((nb: any) => nb.id === savedId);
        selectedNotebookId = found ? savedId : notebooks[0].id;
      }
      setStatus(notebooks.length ? $t("status_ready") : $t("no_notebooks"));
    } catch (error: any) {
      setStatus(error.message, "error");
    }
  }

  async function togglePanel() {
    panelOpen = !panelOpen;
  }

  async function toggleExisting() {
    existingOpen = !existingOpen;
    if (existingOpen) await loadNotebooks();
  }
  
  async function getUrlsToImport(): Promise<string[]> {
    if (!isPlaylist) return [sourceUrl];
    
    setStatus($t("status_fetching_playlist"));
    const response: any = await browser.runtime.sendMessage({ 
      type: "fetch-bilibili-playlist-links", 
      url: sourceUrl 
    });
    
    if (!response.ok) throw new Error(response.error || "Failed to fetch playlist links");
    return response.links || [];
  }

  async function createAndSend() {
    setStatus(
      page?.site?.sourceKind === 'pdf'
        ? $t('status_importing_arxiv')
        : page?.site?.sourceKind === 'video'
          ? isPlaylist ? $t('status_fetching_playlist') : $t('status_importing_youtube')
          : $t('status_importing_source'),
    );
    isBusy = true;
    try {
      const urls = await getUrlsToImport();
      if (urls.length === 0) throw new Error("No videos found in this playlist.");
      
      // Phase 1: Create Notebook
      setStatus($t("status_creating_notebook"));
      const createResponse: any = await browser.runtime.sendMessage({ type: "create-notebook" });
      if (!createResponse.ok) throw new Error(createResponse.error || "Failed to create notebook");
      const notebookId = createResponse.notebookId;

      // Phase 2: Send to Notebook
      setStatus(
        page?.site?.sourceKind === 'pdf'
          ? $t('status_importing_arxiv')
          : page?.site?.sourceKind === 'video'
            ? isPlaylist ? $t('status_fetching_playlist') : $t('status_importing_youtube')
            : $t('status_importing_source'),
      );

      const response: any = await browser.runtime.sendMessage({
        type: "send-to-notebook",
        notebookId: notebookId,
        urls: urls
      });
      if (!response.ok) throw new Error(response.error || $t("status_send_failed"));
      setStatus($t("status_imported_opening"), "success");
      window.open(response.notebookUrl, "_blank", "noopener,noreferrer");
    } catch (error: any) {
      setStatus(error.message, "error");
    } finally {
      isBusy = false;
    }
  }

  async function addExisting() {
    if (!selectedNotebookId) {
      setStatus($t("status_choose_existing"), "error");
      return;
    }
    setStatus(
      page?.site?.sourceKind === 'pdf'
        ? $t('status_adding_arxiv')
        : page?.site?.sourceKind === 'video'
          ? isPlaylist ? $t('status_fetching_playlist') : $t('status_adding_youtube')
          : $t('status_adding_source'),
    );
    isBusy = true;
    try {
      const urls = await getUrlsToImport();
      if (urls.length === 0) throw new Error("No videos found in this playlist.");

      const response: any = await browser.runtime.sendMessage({
        type: "send-to-notebook",
        notebookId: selectedNotebookId,
        urls: urls
      });
      if (!response.ok) throw new Error(response.error || $t("status_send_failed"));
      setStatus($t("status_added_opening"), "success");
      window.open(response.notebookUrl, "_blank", "noopener,noreferrer");
    } catch (error: any) {
      setStatus(error.message, "error");
    } finally {
      isBusy = false;
    }
  }

  function setStatus(text: string, tone = "") {
    status = { text, tone };
  }
</script>

<div class="stn-launcher" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1c160f; display: inline-block; position: relative; vertical-align: middle; margin-left: 8px;">
  <div style="border: 1px solid rgba(53,37,18,0.12); border-radius: 999px; background: #fffaf3; box-shadow: 0 4px 14px rgba(67,44,12,0.08); padding: 3px; display: inline-flex; align-items: center; gap: 6px;">
    <div style="display: flex; align-items: center; gap: 6px; padding-left: 6px;">
      <div style="width: 20px; height: 20px; border-radius: 5px; overflow: hidden; background: white; box-shadow: 0 2px 6px rgba(0,0,0,0.12); flex-shrink: 0;">
        <img src={browser.runtime.getURL("/icon/48.png")} alt="" style="width: 100%; height: 100%; object-fit: contain; display: block;" />
      </div>
      <div>
        <div style="font-size: 7px; letter-spacing: 0.12em; text-transform: uppercase; color: rgba(194,101,45,0.5); font-weight: 800; line-height: 1;">{siteLabel}</div>
        <div style="font-size: 10px; font-weight: 700; line-height: 1.2; white-space: nowrap;">{$t('hero_title')}</div>
      </div>
    </div>
    
    <button 
      on:click={togglePanel}
      style="height: 26px; padding: 0 12px; border-radius: 999px; border: none; background: #1c160f; color: white; font-size: 11px; font-weight: 700; cursor: pointer; white-space: nowrap; flex-shrink: 0;"
    >
      {panelOpen ? $t("btn_hide") : $t("btn_save")}
    </button>
  </div>

  {#if panelOpen}
    <div style="position: absolute; z-index: 2147483647; top: 100%; margin-top: 10px; {host === 'youtube' ? 'right: 0;' : 'left: 0;'} width: 280px; background: linear-gradient(135deg, #fffdfa, #fff5e6); border: 1px solid rgba(255,165,0,0.15); border-radius: 20px; padding: 14px; box-shadow: 0 16px 30px rgba(67,44,12,0.18);">
      <p style="font-size: 11px; color: #78716c; margin: 0 0 12px; line-height: 1.4;">
        {$t("inline_hint", { type: currentSourceLabel })}
      </p>

      {#if importNote}
        <div style="margin-bottom: 12px; border: 1px solid #fcd34d; border-radius: 12px; background: #fffbeb; padding: 8px 10px; font-size: 11px; line-height: 1.4; color: #92400e;">
          {importNote}
        </div>
      {/if}

      <div style="display: grid; grid-template-columns: {showOpenNotebookButton ? '1fr 1fr' : '1fr'}; gap: 8px; margin-bottom: 10px;">
        <button 
          on:click={createAndSend}
          disabled={isBusy || !isQuickImportPage(page)}
          style="background: linear-gradient(135deg, #f97316, #ea580c); color: white; font-size: 12px; font-weight: 700; padding: 8px 0; border-radius: 12px; border: none; cursor: pointer; box-shadow: 0 4px 12px rgba(249,115,22,0.25);"
        >
          {$t("btn_create")}
        </button>
        {#if showOpenNotebookButton}
          <button 
            on:click={() => browser.runtime.sendMessage({ type: "open-notebooklm" })}
            style="background: white; border: 1px solid #e7e5e4; color: #57534e; font-size: 12px; font-weight: 700; padding: 8px 0; border-radius: 12px; cursor: pointer;"
          >
            {$t("btn_open_notebooklm")}
          </button>
        {/if}
      </div>

      <button 
        on:click={toggleExisting}
        style="width: 100%; background: #f5f5f4; color: #57534e; font-size: 11px; font-weight: 700; padding: 7px 0; border-radius: 12px; border: none; cursor: pointer; margin-bottom: 10px;"
      >
        {existingOpen ? $t("btn_hide_existing") : $t("btn_add_to_existing")}
      </button>

      {#if existingOpen}
        <div>
          <select 
            bind:value={selectedNotebookId}
            style="width: 100%; background: white; border: 1px solid rgba(255,165,0,0.15); border-radius: 12px; padding: 6px 10px; font-size: 12px; outline: none; margin-bottom: 8px; color: #1c160f;"
          >
            {#each notebooks as nb}
              <option value={nb.id}>{nb.emoji} {nb.name}</option>
            {/each}
          </select>
          <div style="display: flex; gap: 8px;">
             <button on:click={loadNotebooks} aria-label="Refresh" style="padding: 7px; background: #f5f5f4; border-radius: 12px; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center;">
              <svg style="width: 14px; height: 14px;" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><polyline points="21 3 21 8 16 8"/></svg>
            </button>
            <button 
              on:click={addExisting}
              disabled={isBusy || !selectedNotebookId}
              style="flex: 1; background: #1c160f; color: white; font-size: 12px; font-weight: 700; padding: 7px 0; border-radius: 12px; border: none; cursor: pointer;"
            >
              {$t("btn_add")}
            </button>
          </div>
        </div>
      {/if}

      {#if status.text}
        <div style="margin-top: 10px; font-size: 10px; font-weight: 700; text-align: center; color: {status.tone === 'error' ? '#ef4444' : '#a8a29e'};">
          {status.text}
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  :host {
    all: initial;
    display: inline-block;
  }
  * {
    box-sizing: border-box;
  }
</style>
