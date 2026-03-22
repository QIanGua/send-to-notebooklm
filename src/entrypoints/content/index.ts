import { mount, unmount } from 'svelte';
import Launcher from './Launcher.svelte';

export default defineContentScript({
  matches: ['*://*/*'],
  async main(ctx) {
    const VERSION = "2.1.0";
    console.log(`[STN-Content] Initializing version ${VERSION} on ${location.href}`);

    // 1. Message listener
    browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message?.type === "collect-page-context") {
        sendResponse(collectPageContext());
      }
    });

    // Track current URL for SPA navigation detection
    let lastUrl = location.href;
    let currentUi: any = null;

    // Debounced mount function
    let mountTimer: ReturnType<typeof setTimeout> | null = null;
    const debouncedMount = (delay = 500) => {
      if (mountTimer) clearTimeout(mountTimer);
      mountTimer = setTimeout(() => {
        mountLaunchers(ctx);
      }, delay);
    };

    // 2. Initial mount after page settles
    setTimeout(() => mountLaunchers(ctx), 1500);

    // 3. YouTube SPA navigation & arXiv dynamic content
    if (location.hostname.includes("youtube.com") || location.hostname.includes("arxiv.org")) {
      const observer = new MutationObserver(() => {
        const currentUrl = location.href;

        // If URL changed (YouTube SPA navigation), remove old button and re-mount
        if (currentUrl !== lastUrl) {
          console.log(`[STN-Content] URL changed: ${lastUrl} -> ${currentUrl}`);
          lastUrl = currentUrl;
          removeExistingLauncher();
          debouncedMount(1500); // Give new page time to render
          return;
        }

        // Otherwise, try mounting if not yet mounted
        if (!document.querySelector('stn-inline-launcher')) {
          debouncedMount(300);
        }
      });

      observer.observe(document.body, { childList: true, subtree: true });

      ctx.onInvalidated(() => {
        console.log(`[STN-Content] Context invalidated for ${VERSION}`);
        observer.disconnect();
        if (mountTimer) clearTimeout(mountTimer);
      });
    }
  },
});

function collectPageContext() {
  const selection = window.getSelection?.();
  const selectedText = selection ? selection.toString().trim() : "";
  const canonicalLink = document.querySelector('link[rel="canonical"]') as HTMLLinkElement;
  const descriptionMeta = document.querySelector('meta[name="description"], meta[property="og:description"]') as HTMLMetaElement;
  const authorMeta = document.querySelector('meta[name="author"], meta[property="article:author"]') as HTMLMetaElement;
  
  return {
    title: document.title.replace(/\s+/g, " ").trim(),
    url: location.href,
    canonicalUrl: canonicalLink?.href || location.href,
    description: descriptionMeta?.content?.replace(/\s+/g, " ").trim() || "",
    selectedText: selectedText.replace(/\s+/g, " ").trim(),
    byline: authorMeta?.content?.replace(/\s+/g, " ").trim() || "",
    arxiv: detectArxivContext(),
    youtube: detectYouTubeContext()
  };
}

function detectArxivContext() {
  const { hostname, pathname } = location;
  if (!hostname.includes("arxiv.org")) return null;
  const absMatch = pathname.match(/^\/abs\/([^/?#]+)/);
  if (absMatch) return { isArxiv: true, pageType: "abs", paperId: absMatch[1], pdfUrl: `https://arxiv.org/pdf/${absMatch[1]}.pdf` };
  const pdfMatch = pathname.match(/^\/pdf\/([^/?#]+?)(?:\.pdf)?$/);
  if (pdfMatch) return { isArxiv: true, pageType: "pdf", paperId: pdfMatch[1], pdfUrl: `https://arxiv.org/pdf/${pdfMatch[1]}.pdf` };
  return { isArxiv: true, pageType: "other", paperId: "", pdfUrl: "" };
}

function detectYouTubeContext() {
  const { hostname, pathname, search } = location;
  if (!hostname.includes("youtube.com") && !hostname.includes("youtu.be")) return null;
  if (hostname.includes("youtu.be")) {
    const videoId = pathname.replace(/^\/+/, "").split("/")[0];
    return videoId ? { isYouTube: true, pageType: "video", videoId, videoUrl: `https://www.youtube.com/watch?v=${videoId}` } : null;
  }
  if (pathname === "/watch") {
    const videoId = new URLSearchParams(search).get("v");
    return videoId ? { isYouTube: true, pageType: "video", videoId, videoUrl: `https://www.youtube.com/watch?v=${videoId}` } : null;
  }
  return { isYouTube: true, pageType: "other", videoId: "", videoUrl: "" };
}

/** Remove any existing launcher shadow root from the page */
function removeExistingLauncher() {
  const existing = document.querySelectorAll('stn-inline-launcher');
  existing.forEach(el => {
    console.log("[STN-Content] Removing old launcher for re-mount.");
    el.remove();
  });
}

let isMounting = false;
async function mountLaunchers(ctx: any) {
  if (isMounting || !ctx) return;

  // Already mounted for current URL? Skip.
  if (document.querySelector('stn-inline-launcher')) return;

  const page = collectPageContext();

  if (page.arxiv?.pageType === "abs" || page.arxiv?.pageType === "pdf") {
    // Simplified arXiv selector: find any PDF link, matching legacy behavior
    const anchor = document.querySelector('a[href*="/pdf/"]');
    if (anchor) {
      console.log("[STN-Content] arXiv detected. Mounting launcher.");
      await createUi(ctx, anchor, page, 'arxiv');
    }
  } else if (page.youtube?.pageType === "video") {
    // Expanded YouTube selectors to cover various YT DOM versions
    const actionRow = document.querySelector([
      'ytd-watch-metadata #actions',                           // Modern desktop layout
      'ytd-watch-metadata #top-level-buttons-computed',        // Older desktop layout
      'ytd-watch-metadata #menu',                              // Alternative menu container
      '#top-row #actions',                                     // Fallback
      'ytd-menu-renderer #top-level-buttons-computed',         // Legacy renderer
      '#actions.ytd-watch-metadata',                           // Direct class selector
      'ytd-watch-metadata ytd-menu-renderer',                  // Menu renderer inside metadata
    ].join(', '));

    if (actionRow) {
      console.log("[STN-Content] YouTube detected. Mounting launcher.");
      await createUi(ctx, actionRow as HTMLElement, page, 'youtube');
    } else {
      console.log("[STN-Content] YouTube video detected but action row not found yet.");
    }
  }
}

async function createUi(ctx: any, anchor: Element, page: any, host: 'arxiv'|'youtube') {
  if (isMounting) return;
  isMounting = true;
  try {
    const ui = await createShadowRootUi(ctx, {
      name: 'stn-inline-launcher',
      position: 'inline',
      anchor,
      // YouTube: insert inside the action bar as last child for alignment
      // arXiv: insert after the anchor element
      append: host === 'youtube' ? 'last' : 'after',
      onMount: (container) => {
        // For YouTube, set flex alignment on the shadow host element
        if (host === 'youtube') {
          // The shadow host is the custom element wrapping this shadow DOM
          const shadowRoot = container.getRootNode() as ShadowRoot;
          const hostEl = shadowRoot?.host as HTMLElement;
          if (hostEl) {
            hostEl.style.display = 'flex';
            hostEl.style.alignItems = 'center';
            hostEl.style.marginLeft = '8px';
          }
        }
        const app = mount(Launcher, {
          target: container,
          props: { page, host }
        });
        return app;
      },
      onRemove: (app) => { if (app) unmount(app); },
    });
    ui.mount();
  } catch (err) {
    console.error("[STN-Content] Shadow UI mount failed:", err);
  } finally {
    isMounting = false;
  }
}
