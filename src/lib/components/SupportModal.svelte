<script lang="ts">
  import { t } from '@/lib/i18n';
  import { fade, scale } from 'svelte/transition';
  import alipayQr from '@/assets/alipay-qr.jpg';

  export let show = false;
  export let onClose: () => void;

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape' && show) {
      onClose();
    }
  }
</script>

<svelte:window on:keydown={handleKeydown}/>

{#if show}
  <div 
    class="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6"
    transition:fade={{ duration: 200 }}
  >
    <!-- Overlay -->
    <div 
      class="absolute inset-0 bg-[#1c160f]/40 backdrop-blur-sm"
      on:click={onClose}
      on:keydown={(e) => e.key === 'Enter' && onClose()}
      role="button"
      tabindex="-1"
      aria-label="Close modal"
    ></div>

    <!-- Modal Content -->
    <div 
      class="relative w-full max-w-md overflow-hidden rounded-[32px] bg-white shadow-2xl shadow-orange-900/20"
      transition:scale={{ duration: 300, start: 0.95, opacity: 0 }}
      on:click|stopPropagation
      on:keydown|stopPropagation
      role="dialog"
      aria-modal="true"
      tabindex="-1"
    >
      <div class="px-8 pt-10 pb-8">
        <div class="mb-6 flex flex-col items-center text-center">
          <div class="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-orange-50 text-orange-600">
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>
          </div>
          <h2 class="text-2xl font-bold tracking-tight text-[#1c160f]">{$t('support.title')}</h2>
          <p class="mt-3 text-sm leading-relaxed text-[#6d655e]">
            {$t('support.message')}
          </p>
        </div>

        <div class="relative mx-auto aspect-square w-full max-w-[240px] overflow-hidden rounded-2xl border-4 border-orange-50 bg-stone-50 shadow-inner group">
          <img 
            src={alipayQr} 
            alt="Alipay QR Code" 
            class="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
          />
          <div class="absolute inset-0 flex items-center justify-center bg-black/5 opacity-0 transition-opacity group-hover:opacity-100">
            <div class="rounded-full bg-white/90 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-orange-600 shadow-sm backdrop-blur-sm">
              Alipay / 支付宝
            </div>
          </div>
        </div>

        <div class="mt-10">
          <button
            on:click={onClose}
            class="group relative w-full overflow-hidden rounded-2xl bg-[#1c160f] py-4 text-sm font-bold text-white shadow-xl transition-all active:scale-[0.98] hover:bg-black"
          >
            <span class="relative z-10">{$t('support.close')}</span>
            <div class="absolute inset-0 translate-y-full bg-orange-600 transition-transform duration-300 group-hover:translate-y-0"></div>
          </button>
        </div>
      </div>
      
      <!-- Close icon -->
      <button 
        on:click={onClose}
        class="absolute top-6 right-6 p-2 text-stone-400 hover:text-stone-900 transition-colors"
        aria-label={$t('support.close')}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
  </div>
{/if}

<style>
  :global(body.modal-open) {
    overflow: hidden;
  }
</style>
