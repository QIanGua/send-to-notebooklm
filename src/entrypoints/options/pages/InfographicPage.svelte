<script lang="ts">
  import type { Settings } from '@/lib/settings';

  export let settings: Settings;
  export let onSettingsChange: (delay?: number) => void | Promise<void>;

  const visualStyles = [
    { id: 'auto_select', name: 'Auto' },
    { id: 'sketch_note', name: 'Sketch' },
    { id: 'kawaii', name: 'Kawaii' },
    { id: 'professional', name: 'Pro' },
    { id: 'scientific', name: 'Science' },
    { id: 'anime', name: 'Anime' },
  ] as const;

  const detailLevels = [
    { id: 'concise', name: 'Concise' },
    { id: 'standard', name: 'Standard' },
    { id: 'detailed', name: 'Detailed' },
  ] as const;
</script>

<header class="mb-8 border-b border-[#ebe5df] pb-5">
  <p class="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8e8882]">Enhancer</p>
  <h2 class="mt-1 text-3xl font-semibold tracking-tight text-[#17120d]">Infographic</h2>
  <p class="mt-1 text-sm text-[#6d655e]">Define visual report defaults for richer NotebookLM outputs.</p>
</header>

<section class="rounded-[28px] border border-[#ebe5df] bg-white px-8 py-2 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
  <div class="flex items-start justify-between gap-12 border-b border-[#efebe6] py-6">
    <div class="flex-1">
      <h3 class="mb-1 text-sm font-semibold">Language</h3>
      <p class="text-xs text-[#6d655e]">Text language within visual charts.</p>
    </div>
    <select bind:value={settings.infographic.language} on:change={() => onSettingsChange(0)} class="min-w-[180px] rounded-2xl border border-[#ddd6ce] bg-white px-3 py-2 text-sm text-[#17120d] outline-none">
      <option value="zh">Chinese (Simplified)</option>
      <option value="en">English</option>
    </select>
  </div>
  <div class="border-b border-[#efebe6] py-6">
    <h3 class="mb-3 text-sm font-semibold">Visual Style</h3>
    <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
      {#each visualStyles as style}
        <button
          on:click={() => {
            settings.infographic.visualStyle = style.id;
            onSettingsChange(0);
          }}
          class={`rounded-2xl border p-3 text-left transition ${
            settings.infographic.visualStyle === style.id
              ? 'border-[#b79a79] bg-[#fcf5ec] text-[#6f5539]'
              : 'border-[#ebe5df] bg-[#fcfaf7] text-[#6d655e]'
          }`}
        >
          <span class="block text-[11px] font-semibold uppercase tracking-[0.14em]">{style.name}</span>
        </button>
      {/each}
    </div>
  </div>

  <div class="py-6">
    <h3 class="mb-3 text-sm font-semibold">Level of Detail</h3>
    <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {#each detailLevels as level}
        <button
          on:click={() => {
            settings.infographic.detailLevel = level.id;
            onSettingsChange(0);
          }}
          class={`rounded-2xl border p-4 text-left transition ${
            settings.infographic.detailLevel === level.id
              ? 'border-[#b79a79] bg-[#fcf5ec] text-[#6f5539]'
              : 'border-[#ebe5df] bg-[#fcfaf7] text-[#6d655e]'
          }`}
        >
          <span class="block text-sm font-semibold">{level.name}</span>
          <span class="mt-1 block text-xs text-inherit/80">
            {level.id === 'concise'
              ? 'Compact summaries with fewer sections.'
              : level.id === 'standard'
                ? 'Balanced depth for most infographic outputs.'
                : 'Richer breakdowns with more detail and coverage.'}
          </span>
        </button>
      {/each}
    </div>
  </div>
</section>
