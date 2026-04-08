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

    // 3. Automation Handler
    const handleAutoBuild = async () => {
      const hash = window.location.hash;
      if (!hash.includes('autobuild=')) return;

      const params = new URLSearchParams(hash.slice(1));
      const type = params.get('autobuild');
      const mode = params.get('mode');
      if (!type) return;

      const notebookId = window.location.pathname.split('/').pop() || '';
      console.log(`[STN] Auto-build triggered for ${type} in notebook ${notebookId}`);

      // Clear hash to prevent re-triggering on refresh
      window.location.hash = '';

      try {
        // 1. Ensure Notebook Guide is open
        const guideBtn = await waitForElement('button, [role="button"]', (el) => {
          const t = el.textContent?.toLowerCase() || '';
          return t.includes('notebook guide');
        });
        if (guideBtn) await simulateDeepClick(guideBtn);
        await sleep(1000);

        // 2. Click the specific artifact button
        const artifactLabel = type === 'slide' ? 'Slide Deck' : type === 'infographic' ? 'Infographic' : type === 'video' ? 'Video Overview' : 'Briefing Doc';
        const buildBtn = await waitForElement('.notebook-guide-button, button, [role="button"]', (el) => {
          const t = el.textContent?.toLowerCase() || '';
          return t.includes(artifactLabel.toLowerCase());
        });

        if (!buildBtn) throw new Error(`Could not find ${artifactLabel} button in guide.`);
        await simulateDeepClick(buildBtn);

        // 3. Wait for and handle the dialog
        // The main loop will handle the customization dialog application.
        // We need to wait for the dialog to appear and then wait for it to be processed.
        const dialogTitle = type === 'slide' ? 'Customize Slide Deck' : type === 'infographic' ? 'Customize Infographic' : type === 'video' ? 'Customize Video Overview' : 'Report';
        
        // Custom handling for Briefing Doc if it doesn't have a customization dialog or has a different flow
        if (type === 'report') {
            // Briefing doc often generates directly or has a simpler flow
            // If there's no dialog, we might be done or need to wait for generation
        }

        // Wait for generation to start and finish
        let attempts = 0;
        let success = false;
        while (attempts < 60) { // 2 minute timeout (2s * 60)
          await sleep(2000);
          const isGenerating = document.body.textContent?.toLowerCase().includes('generating');
          const hasDialog = Array.from(document.querySelectorAll('[role="dialog"]')).some(d => d.textContent?.includes('Customize'));
          
          if (!isGenerating && !hasDialog && attempts > 5) {
            // If not generating and no dialog and we've waited a bit, assume done
            success = true;
            break;
          }
          attempts++;
        }

        await browser.runtime.sendMessage({
          type: 'build-status',
          notebookId,
          artifactType: type,
          status: success ? 'success' : 'error'
        });

      } catch (error: any) {
        console.error('[STN] Auto-build failed:', error);
        await browser.runtime.sendMessage({
          type: 'build-status',
          notebookId,
          artifactType: type,
          status: 'error',
          error: error.message
        });
      }
    };

    setTimeout(handleAutoBuild, 3000); // Give page some time to init

    // 4. Main Loop wrapped in total safety
    const intervalId = setInterval(async () => {
      try {
        if (!isContextValid || !browser.runtime?.id) {
          clearInterval(intervalId);
          updateIndicatorToInvalid();
          return;
        }

        const settings = await getSettings();
        if (!settings) return;

        const settingsStamp = JSON.stringify(settings);
        
        const dialogs = Array.from(document.querySelectorAll('div, section, [role="dialog"]')).filter(el => {
          const style = window.getComputedStyle(el);
          return (style.position === 'fixed' || style.position === 'absolute' || el.hasAttribute('role')) && (el as HTMLElement).offsetParent !== null;
        });

        for (const dialog of dialogs) {
          const text = dialog.textContent || '';
          const isChat = text.includes('Configure Chat');
          const isSlide = text.includes('Customize Slide Deck');
          const isInfo = text.includes('Customize Infographic');
          const isVideo = text.includes('Customize Video Overview');
          const isReport = text.includes('Customize Briefing Doc') || (text.includes('Report') && text.includes('Language'));

          if (isChat || isSlide || isInfo || isReport || isVideo) {
            if (dialog.getAttribute('data-stn-settings-version') !== settingsStamp) {
              if (isChat) await applyChatSettings(dialog as HTMLElement, settings);
              else if (isSlide) await applySlideDeckSettings(dialog as HTMLElement, settings);
              else if (isInfo) await applyInfographicSettings(dialog as HTMLElement, settings);
              else if (isReport) await applyReportSettings(dialog as HTMLElement, settings);
              else if (isVideo) await applyVideoOverviewSettings(dialog as HTMLElement, settings);

              dialog.setAttribute('data-stn-settings-version', settingsStamp);
              
              // Auto-submit for non-chat dialogs
              if (isSlide || isInfo || isReport || isChat || isVideo) {
                const submitBtn = isChat ? 'Save' : 'Generate';
                setTimeout(() => clickByTextForce(dialog as HTMLElement, submitBtn), 1000);
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
      const { goal, responseLength, customPrompt } = settings.chat;
      const goalLabel = goal === 'learning_guide' ? 'Learning Guide' : goal === 'custom' ? 'Custom' : 'Default';
      const lengthLabel = responseLength === 'longer' ? 'Longer' : responseLength === 'shorter' ? 'Shorter' : 'Default';
      await smartSectionClickForce(dialog, 'conversational goal', goalLabel);
      await smartSectionClickForce(dialog, 'response length', lengthLabel);
      
      if (goal === 'custom' && customPrompt) {
        await fillTextArea(dialog, customPrompt);
      }
    }

    async function applySlideDeckSettings(dialog: HTMLElement, settings: any) {
      const { format, language, length, customPrompt } = settings.slideDeck;
      const formatLabel = format === 'presenter_slides' ? 'Presenter Slides' : 'Detailed Deck';
      const lengthLabel = length === 'short' ? 'Short' : 'Default';
      await smartSectionClickForce(dialog, 'format', formatLabel);
      await smartSectionClickForce(dialog, 'length', lengthLabel);
      await applyLanguageSelection(dialog, language);
      
      if (customPrompt) {
        await fillTextArea(dialog, customPrompt);
      }
    }

    async function applyInfographicSettings(dialog: HTMLElement, settings: any) {
       const { language, orientation, visualStyle, detailLevel, customPrompt } = settings.infographic;
       const orientationLabel = orientation === 'landscape' ? 'Landscape' : orientation === 'portrait' ? 'Portrait' : 'Square';
       const detailLabel = detailLevel === 'concise' ? 'Concise' : detailLevel === 'detailed' ? 'Detailed' : 'Standard';

       await applyLanguageSelection(dialog, language);
       await smartSectionClickForce(dialog, 'orientation', orientationLabel);
       await smartSectionClickForce(dialog, 'level of detail', detailLabel);

       if (visualStyle) {
          const styleSrcPart = ({
            'sketch_note': 'sketchnote', 'kawaii': 'kawaii', 'professional': 'professional',
            'scientific': 'scientific', 'anime': 'anime', 'watercolor': 'watercolor',
            'retro_print': 'retro', 'heritage': 'heritage', 'paper_craft': 'paper'
          } as Record<string, string>)[visualStyle] || 'auto-select';

          const img = dialog.querySelector(`img[src*="${styleSrcPart}"]`);
          if (img) {
             const parentBtn = img.closest('.carousel-radio-button, [role="button"], [role="radio"], .carousel-item, label');
             await simulateDeepClick(parentBtn as HTMLElement || img as HTMLElement);
          } else {
             const styleText = visualStyle === 'sketch_note' ? 'Sketch' : visualStyle === 'auto_select' ? 'Auto' : visualStyle;
             await smartSectionClickForce(dialog, 'visual style', styleText);
          }
       }

       if (customPrompt) {
          await fillTextArea(dialog, customPrompt);
       }
    }

    async function applyReportSettings(dialog: HTMLElement, settings: any) {
      const { language, customPrompt } = settings.report;
      await applyLanguageSelection(dialog, language);
      if (customPrompt) {
        await fillTextArea(dialog, customPrompt);
      }
    }

    async function applyVideoOverviewSettings(dialog: HTMLElement, settings: any) {
      const { format, customPrompt } = settings.videoOverview;
      const formatLabel = format === 'cinematic' ? 'Cinematic' : format === 'explainer' ? 'Explainer' : 'Brief';
      await smartSectionClickForce(dialog, 'format', formatLabel);
      if (customPrompt) {
        await fillTextArea(dialog, customPrompt);
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

    async function fillTextArea(dialog: HTMLElement, text: string) {
       if (!text) return;
       const textarea = dialog.querySelector('textarea');
       if (textarea instanceof HTMLTextAreaElement) {
          if (textarea.value !== text) {
             textarea.value = text;
             textarea.dispatchEvent(new Event('input', { bubbles: true }));
             textarea.dispatchEvent(new Event('change', { bubbles: true }));
          }
       }
    }

    async function waitForElement(selector: string, predicate?: (el: HTMLElement) => boolean): Promise<HTMLElement | null> {
       let attempts = 0;
       while (attempts < 20) {
          const el = Array.from(document.querySelectorAll(selector)).find(e => !predicate || predicate(e as HTMLElement)) as HTMLElement;
          if (el) return el;
          await sleep(500);
          attempts++;
       }
       return null;
    }

    function sleep(ms: number) {
       return new Promise(resolve => setTimeout(resolve, ms));
    }
  },
});
