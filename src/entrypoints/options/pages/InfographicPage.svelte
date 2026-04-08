<script lang="ts">
  import type { Settings } from '@/lib/settings';
  import { t } from '@/lib/i18n';

  export let settings: Settings;
  export let onSettingsChange: (delay?: number) => void | Promise<void>;
</script>

<header class="mb-8 border-b border-[#ebe5df] pb-5">
  <p class="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8e8882]">{$t('nav.enhancer')}</p>
  <h2 class="mt-1 text-3xl font-semibold tracking-tight text-[#17120d]">{$t('enhancer.infographic')}</h2>
  <p class="mt-1 text-sm text-[#6d655e]">{$t('enhancer.infoDescription')}</p>
</header>

<section class="rounded-[28px] border border-[#ebe5df] bg-white px-8 py-2 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
  <div class="flex items-start justify-between gap-12 border-b border-[#efebe6] py-6">
    <div class="flex-1">
      <h3 class="mb-1 text-sm font-semibold">{$t('enhancer.orientation')}</h3>
      <p class="text-xs text-[#6d655e]">Aspect ratio of the generated PNG.</p>
    </div>
    <select bind:value={settings.infographic.orientation} on:change={() => onSettingsChange(0)} class="min-w-[180px] rounded-2xl border border-[#ddd6ce] bg-white px-3 py-2 text-sm text-[#17120d] outline-none">
      <option value="landscape">{$t('enhancer.orientLandscape')}</option>
      <option value="portrait">{$t('enhancer.orientPortrait')}</option>
      <option value="square">{$t('enhancer.orientSquare')}</option>
    </select>
  </div>
  <div class="flex items-start justify-between gap-12 border-b border-[#efebe6] py-6">
    <div class="flex-1">
      <h3 class="mb-1 text-sm font-semibold">{$t('enhancer.visualStyle')}</h3>
      <p class="text-xs text-[#6d655e]">Art direction for data visualization.</p>
    </div>
    <select bind:value={settings.infographic.visualStyle} on:change={() => onSettingsChange(0)} class="min-w-[180px] rounded-2xl border border-[#ddd6ce] bg-white px-3 py-2 text-sm text-[#17120d] outline-none">
      <option value="auto_select">{$t('enhancer.styleAuto')}</option>
      <option value="sketch_note">{$t('enhancer.styleSketch')}</option>
      <option value="kawaii">{$t('enhancer.styleKawaii')}</option>
      <option value="professional">{$t('enhancer.styleProfessional')}</option>
      <option value="scientific">{$t('enhancer.styleScientific')}</option>
      <option value="anime">{$t('enhancer.styleAnime')}</option>
    </select>
  </div>
  <div class="flex items-start justify-between gap-12 py-6">
    <div class="flex-1">
      <h3 class="mb-1 text-sm font-semibold">{$t('enhancer.detailLevel')}</h3>
      <p class="text-xs text-[#6d655e]">Amount of text and nodes.</p>
    </div>
    <select bind:value={settings.infographic.detailLevel} on:change={() => onSettingsChange(0)} class="min-w-[180px] rounded-2xl border border-[#ddd6ce] bg-white px-3 py-2 text-sm text-[#17120d] outline-none">
      <option value="concise">{$t('enhancer.detailConcise')}</option>
      <option value="standard">{$t('enhancer.detailStandard')}</option>
      <option value="detailed">{$t('enhancer.detailDetailed')}</option>
    </select>
  </div>
  <div class="py-6">
    <h3 class="mb-1 text-sm font-semibold">{$t('enhancer.customPrompt')}</h3>
    <p class="mb-3 text-xs text-[#6d655e]">{$t('enhancer.customPromptDescription')}</p>
    <textarea 
      bind:value={settings.infographic.customPrompt} 
      on:input={() => onSettingsChange(400)} 
      placeholder="e.g. Focus on key visual takeaways, use specific color palettes..."
      class="h-32 w-full rounded-2xl border border-[#ddd6ce] bg-[#fcfaf7] p-4 text-sm outline-none transition focus:border-[#b79a79] focus:bg-white"
    ></textarea>
  </div>
</section>
