export default defineBackground(() => {
  const NOTEBOOKLM_ORIGIN = 'https://notebooklm.google.com';
  const STORAGE_KEYS = {
    selectedNotebookId: 'selectedNotebookId',
  };
  const TOKEN_TTL_MS = 30_000;
  const NOTEBOOK_TTL_MS = 15_000;

  let tokenCache: { value: { buildLabel: string; at: string }; expiresAt: number } | null = null;
  let notebookCache: { value: any[]; expiresAt: number } | null = null;

  console.log('[STN-Background] Loaded. Version: 2.1.0');

  browser.runtime.onInstalled.addListener(() => {
    browser.contextMenus.removeAll().then(() => {
      browser.contextMenus.create({
        id: 'send-page',
        title: 'Send page to NotebookLM',
        contexts: ['page'],
      });
      browser.contextMenus.create({
        id: 'send-link',
        title: 'Send link to NotebookLM',
        contexts: ['link'],
      });
    });
  });

  browser.contextMenus.onClicked.addListener(async (info) => {
    const targetUrl = info.menuItemId === 'send-link' ? info.linkUrl : info.pageUrl;
    if (!targetUrl) return;

    try {
      let notebookId = await getSavedNotebookId();
      if (!notebookId) {
        const notebooks = await fetchNotebooks();
        notebookId = notebooks[0]?.id || '';
      }

      if (!notebookId) {
        browser.tabs.create({ url: browser.runtime.getURL('/popup.html') });
        return;
      }

      await addSourcesToNotebook(notebookId, [targetUrl]);
      browser.tabs.create({ url: `${NOTEBOOKLM_ORIGIN}/notebook/${notebookId}` });
    } catch (error) {
      console.error('[STN-Background] Context menu error:', error);
      browser.tabs.create({ url: NOTEBOOKLM_ORIGIN });
    }
  });

  browser.runtime.onMessage.addListener((message: any, sender, sendResponse) => {
    handleMessage(message, sender)
      .then((result) => sendResponse(result))
      .catch((error) => {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`[STN-Background] Message handling failed [${message?.type}]:`, errorMessage, error);
        sendResponse({ ok: false, error: errorMessage });
      });
    return true;
  });

  async function handleMessage(message: any, sender: any) {
    if (!message) throw new Error('Received empty message.');

    switch (message.type) {
      case 'get-page-context':
        return getPageContext(message.tabId, sender.tab);
      case 'fetch-notebooks':
        return { ok: true, notebooks: await fetchNotebooks() };
      case 'create-notebook': {
        const notebookId = await createNotebook();
        return { ok: true, notebookId };
      }
      case 'fetch-page-links': {
        if (!message.url || typeof message.url !== 'string') {
          throw new Error('No source URL provided.');
        }
        return { ok: true, links: await fetchPageLinks(message.url) };
      }
      case 'save-selected-notebook':
        await browser.storage.local.set({
          [STORAGE_KEYS.selectedNotebookId]: message.notebookId || '',
        });
        return { ok: true };
      case 'send-to-notebook': {
        const sanitized = Array.isArray(message.urls) ? sanitizeUrls(message.urls) : [];
        if (!message.notebookId) throw new Error('No notebook selected.');
        if (sanitized.length === 0) throw new Error('No valid source URLs provided.');

        await addSourcesToNotebook(message.notebookId, sanitized);
        await browser.storage.local.set({ [STORAGE_KEYS.selectedNotebookId]: message.notebookId });
        return { ok: true, notebookUrl: `${NOTEBOOKLM_ORIGIN}/notebook/${message.notebookId}` };
      }
      case 'create-notebook-and-send': {
        const sanitized = Array.isArray(message.urls) ? sanitizeUrls(message.urls) : [];
        if (sanitized.length === 0) throw new Error('No valid source URLs provided.');

        const notebookId = await createNotebook();
        await addSourcesToNotebook(notebookId, sanitized);
        await browser.storage.local.set({ [STORAGE_KEYS.selectedNotebookId]: notebookId });
        return { ok: true, notebookId, notebookUrl: `${NOTEBOOKLM_ORIGIN}/notebook/${notebookId}` };
      }
      case 'open-notebooklm':
        browser.tabs.create({ url: NOTEBOOKLM_ORIGIN });
        return { ok: true };
      default:
        throw new Error(`Unknown message type: ${message.type}`);
    }
  }

  async function getPageContext(tabId: number | undefined, senderTab: any) {
    const fallback = {
      title: senderTab?.title || '',
      url: senderTab?.url || '',
      canonicalUrl: senderTab?.url || '',
      description: '',
      selectedText: '',
      byline: '',
      site: null,
      arxiv: null,
      youtube: null,
    };

    if (!tabId) {
      return { ok: true, page: fallback };
    }

    try {
      const response = await browser.tabs.sendMessage(tabId, { type: 'collect-page-context' });
      return { ok: true, page: { ...fallback, ...(response || {}) } };
    } catch (error) {
      console.warn('[STN-Background] Could not communicate with content script:', error);
      return { ok: true, page: fallback };
    }
  }

  function extractToken(key: string, html: string) {
    const regex = new RegExp(`"${key}":"([^"]+)"`);
    return regex.exec(html)?.[1] || '';
  }

  function invalidateNotebookCache() {
    notebookCache = null;
  }

  async function fetchNotebookTokens(force = false) {
    if (!force && tokenCache && tokenCache.expiresAt > Date.now()) {
      return tokenCache.value;
    }

    let response: Response;
    try {
      response = await fetch(`${NOTEBOOKLM_ORIGIN}/`, {
        redirect: 'error',
        credentials: 'include',
      });
    } catch {
      throw new Error('Please open NotebookLM in this browser and sign in first.');
    }

    if (!response.ok) {
      throw new Error('Please open NotebookLM in this browser and sign in first.');
    }

    const html = await response.text();
    const value = {
      buildLabel: extractToken('cfb2h', html),
      at: extractToken('SNlM0e', html),
    };

    if (!value.buildLabel || !value.at) {
      throw new Error('NotebookLM session not detected. Open NotebookLM and sign in first.');
    }

    tokenCache = {
      value,
      expiresAt: Date.now() + TOKEN_TTL_MS,
    };
    return value;
  }

  async function fetchNotebooks(force = false) {
    if (!force && notebookCache && notebookCache.expiresAt > Date.now()) {
      return notebookCache.value;
    }

    const { buildLabel, at } = await fetchNotebookTokens();
    const params = new URLSearchParams({
      rpcids: 'wXbhsf',
      'source-path': '/',
      bl: buildLabel,
      _reqid: String(Math.floor(Math.random() * 900000) + 100000),
      rt: 'c',
    });
    const body = new URLSearchParams({
      'f.req': JSON.stringify([[['wXbhsf', JSON.stringify([null, 1, null, [2]]), null, 'generic']]]),
      at,
    });

    const response = await fetch(`${NOTEBOOKLM_ORIGIN}/_/LabsTailwindUi/data/batchexecute?${params}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      credentials: 'include',
      body,
    });

    if (!response.ok) {
      throw new Error(`Fetch notebooks failed: ${response.statusText}`);
    }

    const parsed = parseBatchExecutePayload(await response.text());
    if (!parsed) {
      return [];
    }

    const notebooks = parsed
      .filter((entry: any) => entry && entry.length >= 3)
      .filter((entry: any) => !(Array.isArray(entry[5]) && entry[5][0] === 3))
      .map((entry: any) => ({
        id: entry[2],
        name: entry[0]?.trim() || 'Untitled notebook',
        sources: Array.isArray(entry[1]) ? entry[1].length : 0,
        emoji: entry[3] || '📓',
      }));

    notebookCache = {
      value: notebooks,
      expiresAt: Date.now() + NOTEBOOK_TTL_MS,
    };
    return notebooks;
  }

  async function createNotebook() {
    const { buildLabel, at } = await fetchNotebookTokens();
    const params = new URLSearchParams({
      rpcids: 'CCqFvf',
      'source-path': '/',
      bl: buildLabel,
      _reqid: String(Math.floor(Math.random() * 900000) + 100000),
      rt: 'c',
    });
    const body = new URLSearchParams({
      'f.req': JSON.stringify([[['CCqFvf', JSON.stringify([null]), null, 'generic']]]),
      at,
    });

    const response = await fetch(`${NOTEBOOKLM_ORIGIN}/_/LabsTailwindUi/data/batchexecute?${params}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      credentials: 'include',
      body,
    });

    if (!response.ok) {
      throw new Error(`Create notebook failed: ${response.statusText}`);
    }

    const match = (await response.text()).match(/\b[0-9a-fA-F-]{36}\b/);
    if (!match) {
      throw new Error('Notebook created but ID extraction failed.');
    }

    invalidateNotebookCache();
    return match[0];
  }

  async function fetchPageLinks(sourceUrl: string) {
    let parsedUrl: URL;

    try {
      parsedUrl = new URL(sourceUrl);
    } catch {
      throw new Error('Source URL is invalid.');
    }

    const response = await fetch(parsedUrl.href, {
      method: 'GET',
      credentials: 'omit',
      redirect: 'follow',
    });

    if (!response.ok) {
      throw new Error(`Could not fetch page links: ${response.status} ${response.statusText}`);
    }

    const html = await response.text();
    return extractLinksFromHtml(parsedUrl, html);
  }

  async function addSourcesToNotebook(notebookId: string, urls: string[]) {
    const { buildLabel, at } = await fetchNotebookTokens();
    const params = new URLSearchParams({
      rpcids: 'izAoDd',
      'source-path': `/notebook/${notebookId}`,
      bl: buildLabel,
      _reqid: String(Math.floor(Math.random() * 900000) + 100000),
      rt: 'c',
    });
    const body = new URLSearchParams({
      'f.req': JSON.stringify([[['izAoDd', JSON.stringify([urls.map((url) => [null, null, [url]]), notebookId]), null, 'generic']]]),
      at,
    });

    const response = await fetch(`${NOTEBOOKLM_ORIGIN}/_/LabsTailwindUi/data/batchexecute?${params}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      credentials: 'include',
      body,
    });

    if (!response.ok) {
      throw new Error(`Source import failed: ${response.statusText}`);
    }

    invalidateNotebookCache();
  }

  function parseBatchExecutePayload(text: string) {
    try {
      const payloadLine = text.split('\n')[3];
      if (!payloadLine) return null;
      return JSON.parse(JSON.parse(payloadLine)[0][2])[0];
    } catch {
      try {
        const found = text.split('\n').find((line) => line.includes('["wXbhsf"'));
        if (!found) return null;
        return JSON.parse(JSON.parse(found)[0][2])[0];
      } catch {
        return null;
      }
    }
  }

  async function getSavedNotebookId() {
    const saved = await browser.storage.local.get(STORAGE_KEYS.selectedNotebookId);
    return (saved[STORAGE_KEYS.selectedNotebookId] as string) || '';
  }

  function sanitizeUrls(urls: string[]) {
    return Array.from(
      new Set(
        urls
          .filter((url) => typeof url === 'string' && url.length > 10)
          .map((url) => url.trim())
          .filter((url) => url.startsWith('https://') || url.startsWith('http://')),
      ),
    );
  }

  function extractLinksFromHtml(baseUrl: URL, html: string) {
    const hrefPattern = /href\s*=\s*["']([^"'#]+)["']/gi;
    const links: string[] = [];
    const seen = new Set<string>();

    for (const match of html.matchAll(hrefPattern)) {
      const rawHref = String(match[1] || '').trim();
      if (!rawHref || rawHref.startsWith('javascript:') || rawHref.startsWith('mailto:') || rawHref.startsWith('tel:')) {
        continue;
      }

      try {
        const resolved = new URL(rawHref, baseUrl).href;
        if (!resolved.startsWith('http://') && !resolved.startsWith('https://')) continue;
        if (seen.has(resolved)) continue;
        seen.add(resolved);
        links.push(resolved);
        if (links.length >= 200) break;
      } catch {
        continue;
      }
    }

    return links;
  }
});
