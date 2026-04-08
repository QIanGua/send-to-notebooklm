<script lang="ts">
  import type { Settings } from '@/lib/settings';
  import { t } from '@/lib/i18n';

  export let settings: Settings;
  export let onSettingsChange: (delay?: number) => void | Promise<void>;
</script>

<header class="mb-8 border-b border-[#ebe5df] pb-5">
  <p class="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8e8882]">{$t('nav.enhancer')}</p>
  <h2 class="mt-1 text-3xl font-semibold tracking-tight text-[#17120d]">{$t('enhancer.video')}</h2>
  <p class="mt-1 text-sm text-[#6d655e]">{$t('enhancer.videoDescription')}</p>
</header>

<section class="rounded-[28px] border border-[#ebe5df] bg-white px-8 py-2 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
  <div class="flex items-start justify-between gap-12 border-b border-[#efebe6] py-6">
    <div class="flex-1">
      <h3 class="mb-1 text-sm font-semibold">{$t('enhancer.format')}</h3>
      <p class="text-xs text-[#6d655e]">Tone and pacing of the generated video overview.</p>
    </div>
    <select bind:value={settings.videoOverview.format} on:change={() => onSettingsChange(0)} class="min-w-[180px] rounded-2xl border border-[#ddd6ce] bg-white px-3 py-2 text-sm text-[#17120d] outline-none">
      <option value="cinematic">{$t('enhancer.videoCinematic')}</option>
      <option value="explainer">{$t('enhancer.videoExplainer')}</option>
      <option value="brief">{$t('enhancer.videoBrief')}</option>
    </select>
  </div>
  <div class="py-6">
    <h3 class="mb-2 text-sm font-semibold">{$t('enhancer.customPrompt')}</h3>
    <textarea bind:value={settings.videoOverview.customPrompt} on:input={() => onSettingsChange(400)} class="h-32 w-full rounded-2xl border border-[#ddd6ce] bg-[#fcfaf7] p-4 text-sm outline-none"></textarea>
  </div>
</section>
