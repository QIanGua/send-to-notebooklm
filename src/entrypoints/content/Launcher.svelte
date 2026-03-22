<script lang="ts">
  import { onMount } from 'svelte';
  import { locale, t, type Language } from '@/lib/i18n';
  import { browser } from 'wxt/browser';

  export let page: any;
  export let host: 'arxiv'|'youtube'|'default' = 'default';

  let panelOpen = false;
  let existingOpen = false;
  let notebooks: any[] = [];
  let selectedNotebookId = "";
  let status = { text: "", tone: "" };
  let isBusy = false;
  let storageListener: ((changes: Record<string, { newValue?: unknown }>, areaName: string) => void) | null = null;

  $: sourceUrl = page.arxiv?.pdfUrl || page.youtube?.videoUrl || page.canonicalUrl || page.url;
  $: currentSourceLabel = page.arxiv?.pdfUrl ? $t("type_pdf") : $t("type_video");

  onMount(() => {
    void (async () => {
      const saved = await browser.storage.local.get(["language", "selectedNotebookId"]);
      if (saved.language) $locale = saved.language as Language;
      selectedNotebookId = (saved.selectedNotebookId as string) || "";
    })();

    storageListener = (changes: Record<string, { newValue?: unknown }>, areaName: string) => {
      if (areaName !== "local") return;

      if (changes.language?.newValue) {
        $locale = changes.language.newValue as Language;
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

  async function createAndSend() {
    setStatus($t("status_importing_arxiv"));
    isBusy = true;
    try {
      const response: any = await browser.runtime.sendMessage({
        type: "create-notebook-and-send",
        urls: [sourceUrl]
      });
      if (!response.ok) throw new Error(response.error || $t("status_create_failed"));
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
    setStatus(page.arxiv?.pdfUrl ? $t("status_adding_arxiv") : $t("status_adding_youtube"));
    isBusy = true;
    try {
      const response: any = await browser.runtime.sendMessage({
        type: "send-to-notebook",
        notebookId: selectedNotebookId,
        urls: [sourceUrl]
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
        <div style="font-size: 7px; letter-spacing: 0.12em; text-transform: uppercase; color: rgba(194,101,45,0.5); font-weight: 800; line-height: 1;">{host === 'arxiv' ? 'arXiv' : host === 'youtube' ? 'YouTube' : $t('type_notebook')}</div>
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

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 10px;">
        <button 
          on:click={createAndSend}
          style="background: linear-gradient(135deg, #f97316, #ea580c); color: white; font-size: 12px; font-weight: 700; padding: 8px 0; border-radius: 12px; border: none; cursor: pointer; box-shadow: 0 4px 12px rgba(249,115,22,0.25);"
        >
          {$t("btn_create")}
        </button>
        <button 
          on:click={() => browser.runtime.sendMessage({ type: "open-notebooklm" })}
          style="background: white; border: 1px solid #e7e5e4; color: #57534e; font-size: 12px; font-weight: 700; padding: 8px 0; border-radius: 12px; cursor: pointer;"
        >
          {$t("btn_authorize")}
        </button>
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
