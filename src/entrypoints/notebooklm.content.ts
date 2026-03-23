import { getSettings } from '@/lib/settings';

export default defineContentScript({
  matches: ['https://notebooklm.google.com/*'],
  async main() {
    // 1. Immediate Context Check
    if (typeof browser === 'undefined' || !browser.runtime?.id) return;

    let isContextValid = true;

    // 2. Immediate Global Error Interception
    const errorHandler = (event: PromiseRejectionEvent | ErrorEvent) => {
      const msg = (event instanceof PromiseRejectionEvent) ? event.reason?.message : event.message;
      if (msg?.includes('Extension context invalidated')) {
        isContextValid = false;
        if (event instanceof PromiseRejectionEvent) event.preventDefault();
        updateIndicatorToInvalid();
      }
    };
    window.addEventListener('unhandledrejection', errorHandler);
    window.addEventListener('error', errorHandler);

    console.log('[STN-NotebookLM] Enhancer Loaded');
    
    const indicator = document.createElement('div');
    indicator.id = 'stn-status';
    indicator.style.cssText = 'position: fixed; top: 10px; right: 10px; background: #1c160f; color: #fff; padding: 4px 8px; border-radius: 4px; font-size: 10px; font-family: sans-serif; z-index: 99999; border: 1px solid #e66d3d; opacity: 0.8; pointer-events: none; transition: all 0.5s;';
    indicator.textContent = 'STN: Active';
    document.body.appendChild(indicator);

    function updateIndicatorToInvalid() {
      indicator.textContent = 'STN: Refresh Page (F5)';
      indicator.style.background = '#8B2E2E';
      indicator.style.opacity = '1';
      indicator.style.boxShadow = '0 0 15px #f00';
    }

    // 3. Main Loop wrapped in total safety
    const intervalId = setInterval(async () => {
      try {
        if (!isContextValid || !browser.runtime?.id) {
          clearInterval(intervalId);
          updateIndicatorToInvalid();
          return;
        }

        const settings = await getSettings();
        if (!settings) return; // Silent return if context invalidated inside getSettings

        const settingsStamp = JSON.stringify(settings);
        
        const dialogs = Array.from(document.querySelectorAll('div, section, [role="dialog"]')).filter(el => {
          const style = window.getComputedStyle(el);
          return (style.position === 'fixed' || style.position === 'absolute' || el.hasAttribute('role')) && (el as HTMLElement).offsetParent !== null;
        });

        for (const dialog of dialogs) {
          const text = dialog.textContent || '';
          if (text.includes('Configure Chat') || text.includes('Customize Slide Deck') || text.includes('Customize Infographic')) {
            if (dialog.getAttribute('data-stn-settings-version') !== settingsStamp) {
              const isChat = text.includes('Configure Chat');
              const isSlide = text.includes('Customize Slide Deck');
              const isInfo = text.includes('Customize Infographic');

              if (isChat) await applyChatSettings(dialog as HTMLElement, settings);
              else if (isSlide) await applySlideDeckSettings(dialog as HTMLElement, settings);
              else if (isInfo) await applyInfographicSettings(dialog as HTMLElement, settings);

              dialog.setAttribute('data-stn-settings-version', settingsStamp);
              
              if (isChat) {
                setTimeout(() => clickByTextForce(dialog as HTMLElement, 'Save'), 1000);
              }
            }
          }
        }
      } catch (error: any) {
        if (error?.message?.includes('Extension context invalidated')) {
          isContextValid = false;
          updateIndicatorToInvalid();
        } else {
          console.error('[STN] Enhancer error:', error);
        }
      }
    }, 2000);

    async function applyChatSettings(dialog: HTMLElement, settings: any) {
      const { goal, responseLength } = settings.chat;
      const goalLabel = goal === 'learning_guide' ? 'Learning Guide' : goal === 'custom' ? 'Custom' : 'Default';
      const lengthLabel = responseLength === 'longer' ? 'Longer' : responseLength === 'shorter' ? 'Shorter' : 'Default';
      await smartSectionClickForce(dialog, 'conversational goal', goalLabel);
      await smartSectionClickForce(dialog, 'response length', lengthLabel);
    }

    async function applySlideDeckSettings(dialog: HTMLElement, settings: any) {
      const { format, language, length } = settings.slideDeck;
      const formatLabel = format === 'presenter_slides' ? 'Presenter Slides' : 'Detailed Deck';
      const lengthLabel = length === 'short' ? 'Short' : 'Default';
      await smartSectionClickForce(dialog, 'format', formatLabel);
      await smartSectionClickForce(dialog, 'length', lengthLabel);
      await applyLanguageSelection(dialog, language);
    }

    async function applyInfographicSettings(dialog: HTMLElement, settings: any) {
       const { language, orientation, visualStyle, detailLevel } = settings.infographic;
       const orientationLabel = orientation === 'landscape' ? 'Landscape' : orientation === 'portrait' ? 'Portrait' : 'Square';
       const detailLabel = detailLevel === 'concise' ? 'Concise' : detailLevel === 'detailed' ? 'Detailed' : 'Standard';

       await applyLanguageSelection(dialog, language);
       await smartSectionClickForce(dialog, 'orientation', orientationLabel);
       await smartSectionClickForce(dialog, 'level of detail', detailLabel);

       if (visualStyle) {
          const styleSrcPart = {
            'sketch_note': 'sketchnote', 'kawaii': 'kawaii', 'professional': 'professional',
            'scientific': 'scientific', 'anime': 'anime', 'watercolor': 'watercolor',
            'retro_print': 'retro', 'heritage': 'heritage', 'paper_craft': 'paper'
          }[visualStyle] || 'auto-select';

          const img = dialog.querySelector(`img[src*="${styleSrcPart}"]`);
          if (img) {
             const parentBtn = img.closest('.carousel-radio-button, [role="button"], [role="radio"], .carousel-item, label');
             await simulateDeepClick(parentBtn as HTMLElement || img as HTMLElement);
          } else {
             const styleText = visualStyle === 'sketch_note' ? 'Sketch' : visualStyle === 'auto_select' ? 'Auto' : visualStyle;
             await smartSectionClickForce(dialog, 'visual style', styleText);
          }
       }
    }

    async function smartSectionClickForce(dialog: HTMLElement, sectionTitle: string, btnText: string) {
       const clean = (s: string) => s.toLowerCase().replace(/[\s\u00A0]+/g, ' ').trim();
       const sectionTarget = clean(sectionTitle);
       const buttonTarget = clean(btnText);
       const all = Array.from(dialog.querySelectorAll('*'));
       const header = all.find(el => {
          const t = clean(el.textContent || '');
          return t === sectionTarget || (t.includes(sectionTarget) && t.length < 55);
       }) as HTMLElement;
       const elements = Array.from(dialog.querySelectorAll('button, [role="button"], [role="radio"], .carousel-radio-button, label, .mdc-label, span'));
       let best: HTMLElement | null = null;
       let minDistance = Infinity;
       const hRect = header ? header.getBoundingClientRect() : { top: 0, left: 0 } as any;
       for (const el of elements) {
          const t = clean(el.textContent || '');
          if (t === buttonTarget || t.includes(buttonTarget)) {
             const r = el.getBoundingClientRect();
             const dist = header ? (Math.abs(r.top - hRect.top) * 2 + Math.abs(r.left - hRect.left)) : 0;
             if (dist < minDistance) {
                minDistance = dist;
                best = el as HTMLElement;
             }
          }
       }
       if (best) await simulateDeepClick(best);
       else await clickByTextForce(dialog, btnText);
    }

    async function applyLanguageSelection(dialog: HTMLElement, languageCode: string) {
       const select = dialog.querySelector('select');
       if (select) {
         const optionLabel = languageCode === 'zh' ? 'Chinese (Simplified)' : 'English (United States)';
         const opt = Array.from(select.options).find(o => o.text.includes(optionLabel) || o.text.includes(languageCode === 'zh' ? '中文' : 'English'));
         if (opt && select.value !== opt.value) {
           select.value = opt.value;
           select.dispatchEvent(new Event('change', { bubbles: true }));
         }
       }
    }

    async function clickByTextForce(parent: HTMLElement, text: string): Promise<boolean> {
      const cleanText = text.toLowerCase().trim();
      const btns = Array.from(parent.querySelectorAll('button, [role="button"], span, div, label'))
        .filter(el => {
          const t = el.textContent?.toLowerCase().trim() || '';
          return t === cleanText || (t.includes(cleanText) && t.length < cleanText.length + 8);
        });
      if (btns.length > 0) {
        await simulateDeepClick(btns[0] as HTMLElement);
        return true;
      }
      return false;
    }

    async function simulateDeepClick(el: HTMLElement) {
      try {
        el.focus();
        const events = ['mouseover', 'mousedown', 'mouseup', 'click'];
        for (const name of events) {
           el.dispatchEvent(new MouseEvent(name, { bubbles: true, view: window, buttons: 1 }));
        }
        el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, view: window }));
        el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, view: window }));
        el.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
        el.dispatchEvent(new KeyboardEvent('keyup', { key: ' ', bubbles: true }));
      } catch (e) {
        // Ignore element errors
      }
    }
  },
});
