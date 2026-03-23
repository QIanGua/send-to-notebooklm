import { browser } from 'wxt/browser';

export interface Settings {
  chat: {
    goal: 'default' | 'learning_guide' | 'custom';
    responseLength: 'default' | 'longer' | 'shorter';
    customPrompt: string;
  };
  slideDeck: {
    format: 'detailed_deck' | 'presenter_slides';
    language: string;
    length: 'short' | 'default';
    customPrompt: string;
  };
  infographic: {
    language: string;
    orientation: 'landscape' | 'portrait' | 'square';
    visualStyle: 'auto_select' | 'sketch_note' | 'kawaii' | 'professional' | 'scientific' | 'anime';
    detailLevel: 'concise' | 'standard' | 'detailed';
    customPrompt: string;
  };
}

export const DEFAULT_SETTINGS: Settings = {
  chat: { 
    goal: 'learning_guide', 
    responseLength: 'longer',
    customPrompt: ''
  },
  slideDeck: { 
    format: 'detailed_deck', 
    language: 'zh', 
    length: 'default', 
    customPrompt: '' 
  },
  infographic: { 
    language: 'zh', 
    orientation: 'landscape', 
    visualStyle: 'auto_select', 
    detailLevel: 'standard', 
    customPrompt: '' 
  },
};

export async function getSettings(): Promise<Settings | null> {
  try {
    // Check if browser/runtime is still valid
    if (typeof browser === 'undefined' || !browser.runtime?.id) return null;
    
    const res = await browser.storage.local.get<{ settings?: Settings }>('settings');
    if (!res.settings) return DEFAULT_SETTINGS;
    
    return {
      chat: { ...DEFAULT_SETTINGS.chat, ...res.settings.chat },
      slideDeck: { ...DEFAULT_SETTINGS.slideDeck, ...res.settings.slideDeck },
      infographic: { ...DEFAULT_SETTINGS.infographic, ...res.settings.infographic },
    };
  } catch (e) {
    if (String(e).includes('Extension context invalidated')) return null;
    console.error('[STN] getSettings error:', e);
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettings(settings: Settings): Promise<void> {
  await browser.storage.local.set({ settings });
}
