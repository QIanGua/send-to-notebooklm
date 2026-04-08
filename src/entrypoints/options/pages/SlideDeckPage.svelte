<script lang="ts">
  import type { Settings } from '@/lib/settings';
  import { t } from '@/lib/i18n';

  export let settings: Settings;
  export let onSettingsChange: (delay?: number) => void | Promise<void>;
</script>

<header class="mb-8 border-b border-[#ebe5df] pb-5">
  <p class="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8e8882]">{$t('nav.enhancer')}</p>
  <h2 class="mt-1 text-3xl font-semibold tracking-tight text-[#17120d]">{$t('enhancer.slideDeck')}</h2>
  <p class="mt-1 text-sm text-[#6d655e]">{$t('enhancer.slideDescription')}</p>
</header>

<section class="rounded-[28px] border border-[#ebe5df] bg-white px-8 py-2 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
  <div class="flex items-start justify-between gap-12 border-b border-[#efebe6] py-6">
    <div class="flex-1">
      <h3 class="mb-1 text-sm font-semibold">{$t('enhancer.format')}</h3>
      <p class="text-xs text-[#6d655e]">Choose the layout and detail density.</p>
    </div>
    <select bind:value={settings.slideDeck.format} on:change={() => onSettingsChange(0)} class="min-w-[180px] rounded-2xl border border-[#ddd6ce] bg-white px-3 py-2 text-sm text-[#17120d] outline-none">
      <option value="detailed_deck">{$t('enhancer.formatDetailed')}</option>
      <option value="presenter_slides">{$t('enhancer.formatPresenter')}</option>
    </select>
  </div>
  <div class="flex items-start justify-between gap-12 border-b border-[#efebe6] py-6">
    <div class="flex-1">
      <h3 class="mb-1 text-sm font-semibold">{$t('enhancer.contentLanguage')}</h3>
      <p class="text-xs text-[#6d655e]">Forces Slides to generate in a specific language.</p>
    </div>
    <select bind:value={settings.slideDeck.language} on:change={() => onSettingsChange(0)} class="min-w-[180px] rounded-2xl border border-[#ddd6ce] bg-white px-3 py-2 text-sm text-[#17120d] outline-none">
      <option value="zh">简体中文</option>
      <option value="en">English</option>
    </select>
  </div>
  <div class="flex items-start justify-between gap-12 py-6">
    <div class="flex-1">
      <h3 class="mb-1 text-sm font-semibold">{$t('enhancer.slideLength')}</h3>
      <p class="text-xs text-[#6d655e]">Total number of slides.</p>
    </div>
    <select bind:value={settings.slideDeck.length} on:change={() => onSettingsChange(0)} class="min-w-[180px] rounded-2xl border border-[#ddd6ce] bg-white px-3 py-2 text-sm text-[#17120d] outline-none">
      <option value="default">{$t('enhancer.lengthDefault')}</option>
      <option value="short">{$t('enhancer.lengthShort')}</option>
    </select>
  </div>
  <div class="py-6">
    <h3 class="mb-1 text-sm font-semibold">{$t('enhancer.customPrompt')}</h3>
    <p class="mb-3 text-xs text-[#6d655e]">{$t('enhancer.customPromptDescription')}</p>
    <textarea 
      bind:value={settings.slideDeck.customPrompt} 
      on:input={() => onSettingsChange(400)} 
      placeholder="e.g. Focus on executive summary and key technical takeaways..."
      class="h-32 w-full rounded-2xl border border-[#ddd6ce] bg-[#fcfaf7] p-4 text-sm outline-none transition focus:border-[#b79a79] focus:bg-white"
    ></textarea>
  </div>
</section>
