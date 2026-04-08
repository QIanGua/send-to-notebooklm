<script lang="ts">
  import { browser } from 'wxt/browser';
  import { t } from '@/lib/i18n';
  import type { NotebookSummary } from '@/lib/notebooks';
  import type { StatusTone } from '../types';

  export let notebooksLoading = false;
  export let notebooksError = '';
  export let filteredNotebooks: NotebookSummary[] = [];
  export let notebookSearch = '';
  export let defaultNotebookId = '';
  export let creatingNotebook = false;
  export let notebookStatus = '';
  export let notebookStatusTone: StatusTone = 'neutral';
  export let buildStatuses: Record<string, 'idle' | 'processing' | 'success' | 'error'> = {};

  export let onCreateNotebook: (urls?: string[]) => void | Promise<void>;
  export let onLoadNotebooks: () => void | Promise<void>;
  export let onSetDefaultNotebook: (notebookId: string) => void | Promise<void>;
  export let onBuildArtifact: (notebookId: string, type: string) => void | Promise<void>;
  export let onAddSource: (notebookId: string, urls: string[]) => void | Promise<void>;

  let quickImportUrl = '';
  let addingSourceToId = '';
  let addSourceUrl = '';

  function openNotebook(notebookId: string) {
    void browser.tabs.create({ url: `https://notebooklm.google.com/notebook/${notebookId}` });
  }
</script>

<header class="mb-8 border-b border-[#ebe5df] pb-5">
  <p class="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8e8882]">{$t('nav.tools')}</p>
  <h2 class="mt-1 text-3xl font-semibold tracking-tight text-[#17120d]">{$t('nav.notebooks')}</h2>
  <p class="mt-1 text-sm text-[#6d655e]">{$t('notebooks.description')}</p>
</header>

<section class="rounded-[28px] border border-[#ebe5df] bg-white p-6 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
  <div class="mb-6 flex flex-wrap items-center justify-between gap-4">
    <div class="relative w-full max-w-sm">
      <input
        type="text"
        bind:value={notebookSearch}
        placeholder={$t('notebooks.search')}
        class="w-full rounded-2xl border border-[#ddd6ce] bg-[#fcfaf7] px-4 py-2.5 text-sm text-[#17120d] outline-none transition focus:border-[#c2b4a5] focus:bg-white"
      />
    </div>
    <div class="flex flex-wrap items-center gap-3">
      <div class="relative min-w-[240px]">
        <input
          type="text"
          bind:value={quickImportUrl}
          placeholder={$t('notebooks.quickImportPlaceholder')}
          class="w-full rounded-2xl border border-[#ddd6ce] bg-white px-4 py-2.5 text-sm text-[#17120d] outline-none transition focus:border-[#c2b4a5]"
        />
      </div>
      <button
        on:click={onLoadNotebooks}
        class="rounded-2xl border border-[#ddd6ce] bg-white px-4 py-2.5 text-sm font-medium text-[#2a241f] transition hover:bg-[#f7f3ee]"
      >
        {$t('account.refresh')}
      </button>
      <button
        on:click={() => {
          onCreateNotebook(quickImportUrl ? [quickImportUrl] : []);
          quickImportUrl = '';
        }}
        disabled={creatingNotebook}
        class="rounded-2xl bg-[#2f2924] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#17120d] disabled:bg-[#b7aea4]"
      >
        {creatingNotebook ? $t('bulk.creating') : quickImportUrl ? $t('bulk.createAndImport') : $t('bulk.createNew')}
      </button>
    </div>
  </div>

  <div class="space-y-3">
    {#if notebooksLoading}
      <p class="py-12 text-center text-sm text-[#6d655e]">{$t('bulk.loadingNotebooks')}</p>
    {:else if notebooksError}
      <div class="py-12 text-center">
        <p class="mb-3 text-sm text-[#8b3a2b]">{$t('notebooks.error')}</p>
        <button on:click={onLoadNotebooks} class="rounded-xl border border-[#ddd6ce] px-4 py-2 text-sm font-medium text-[#2a241f] transition hover:bg-[#f7f3ee]">
          {$t('notebooks.retry')}
        </button>
      </div>
    {:else if filteredNotebooks.length === 0}
      <p class="py-12 text-center text-sm text-[#6d655e]">{$t('notebooks.noResults')}</p>
    {:else}
      {#each filteredNotebooks as notebook}
        <div class="group flex items-center justify-between gap-4 rounded-2xl border border-[#efe7de] bg-[#fcfaf7] p-4 transition-colors hover:border-[#e6ddd3] hover:bg-white">
          <div class="flex items-center gap-4 min-w-0">
            <div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[#efe7de] bg-white text-2xl shadow-sm">
              {notebook.emoji}
            </div>
            <div class="min-w-0">
              <div class="flex items-center gap-2">
                <h3 class="truncate text-sm font-semibold text-[#17120d]">{notebook.name}</h3>
                {#if notebook.id === defaultNotebookId}
                  <span class="rounded-full bg-[#f2efe9] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#8b6b4c]">
                    {$t('notebooks.default')}
                  </span>
                {/if}
              </div>
              <p class="mt-0.5 truncate text-[11px] font-medium text-[#8e8882]">{notebook.id}</p>
            </div>
          </div>

          <div class="flex items-center gap-2 shrink-0">
            <div class="mr-2 flex items-center gap-1 border-r border-[#e6ddd3] pr-4">
              <button
                on:click={() => onBuildArtifact?.(notebook.id, 'slide')}
                disabled={buildStatuses?.[`${notebook.id}:slide`] === 'processing'}
                title={$t('nav.slide')}
                class="relative flex items-center rounded-lg px-2 py-1.5 text-[11px] font-semibold text-[#8b6b4c] transition hover:bg-[#efe4d8] disabled:opacity-50"
              >
                <span class="mr-1">📊</span>
                {$t('nav.slide')}
                {#if buildStatuses?.[`${notebook.id}:slide`] === 'processing'}
                  <div class="ml-1.5 h-3 w-3 animate-spin rounded-full border-2 border-[#b79a79] border-t-transparent"></div>
                {:else if buildStatuses?.[`${notebook.id}:slide`] === 'success'}
                  <span class="ml-1 font-bold text-[#2f6b3f]">✓</span>
                {/if}
              </button>

              <button
                on:click={() => onBuildArtifact?.(notebook.id, 'infographic')}
                disabled={buildStatuses?.[`${notebook.id}:infographic`] === 'processing'}
                title={$t('nav.infographic')}
                class="relative flex items-center rounded-lg px-2 py-1.5 text-[11px] font-semibold text-[#8b6b4c] transition hover:bg-[#efe4d8] disabled:opacity-50"
              >
                <span class="mr-1">🎨</span>
                {$t('nav.infographic')}
                {#if buildStatuses?.[`${notebook.id}:infographic`] === 'processing'}
                  <div class="ml-1.5 h-3 w-3 animate-spin rounded-full border-2 border-[#b79a79] border-t-transparent"></div>
                {:else if buildStatuses?.[`${notebook.id}:infographic`] === 'success'}
                  <span class="ml-1 font-bold text-[#2f6b3f]">✓</span>
                {/if}
              </button>

              <button
                on:click={() => onBuildArtifact?.(notebook.id, 'report')}
                disabled={buildStatuses?.[`${notebook.id}:report`] === 'processing'}
                title={$t('nav.report')}
                class="relative flex items-center rounded-lg px-2 py-1.5 text-[11px] font-semibold text-[#8b6b4c] transition hover:bg-[#efe4d8] disabled:opacity-50"
              >
                <span class="mr-1">📄</span>
                {$t('nav.report')}
                {#if buildStatuses?.[`${notebook.id}:report`] === 'processing'}
                  <div class="ml-1.5 h-3 w-3 animate-spin rounded-full border-2 border-[#b79a79] border-t-transparent"></div>
                {:else if buildStatuses?.[`${notebook.id}:report`] === 'success'}
                  <span class="ml-1 font-bold text-[#2f6b3f]">✓</span>
                {/if}
              </button>

                <button
                  on:click={() => onBuildArtifact?.(notebook.id, 'video')}
                  disabled={buildStatuses?.[`${notebook.id}:video`] === 'processing'}
                  title={$t('nav.video')}
                  class="relative flex items-center rounded-lg px-2 py-1.5 text-[11px] font-semibold text-[#8b6b4c] transition hover:bg-[#efe4d8] disabled:opacity-50"
                >
                  <span class="mr-1">🎬</span>
                  {$t('nav.video')}
                  {#if buildStatuses?.[`${notebook.id}:video`] === 'processing'}
                    <div class="ml-1.5 h-3 w-3 animate-spin rounded-full border-2 border-[#b79a79] border-t-transparent"></div>
                  {:else if buildStatuses?.[`${notebook.id}:video`] === 'success'}
                    <span class="ml-1 font-bold text-[#2f6b3f]">✓</span>
                  {/if}
                </button>
              </div>

              <div class="flex items-center gap-2">
                {#if addingSourceToId === notebook.id}
                  <div class="flex items-center gap-2 animate-in slide-in-from-right-2 duration-200">
                    <input
                      type="text"
                      bind:value={addSourceUrl}
                      placeholder="https://..."
                      class="w-[180px] rounded-lg border border-[#ddd6ce] bg-white px-3 py-1.5 text-xs text-[#17120d] outline-none outline-none focus:border-[#c2b4a5]"
                      on:keydown={(e) => {
                        if (e.key === 'Enter') {
                          onAddSource(notebook.id, [addSourceUrl]);
                          addingSourceToId = '';
                          addSourceUrl = '';
                        } else if (e.key === 'Escape') {
                          addingSourceToId = '';
                          addSourceUrl = '';
                        }
                      }}
                    />
                    <button
                      on:click={() => {
                        onAddSource(notebook.id, [addSourceUrl]);
                        addingSourceToId = '';
                        addSourceUrl = '';
                      }}
                      disabled={!addSourceUrl}
                      class="rounded-lg bg-[#2f2924] px-3 py-1.5 text-xs font-medium text-white transition hover:bg-[#17120d] disabled:bg-[#b7aea4]"
                    >
                      {$t('bulk.import')}
                    </button>
                    <button
                      on:click={() => {
                        addingSourceToId = '';
                        addSourceUrl = '';
                      }}
                      class="rounded-lg border border-[#ddd6ce] bg-white px-2 py-1.5 text-xs font-medium text-[#2a241f] transition hover:bg-[#f7f3ee]"
                    >
                      ✕
                    </button>
                  </div>
                {:else}
                  <button
                    on:click={() => {
                      addingSourceToId = notebook.id;
                      addSourceUrl = '';
                    }}
                    title={$t('notebooks.addSource')}
                    class="relative flex items-center rounded-lg bg-[#f0edea] px-3 py-1.5 text-[11px] font-semibold text-[#8b6b4c] transition hover:bg-[#efe4d8] disabled:opacity-50"
                  >
                    <span class="mr-1">➕</span>
                    {$t('notebooks.addSource')}
                    {#if buildStatuses?.[`${notebook.id}:add-source`] === 'processing'}
                      <div class="ml-1.5 h-3 w-3 animate-spin rounded-full border-2 border-[#b79a79] border-t-transparent"></div>
                    {:else if buildStatuses?.[`${notebook.id}:add-source`] === 'success'}
                      <span class="ml-1 font-bold text-[#2f6b3f]">✓</span>
                    {/if}
                  </button>
                {/if}
              </div>

            <button
              on:click={() => onSetDefaultNotebook(notebook.id)}
              disabled={notebook.id === defaultNotebookId}
              class="rounded-xl border border-[#ddd6ce] bg-white px-3 py-1.5 text-xs font-medium text-[#2a241f] transition hover:bg-[#f7f3ee] disabled:opacity-50"
            >
              {$t('notebooks.setDefault')}
            </button>
            <button
              on:click={() => openNotebook(notebook.id)}
              class="rounded-xl bg-[#2f2924] px-3 py-1.5 text-xs font-medium text-white transition hover:bg-[#17120d]"
            >
              {$t('notebooks.open')}
            </button>
          </div>
        </div>
      {/each}
    {/if}
  </div>

  {#if notebookStatus}
    <p class={`mt-4 text-sm ${notebookStatusTone === 'error' ? 'text-[#8b3a2b]' : notebookStatusTone === 'success' ? 'text-[#2f6b3f]' : 'text-[#6d655e]'}`}>
      {notebookStatus}
    </p>
  {/if}
</section>
