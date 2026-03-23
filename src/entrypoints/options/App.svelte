<script lang="ts">
  import { onMount } from 'svelte';
  import { getSettings, saveSettings, type Settings, DEFAULT_SETTINGS } from '@/lib/settings';
  import { browser } from 'wxt/browser';

  let settings: Settings = { ...DEFAULT_SETTINGS };
  let saving = false;
  let savedMessage = '';
  let activeTab = 'chat';

  onMount(async () => {
    try {
      settings = await getSettings();
    } catch (e) {
      console.error('Failed to load settings', e);
    }
  });

  async function handleSave() {
    saving = true;
    try {
      await saveSettings(settings);
      savedMessage = 'Saved!';
      setTimeout(() => {
        savedMessage = '';
      }, 2000);
    } catch (e) {
      console.error('Failed to save settings', e);
    } finally {
      saving = false;
    }
  }

  const visualStyles = [
    { id: 'auto_select', name: 'Auto' },
    { id: 'sketch_note', name: 'Sketch' },
    { id: 'kawaii', name: 'Kawaii' },
    { id: 'professional', name: 'Pro' },
    { id: 'scientific', name: 'Science' },
    { id: 'anime', name: 'Anime' },
  ];

  const sidebarLinks = [
    { id: 'chat', label: 'Configure Chat', icon: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z' },
    { id: 'slide', label: 'Slide Deck', icon: 'M2 3h20v14H2z M8 21h8 M12 17v4' },
    { id: 'infographic', label: 'Infographic', icon: 'M12 20v-6M6 20V10M18 20V4' },
  ];
</script>

<main class="flex h-screen w-full bg-white text-[#1c160f] font-sans overflow-hidden">
  <!-- Sidebar -->
  <aside class="w-64 bg-[#f9f9f8] border-r border-[#e5e5e5] flex flex-col pt-8">
    <div class="px-6 mb-8 flex flex-col gap-1">
      <h1 class="text-xs font-bold text-[#888] uppercase tracking-wider">Settings</h1>
    </div>

    <nav class="flex-1 px-3 space-y-0.5">
      {#each sidebarLinks as link}
        <button 
          on:click={() => activeTab = link.id}
          class="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors {activeTab === link.id ? 'bg-[#ececeb] text-black' : 'text-[#555] hover:bg-[#efefee]'}"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="opacity-70">
            <path d={link.icon} />
          </svg>
          {link.label}
        </button>
      {/each}
    </nav>

    <div class="p-4 border-t border-[#e5e5e5] bg-[#f9f9f8]">
      <button 
        on:click={handleSave}
        disabled={saving}
        class="w-full py-2 rounded-lg bg-[#8b5cf6] hover:bg-[#7c3aed] text-white text-sm font-semibold shadow-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {#if saving}
          <div class="w-3 h-3 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
        {/if}
        {savedMessage || 'Save Changes'}
      </button>
      <div class="mt-4 flex items-center justify-between px-2 text-[10px] text-[#999] font-medium uppercase tracking-widest">
        <span>v2.1.0</span>
        <span>Default Template</span>
      </div>
    </div>
  </aside>

  <!-- Content -->
  <section class="flex-1 overflow-y-auto bg-white">
    <div class="max-w-[720px] mx-auto px-8 py-12">
      
      {#if activeTab === 'chat'}
        <header class="mb-10">
          <h2 class="text-2xl font-bold mb-1">Configure Chat</h2>
          <p class="text-sm text-[#888]">Default chat preferences for NotebookLM.</p>
        </header>

        <div class="space-y-0 divide-y divide-[#efefef]">
          <!-- Goal Row -->
          <div class="py-6 flex items-start justify-between gap-12">
            <div class="flex-1">
              <h3 class="text-sm font-semibold mb-1">Conversational Goal</h3>
              <p class="text-xs text-[#888]">Define your objective, style, or persona.</p>
            </div>
            <div class="flex flex-col items-end gap-3">
              <select 
                bind:value={settings.chat.goal}
                class="bg-white border border-[#ddd] rounded-lg px-3 py-1.5 text-xs font-medium focus:ring-2 focus:ring-[#8b5cf6]/20 outline-none min-w-[160px]"
              >
                <option value="default">Default</option>
                <option value="learning_guide">Learning Guide</option>
                <option value="custom">Custom</option>
              </select>
            </div>
          </div>

          {#if settings.chat.goal === 'custom'}
            <div class="py-6">
              <h3 class="text-sm font-semibold mb-2">Custom Prompt</h3>
              <textarea 
                bind:value={settings.chat.customPrompt}
                placeholder="Enter persona or special instructions..."
                class="w-full bg-[#fcfcfc] border border-[#ddd] rounded-xl p-4 text-xs focus:bg-white focus:ring-2 focus:ring-[#8b5cf6]/20 outline-none transition-all h-32"
              ></textarea>
            </div>
          {/if}

          <!-- Length Row -->
          <div class="py-6 flex items-start justify-between gap-12">
            <div class="flex-1">
              <h3 class="text-sm font-semibold mb-1">Response Length</h3>
              <p class="text-xs text-[#888]">Choose how detailed the AI responses should be.</p>
            </div>
            <select 
              bind:value={settings.chat.responseLength}
              class="bg-white border border-[#ddd] rounded-lg px-3 py-1.5 text-xs font-medium focus:ring-2 focus:ring-[#8b5cf6]/20 outline-none min-w-[160px]"
            >
              <option value="default">Default</option>
              <option value="longer">Longer</option>
              <option value="shorter">Shorter</option>
            </select>
          </div>
        </div>
      {/if}

      {#if activeTab === 'slide'}
        <header class="mb-10">
          <h2 class="text-2xl font-bold mb-1">Slide Deck Settings</h2>
          <p class="text-sm text-[#888]">Configure default format for generated slides.</p>
        </header>

        <div class="space-y-0 divide-y divide-[#efefef]">
          <div class="py-6 flex items-start justify-between gap-12">
            <div class="flex-1">
              <h3 class="text-sm font-semibold mb-1">Format</h3>
              <p class="text-xs text-[#888]">Choose the structural style of slides.</p>
            </div>
            <select 
              bind:value={settings.slideDeck.format}
              class="bg-white border border-[#ddd] rounded-lg px-3 py-1.5 text-xs font-medium focus:ring-2 focus:ring-[#8b5cf6]/20 outline-none min-w-[160px]"
            >
              <option value="detailed_deck">Detailed Deck</option>
              <option value="presenter_slides">Presenter Slides</option>
            </select>
          </div>

          <div class="py-6 flex items-start justify-between gap-12">
            <div class="flex-1">
              <h3 class="text-sm font-semibold mb-1">Language</h3>
              <p class="text-xs text-[#888]">Default writing language for slides.</p>
            </div>
            <select 
              bind:value={settings.slideDeck.language}
              class="bg-white border border-[#ddd] rounded-lg px-3 py-1.5 text-xs font-medium focus:ring-2 focus:ring-[#8b5cf6]/20 outline-none min-w-[160px]"
            >
              <option value="zh">Chinese (Simplified)</option>
              <option value="en">English</option>
            </select>
          </div>

          <div class="py-6 flex items-start justify-between gap-12">
            <div class="flex-1">
              <h3 class="text-sm font-semibold mb-1">Length</h3>
              <p class="text-xs text-[#888]">Target number of slides or detail level.</p>
            </div>
            <div class="flex bg-[#f3f3f3] p-1 rounded-lg gap-1">
              {#each ['short', 'default'] as l}
                <button 
                  on:click={() => settings.slideDeck.length = l}
                  class="px-4 py-1.5 rounded-md text-[11px] font-bold transition-all {settings.slideDeck.length === l ? 'bg-white shadow-sm text-black' : 'text-[#888]'}"
                >
                  {l.toUpperCase()}
                </button>
              {/each}
            </div>
          </div>

          <div class="py-6">
            <h3 class="text-sm font-semibold mb-1">Custom Focus Prompt</h3>
            <p class="text-xs text-[#888] mb-3">e.g. Focus on step-by-step instructions...</p>
            <textarea 
              bind:value={settings.slideDeck.customPrompt}
              placeholder="Enter your custom preference..."
              class="w-full bg-[#fcfcfc] border border-[#ddd] rounded-xl p-4 text-xs focus:bg-white focus:ring-2 focus:ring-[#8b5cf6]/20 outline-none transition-all h-24"
            ></textarea>
          </div>
        </div>
      {/if}

      {#if activeTab === 'infographic'}
        <header class="mb-10">
          <h2 class="text-2xl font-bold mb-1">Infographic Settings</h2>
          <p class="text-sm text-[#888]">Define visual report defaults.</p>
        </header>

        <div class="space-y-0 divide-y divide-[#efefef]">
          <div class="py-6 flex items-start justify-between gap-12">
            <div class="flex-1">
              <h3 class="text-sm font-semibold mb-1">Language</h3>
              <p class="text-xs text-[#888]">Text language within visual charts.</p>
            </div>
            <select 
              bind:value={settings.infographic.language}
              class="bg-white border border-[#ddd] rounded-lg px-3 py-1.5 text-xs font-medium focus:ring-2 focus:ring-[#8b5cf6]/20 outline-none min-w-[160px]"
            >
              <option value="zh">Chinese (Simplified)</option>
              <option value="en">English</option>
            </select>
          </div>

          <div class="py-6 flex items-start justify-between gap-12">
            <div class="flex-1">
              <h3 class="text-sm font-semibold mb-1">Orientation</h3>
              <p class="text-xs text-[#888]">Default layout direction.</p>
            </div>
            <div class="flex bg-[#f3f3f3] p-1 rounded-lg gap-1">
              {#each ['landscape', 'portrait', 'square'] as o}
                <button 
                  on:click={() => settings.infographic.orientation = o}
                  class="px-4 py-1.5 rounded-md text-[11px] font-bold transition-all {settings.infographic.orientation === o ? 'bg-white shadow-sm text-black' : 'text-[#888]'}"
                >
                  {o.toUpperCase()}
                </button>
              {/each}
            </div>
          </div>

          <div class="py-6">
            <h3 class="text-sm font-semibold mb-1">Visual Style</h3>
            <p class="text-xs text-[#888] mb-4">Choose default visual expression style.</p>
            <div class="grid grid-cols-3 sm:grid-cols-6 gap-3">
              {#each visualStyles as style}
                <button 
                  on:click={() => settings.infographic.visualStyle = style.id}
                  class="flex flex-col items-center justify-center p-3 rounded-xl border transition-all gap-1.5 {settings.infographic.visualStyle === style.id ? 'border-[#8b5cf6] bg-[#8b5cf6]/5 text-[#8b5cf6]' : 'bg-[#fcfcfc] border-[#eee] text-[#999] hover:border-[#ddd]'}"
                >
                  <span class="text-[10px] font-bold uppercase tracking-tighter">{style.name}</span>
                </button>
              {/each}
            </div>
          </div>

          <div class="py-6 flex items-start justify-between gap-12">
            <div class="flex-1">
              <h3 class="text-sm font-semibold mb-1">Detail Level</h3>
              <p class="text-xs text-[#888]">Data density in charts.</p>
            </div>
            <select 
              bind:value={settings.infographic.detailLevel}
              class="bg-white border border-[#ddd] rounded-lg px-3 py-1.5 text-xs font-medium focus:ring-2 focus:ring-[#8b5cf6]/20 outline-none min-w-[160px]"
            >
              <option value="concise">Concise</option>
              <option value="standard">Standard</option>
              <option value="detailed">Detailed</option>
            </select>
          </div>

          <div class="py-6">
            <h3 class="text-sm font-semibold mb-1">Style or Focus Prompt</h3>
            <p class="text-xs text-[#888] mb-3">e.g. Use a retro print style with high contrast...</p>
            <textarea 
              bind:value={settings.infographic.customPrompt}
              placeholder="Enter your custom preference..."
              class="w-full bg-[#fcfcfc] border border-[#ddd] rounded-xl p-4 text-xs focus:bg-white focus:ring-2 focus:ring-[#8b5cf6]/20 outline-none transition-all h-32"
            ></textarea>
          </div>
        </div>
      {/if}

    </div>
  </section>
</main>

<style>
  :global(body) {
    margin: 0;
    padding: 0;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  }
  
  textarea {
    resize: none;
  }
</style>
