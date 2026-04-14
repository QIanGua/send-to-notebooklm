import { getSiteAdapter } from '@/lib/site-adapters';
import { createEmptyPageContext, enrichPageContextWithSite } from '@/lib/page-context';
import { md5 } from 'js-md5';

export default defineBackground(() => {
  const NOTEBOOKLM_ORIGIN = 'https://notebooklm.google.com';
  const STORAGE_KEYS = {
    selectedNotebookId: 'selectedNotebookId',
  };
  const NOTEBOOK_TTL_MS = 15_000;
  const TOKEN_TTL_MS = 600_000; // Increase to 10 minutes

  let tokenCache: { value: { buildLabel: string; at: string }; expiresAt: number } | null = null;
  let tokenPromise: Promise<{ buildLabel: string; at: string }> | null = null;
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
      case 'warmup-tokens':
        await fetchNotebookTokens();
        return { ok: true };
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
      case 'fetch-bilibili-playlist-links': {
        if (!message.url || typeof message.url !== 'string') {
          throw new Error('No Bilibili URL provided.');
        }
        return { ok: true, links: await fetchBilibiliPlaylistLinks(message.url) };
      }
      case 'fetch-youtube-playlist-links': {
        if (!message.url || typeof message.url !== 'string') {
          throw new Error('No YouTube URL provided.');
        }
        return { ok: true, links: await fetchYoutubePlaylistLinks(message.url) };
      }
      case 'open-notebooklm':
        browser.tabs.create({ url: NOTEBOOKLM_ORIGIN });
        return { ok: true };
      case 'start-background-build': {
        const { notebookId, artifactType } = message;
        const url = `${NOTEBOOKLM_ORIGIN}/notebook/${notebookId}#autobuild=${artifactType}&mode=worker`;
        
        // Open background tab
        const tab = await browser.tabs.create({ url, active: false });
        
        // Tab management: we can track this tab if needed, but for now we rely on content script reporting back
        return { ok: true };
      }
      case 'build-status': {
        // Forward build status from content script to options page
        await browser.runtime.sendMessage(message);
        
        // If finished, close the tab
        if (sender.tab?.id && (message.status === 'success' || message.status === 'error')) {
          setTimeout(() => {
            if (sender.tab?.id) {
              browser.tabs.remove(sender.tab.id).catch(() => {});
            }
          }, 3000); // 3 second delay to ensure state propagated
        }
        return { ok: true };
      }
      default:
        throw new Error(`Unknown message type: ${message.type}`);
    }
  }

  async function getPageContext(tabId: number | undefined, senderTab: any) {
    let url = senderTab?.url || '';
    let title = senderTab?.title || '';

    if (!url && tabId) {
      try {
        const tab = await browser.tabs.get(tabId);
        url = tab.url || '';
        title = tab.title || '';
      } catch (e) {
        console.warn('[STN-Background] Could not get tab info for context:', e);
      }
    }

    const adapter = url ? getSiteAdapter(new URL(url)) : null;
    const site = adapter ? adapter.collect(new URL(url)) : null;

    const fallback = enrichPageContextWithSite(createEmptyPageContext(url, title), site);

    if (!tabId || (url.startsWith('chrome://') || url.startsWith('about:'))) {
      return { ok: true, page: fallback };
    }

    try {
      const response = await browser.tabs.sendMessage(tabId, { type: 'collect-page-context' });
      // If content script returns context, merge it with our detected site info
      // but prefer content script's detailed DOM data if available.
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

    if (tokenPromise) return tokenPromise;

    tokenPromise = (async () => {
      let response: Response;
      try {
        console.log('[STN-Background] Refreshing NotebookLM session tokens...');
        response = await fetch(`${NOTEBOOKLM_ORIGIN}/`, {
          redirect: 'error',
          credentials: 'include',
        });
      } catch (err) {
        tokenPromise = null;
        throw new Error('Please open NotebookLM in this browser and sign in first.');
      }

      if (!response.ok) {
        tokenPromise = null;
        throw new Error('Please open NotebookLM in this browser and sign in first.');
      }

      const html = await response.text();
      const value = {
        buildLabel: extractToken('cfb2h', html),
        at: extractToken('SNlM0e', html),
      };

      if (!value.buildLabel || !value.at) {
        tokenPromise = null;
        throw new Error('NotebookLM session not detected. Open NotebookLM and sign in first.');
      }

      tokenCache = {
        value,
        expiresAt: Date.now() + TOKEN_TTL_MS,
      };
      
      // Clear promise after success so next 'force' or expiry works
      setTimeout(() => { tokenPromise = null; }, 100);
      return value;
    })();

    return tokenPromise;
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

  async function fetchBilibiliPlaylistLinks(sourceUrl: string) {
    const url = new URL(sourceUrl);
    const isPlaylist = url.pathname.includes('/lists/');
    const isUploads = url.pathname.includes('/upload/video');

    if (!isPlaylist && !isUploads) {
      throw new Error('Invalid Bilibili URL. Expected space.bilibili.com/{mid}/lists/{id} or /upload/video');
    }

    const midMatch = url.pathname.match(/\/(\d+)\//);
    if (!midMatch) {
      throw new Error('Invalid Bilibili URL. Expected space.bilibili.com/{mid}/...');
    }

    const mid = midMatch[1];
    let playlistId = '';
    let type = url.searchParams.get('type') || 'season';

    if (isPlaylist) {
      const idMatch = url.pathname.match(/\/lists\/(\d+)/);
      if (!idMatch) {
        throw new Error('Invalid Bilibili playlist URL. Expected space.bilibili.com/{mid}/lists/{id}');
      }
      playlistId = idMatch[1];
    }

    const allLinks: { url: string; title: string }[] = [];
    let pageNum = 1;
    let hasMore = true;

    while (hasMore && allLinks.length < 50) {
      let apiUrl = '';
      let useMedialist = false;
      
      if (isUploads) {
        // Try medialist first as it's often more stable for "All Uploads"
        const { img_key, sub_key } = await getWbiKeys();
        const signedQuery = signBilibiliParams({
          mid,
          ps: 30,
          tid: 0,
          pn: pageNum,
          keyword: '',
          order: 'pubdate',
          platform: 'web',
          web_location: 1550101,
        }, img_key, sub_key);
        apiUrl = `https://api.bilibili.com/x/space/wbi/arc/search?${signedQuery}`;
      } else {
        apiUrl = type === 'season'
          ? `https://api.bilibili.com/x/polymer/web-space/seasons_archives_list?mid=${mid}&season_id=${playlistId}&page_num=${pageNum}&page_size=30`
          : `https://api.bilibili.com/x/polymer/web-space/home/seasons_series/archives?mid=${mid}&series_id=${playlistId}&page_num=${pageNum}&page_size=30`;
      }

      const response = await fetch(apiUrl, {
        headers: {
          'Referer': 'https://www.bilibili.com/',
          'User-Agent': navigator.userAgent
        }
      });

      if (!response.ok) {
        throw new Error(`Bilibili API failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      if (data.code !== 0) {
        throw new Error(`Bilibili API error: ${data.message || 'Unknown error'} (Code: ${data.code})`);
      }

      // Handle different formats from wbi search vs polymer
      const archives = isUploads ? (data.data?.list?.vlist || []) : (data.data?.archives || []);
      if (archives.length === 0) {
        hasMore = false;
      } else {
        archives.forEach((archive: any) => {
          if (archive.bvid) {
            allLinks.push({
              url: `https://www.bilibili.com/video/${archive.bvid}`,
              title: archive.title || archive.bvid,
            });
          }
        });
        
        const total = isUploads ? (data.data?.page?.count || 0) : (data.data?.page?.total || 0);
        const pageSize = isUploads ? (data.data?.page?.ps || 30) : (data.data?.page?.page_size || 30);
        const currentTotal = pageNum * pageSize;

        if (currentTotal >= total) {
          hasMore = false;
        } else {
          pageNum++;
        }
      }
    }

    return allLinks;
  }

  const mixKeyArr = [
    46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35, 27, 43, 5, 49,
    33, 9, 42, 19, 29, 28, 14, 39, 12, 38, 41, 13, 37, 48, 7, 16, 24, 55, 40,
    61, 26, 17, 0, 1, 60, 51, 30, 4, 22, 25, 54, 21, 56, 59, 6, 63, 57, 62, 11,
    36, 20, 34, 44, 52,
  ];

  function getMixKey(orig: string) {
    return mixKeyArr.map((n) => orig[n]).join('').slice(0, 32);
  }

  async function getWbiKeys() {
    const response = await fetch('https://api.bilibili.com/x/web-interface/nav', { credentials: 'omit' });
    const { data: { wbi_img: { img_url, sub_url } } } = await response.json();
    return {
      img_key: img_url.split('/').pop().split('.')[0],
      sub_key: sub_url.split('/').pop().split('.')[0],
    };
  }

  function signBilibiliParams(
    params: Record<string, string | number | boolean | null | undefined>,
    img_key: string,
    sub_key: string,
  ) {
    const mixed_key = getMixKey(img_key + sub_key);
    const curr_time = Math.round(Date.now() / 1000);
    const paramsWithWts: Record<string, string | number | boolean | null | undefined> = { ...params, wts: curr_time };
    
    // Bilibili WBI signing: Sort, Filter, URI Encode
    const chr_filter = /[!'()*]/g;
    const query = Object.keys(paramsWithWts)
      .sort()
      .map((key) => {
        const val = String(paramsWithWts[key]).replace(chr_filter, '');
        return `${encodeURIComponent(key)}=${encodeURIComponent(val)}`;
      })
      .join('&');

    const w_rid = md5(query + mixed_key);
    return query + '&w_rid=' + w_rid;
  }

  async function fetchYoutubePlaylistLinks(sourceUrl: string) {
    const response = await fetch(sourceUrl, {
      credentials: 'omit',
    });
    if (!response.ok) throw new Error('Failed to fetch YouTube playlist content.');

    const html = await response.text();
    // YouTube embeds video IDs and titles in JSON blocks (playlistVideoRenderer)
    const videoDataPattern = /"playlistVideoRenderer":\{"videoId":"([a-zA-Z0-9_-]{11})".*?"title":\{"runs":\[\{"text":"(.*?)"\}\]/g;
    const seen = new Set<string>();
    const links: { url: string; title: string }[] = [];

    for (const match of html.matchAll(videoDataPattern)) {
      if (links.length >= 50) break;
      const videoId = match[1];
      const title = match[2];
      const url = `https://www.youtube.com/watch?v=${videoId}`;
      if (!seen.has(url)) {
        seen.add(url);
        links.push({ url, title });
      }
    }

    if (links.length === 0) {
      // Fallback: try simple videoId search
      const videoIdPattern = /"videoId":"([a-zA-Z0-9_-]{11})"/g;
      for (const match of html.matchAll(videoIdPattern)) {
        if (links.length >= 50) break;
        const videoId = match[1];
        const url = `https://www.youtube.com/watch?v=${videoId}`;
        if (!seen.has(url)) {
          seen.add(url);
          links.push({ url, title: url });
        }
      }
    }

    if (links.length === 0) {
      // Fallback: try watch?v= pattern
      const watchPattern = /\/watch\?v=([a-zA-Z0-9_-]{11})/g;
      for (const match of html.matchAll(watchPattern)) {
        if (links.length >= 50) break;
        const videoId = match[1];
        const url = `https://www.youtube.com/watch?v=${videoId}`;
        if (!seen.has(url)) {
          seen.add(url);
          links.push({ url, title: url });
        }
      }
    }

    return links;
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

    const items = await Promise.all(urls.map(async (url) => {
      // YouTube requires a specialized structure [null, null, ..., [url]] for native playback
      if (url.includes('youtube.com') || url.includes('youtu.be')) {
        return [null, null, null, null, null, null, null, [url]];
      }
      
      // Bilibili: Attempt to resolve a "real" link using the mobile UA trick
      if (url.includes('bilibili.com/video/')) {
        const deepUrl = await resolveBilibiliRealUrl(url);
        // Use standard structure [null, null, [url]] for Bilibili to avoid "Transcript not available" error
        return [null, null, [deepUrl]];
      }

      return [null, null, [url]];
    }));

    const body = new URLSearchParams({
      'f.req': JSON.stringify([[['izAoDd', JSON.stringify([items, notebookId]), null, 'generic']]]),
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

  async function resolveBilibiliRealUrl(url: string): Promise<string> {
    try {
      // Mobile User-Agent trick to get a simpler page or direct playUrlInfo
      const mobileUA = 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/70.0.3538.25 Mobile Safari/537.36';
      const response = await fetch(url, {
        headers: { 'User-Agent': mobileUA }
      });
      if (!response.ok) return url;

      const html = await response.text();
      // Extract playUrlInfo if available (as per the Python script logic)
      const pattern = /"playUrlInfo"\s*:\s*\[\s*{(.*?)}\s*\]/s;
      const match = html.match(pattern);
      
      if (match) {
        try {
          const jsonStr = "{" + match[0] + "}";
          const cleaned = jsonStr.replace(/\\u002F/g, '/');
          const data = JSON.parse(cleaned);
          if (data.playUrlInfo?.[0]?.url) {
            console.log('[STN-Background] Bilibili real URL extracted:', data.playUrlInfo[0].url);
            // NOTE: Returning the CDN URL directly might trigger anti-hotlinking.
            // But this satisfies the user's request for the "real" link.
            return data.playUrlInfo[0].url;
          }
        } catch (e) {
          console.warn('[STN-Background] Failed to parse Bilibili playUrlInfo:', e);
        }
      }

      // Fallback: If no deep link, return the mobile-optimized URL which is easier for Google to scrape
      const bvid = url.match(/video\/(BV[a-zA-Z0-9]+)/)?.[1];
      if (bvid) return `https://m.bilibili.com/video/${bvid}`;
      
      return url;
    } catch (error) {
      console.warn('[STN-Background] resolveBilibiliRealUrl error:', error);
      return url;
    }
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
    const hrefPattern = /<a\s+[^>]*?href=["']([^"'#]+)["'][^>]*?>(.*?)<\/a>/gi;
    const links: { url: string; title: string }[] = [];
    const seen = new Set<string>();

    for (const match of html.matchAll(hrefPattern)) {
      const rawHref = String(match[1] || '').trim();
      const rawTitle = String(match[2] || '').replace(/<[^>]*>/g, '').trim();
      
      if (!rawHref || rawHref.startsWith('javascript:') || rawHref.startsWith('mailto:') || rawHref.startsWith('tel:')) {
        continue;
      }

      try {
        const resolved = new URL(rawHref, baseUrl).href;
        if (!resolved.startsWith('http://') && !resolved.startsWith('https://')) continue;
        if (seen.has(resolved)) continue;
        seen.add(resolved);
        links.push({ url: resolved, title: rawTitle || resolved });
        if (links.length >= 200) break;
      } catch {
        continue;
      }
    }

    return links;
  }
});
