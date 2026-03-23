<script lang="ts">
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

  export let onCreateNotebook: () => void | Promise<void>;
  export let onLoadNotebooks: () => void | Promise<void>;
  export let onSetDefaultNotebook: (notebookId: string) => void | Promise<void>;
</script>

<header class="mb-8 border-b border-[#ebe5df] pb-5">
  <p class="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8e8882]">Tools</p>
  <h2 class="mt-1 text-3xl font-semibold tracking-tight text-[#17120d]">Notebooks</h2>
  <p class="mt-1 text-sm text-[#6d655e]">A lightweight notebook management view for search, quick open, and future metadata like routing and tags.</p>
</header>

<section class="space-y-5">
  <div class="flex flex-wrap items-center gap-3">
    <input
      bind:value={notebookSearch}
      type="search"
      placeholder="Search title..."
      class="min-w-[260px] flex-1 rounded-2xl border border-[#ddd6ce] bg-white px-4 py-3 text-sm text-[#17120d] outline-none"
    />
    <button class="rounded-2xl border border-dashed border-[#d8cec4] px-4 py-3 text-sm font-medium text-[#6d655e]">
      + tags
    </button>
    <button
      on:click={onLoadNotebooks}
      class="rounded-2xl border border-[#ddd6ce] bg-white px-4 py-3 text-sm font-medium text-[#2a241f] transition hover:bg-[#f7f3ee]"
    >
      Refresh
    </button>
    <button
      on:click={onCreateNotebook}
      disabled={creatingNotebook}
      class="rounded-2xl bg-[#2f2924] px-4 py-3 text-sm font-medium text-white transition hover:bg-[#17120d] disabled:bg-[#b7aea4]"
    >
      {creatingNotebook ? 'Creating…' : 'Create Notebook'}
    </button>
  </div>

  <div class="overflow-hidden rounded-[28px] border border-[#ebe5df] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
    <div class="grid grid-cols-[minmax(0,2.6fr)_110px_180px_180px] gap-4 border-b border-[#f0e9e2] bg-[#fcfaf7] px-6 py-4 text-sm font-semibold text-[#2a241f]">
      <div>Title</div>
      <div>Sources</div>
      <div>Workflow</div>
      <div>Actions</div>
    </div>

    {#if notebooksLoading}
      <div class="px-6 py-10 text-sm text-[#6d655e]">Loading notebooks...</div>
    {:else if notebooksError}
      <div class="px-6 py-10 text-sm text-[#8b3a2b]">{notebooksError}</div>
    {:else if filteredNotebooks.length === 0}
      <div class="px-6 py-10 text-sm text-[#6d655e]">No notebooks match the current query.</div>
    {:else}
      {#each filteredNotebooks as notebook}
        <div class="grid grid-cols-[minmax(0,2.6fr)_110px_180px_180px] gap-4 border-b border-[#f5f0ea] px-6 py-4 text-sm text-[#2a241f] last:border-b-0">
          <div class="min-w-0">
            <div class="truncate font-medium text-[#17120d]">{notebook.emoji} {notebook.name}</div>
            <div class="mt-1 text-xs text-[#8e8882]">
              {defaultNotebookId === notebook.id ? 'Default target notebook' : 'Ready for tags, routes, and import history'}
            </div>
          </div>
          <div class="flex items-center text-[#514b45]">{notebook.sources}</div>
          <div class="flex items-center gap-2">
            <span class="rounded-xl border border-[#e3d9ce] bg-[#fcfaf7] px-3 py-1.5 text-xs font-medium text-[#6d655e]">
              Preset
            </span>
            <span class="rounded-xl border border-[#e3d9ce] bg-[#fcfaf7] px-3 py-1.5 text-xs font-medium text-[#6d655e]">
              Route
            </span>
          </div>
          <div class="flex items-center gap-2">
            <button
              on:click={() => onSetDefaultNotebook(notebook.id)}
              class={`rounded-xl px-3 py-1.5 text-sm font-medium transition ${
                defaultNotebookId === notebook.id
                  ? 'bg-[#ede4d8] text-[#6f5539]'
                  : 'border border-[#ddd6ce] text-[#2a241f] hover:bg-[#f7f3ee]'
              }`}
            >
              {defaultNotebookId === notebook.id ? 'Default' : 'Set Default'}
            </button>
            <a
              href={`https://notebooklm.google.com/notebook/${notebook.id}`}
              target="_blank"
              rel="noreferrer"
              class="rounded-xl border border-[#ddd6ce] px-3 py-1.5 text-sm font-medium text-[#2a241f] transition hover:bg-[#f7f3ee]"
            >
              Open
            </a>
          </div>
        </div>
      {/each}
    {/if}
  </div>

  {#if notebookStatus}
    <p class={`text-sm ${notebookStatusTone === 'error' ? 'text-[#8b3a2b]' : notebookStatusTone === 'success' ? 'text-[#2f6b3f]' : 'text-[#6d655e]'}`}>
      {notebookStatus}
    </p>
  {/if}
</section>
