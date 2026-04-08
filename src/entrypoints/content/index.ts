import { mount, unmount } from 'svelte';
import { collectPageContext, contentScriptMatches, getSiteAdapter } from '@/lib/site-adapters';

export default defineContentScript({
  matches: contentScriptMatches,
  async main(ctx) {
    const VERSION = '2.1.0';
    const messageListener = (message: any, _sender: unknown, sendResponse: (response?: unknown) => void) => {
      if (message?.type === 'collect-page-context') {
        sendResponse(collectPageContext());
      }
    };

    browser.runtime.onMessage.addListener(messageListener);

    let currentUrl = location.href;
    let mountTimer: ReturnType<typeof setTimeout> | null = null;
    const observer = new MutationObserver(() => {
      const nextUrl = location.href;
      const urlChanged = nextUrl !== currentUrl;

      if (urlChanged) {
        currentUrl = nextUrl;
        removeExistingLauncher();
      }

      const hasLauncher = !!document.querySelector('stn-inline-launcher');
      if (urlChanged || !hasLauncher) {
        const adapter = getSiteAdapter(new URL(currentUrl));
        if (adapter) {
          // If we found the anchor, we can mount much faster (50ms vs 300ms)
          const anchor = adapter.findMountAnchor();
          const delay = (anchor && !urlChanged) ? 50 : (adapter.remountDelayMs ?? 300);
          scheduleMount(delay);
        }
      }
    });

    const scheduleMount = (delay: number) => {
      if (mountTimer) clearTimeout(mountTimer);
      mountTimer = setTimeout(() => {
        mountTimer = null;
        void mountLaunchers(ctx);
      }, delay);
    };

    scheduleMount(getSiteAdapter()?.initialMountDelayMs ?? 600);
    observer.observe(document.body, { childList: true, subtree: true });

    ctx.onInvalidated(() => {
      console.log(`[STN-Content] Context invalidated for ${VERSION}`);
      browser.runtime.onMessage.removeListener(messageListener);
      observer.disconnect();
      if (mountTimer) clearTimeout(mountTimer);
    });
  },
});

function removeExistingLauncher() {
  const existing = document.querySelectorAll('stn-inline-launcher');
  existing.forEach((el) => el.remove());
}

let isMounting = false;

async function mountLaunchers(ctx: any, retryCount = 0) {
  const adapter = getSiteAdapter();
  if (!adapter || isMounting || !ctx || document.querySelector('stn-inline-launcher')) {
    return;
  }

  const page = collectPageContext();
  if (!adapter.canMount(page)) {
    return;
  }

  const anchor = adapter.findMountAnchor();
  if (!anchor) {
    // If we're on a page that should have a launcher but anchor isn't found, retry a few times
    if (retryCount < 10) {
      setTimeout(() => void mountLaunchers(ctx, retryCount + 1), 200);
    }
    return;
  }

  await createUi(ctx, anchor, page, adapter);
}

async function createUi(
  ctx: any,
  anchor: Element,
  page: ReturnType<typeof collectPageContext>,
  adapter: NonNullable<ReturnType<typeof getSiteAdapter>>,
) {
  if (isMounting) return;
  isMounting = true;

  try {
    const ui = await createShadowRootUi(ctx, {
      name: 'stn-inline-launcher',
      position: 'inline',
      anchor,
      append: adapter.insertPosition,
      onMount: async (container) => {
        const { default: Launcher } = await import('./Launcher.svelte');
        const shadowRoot = container.getRootNode() as ShadowRoot;
        const hostEl = shadowRoot?.host as HTMLElement | undefined;
        if (hostEl && adapter.hostStyle) {
          Object.assign(hostEl.style, adapter.hostStyle);
        }

        const app = mount(Launcher, {
          target: container,
          props: { page, host: adapter.id },
        });
        return app;
      },
      onRemove: (app) => {
        if (app) unmount(app);
      },
    });

    ui.mount();
  } catch (error) {
    console.error('[STN-Content] Shadow UI mount failed:', error);
  } finally {
    isMounting = false;
  }
}
