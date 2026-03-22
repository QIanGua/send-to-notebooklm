export default defineBackground(() => {
  const NOTEBOOKLM_ORIGIN = "https://notebooklm.google.com";
  const STORAGE_KEYS = {
    selectedNotebookId: "selectedNotebookId"
  };

  console.log("[STN-Background] Loaded. Version: 2.0.2");

  // 1. Context Menu Setup
  browser.runtime.onInstalled.addListener(() => {
    browser.contextMenus.removeAll().then(() => {
      browser.contextMenus.create({
        id: "send-page",
        title: "Send page to NotebookLM",
        contexts: ["page"]
      });
      browser.contextMenus.create({
        id: "send-link",
        title: "Send link to NotebookLM",
        contexts: ["link"]
      });
    });
  });

  browser.contextMenus.onClicked.addListener(async (info, tab) => {
    const targetUrl = info.menuItemId === "send-link" ? info.linkUrl : info.pageUrl;
    if (!targetUrl) return;

    try {
      let notebookId = await getSavedNotebookId();
      if (!notebookId) {
        const notebooks = await fetchNotebooks();
        notebookId = notebooks[0]?.id || "";
      }
      if (!notebookId) {
        browser.tabs.create({ url: browser.runtime.getURL("/popup.html") });
        return;
      }

      await addSourcesToNotebook(notebookId, [targetUrl]);
      browser.tabs.create({
        url: `${NOTEBOOKLM_ORIGIN}/notebook/${notebookId}`
      });
    } catch (error) {
      console.error("[STN-Background] Context menu error:", error);
      browser.tabs.create({
        url: NOTEBOOKLM_ORIGIN
      });
    }
  });

  // 2. Message Handling
  browser.runtime.onMessage.addListener((message: any, sender, sendResponse) => {
    handleMessage(message, sender)
      .then((result) => {
        sendResponse(result);
      })
      .catch((error) => {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`[STN-Background] Message handling failed [${message?.type}]:`, errorMessage, error);
        sendResponse({
          ok: false,
          error: errorMessage
        });
      });
    return true;
  });

  async function handleMessage(message: any, sender: any) {
    if (!message) throw new Error("Received empty message.");
    
    switch (message.type) {
      case "get-page-context":
        return getPageContext(message.tabId, sender.tab);
      case "fetch-notebooks":
        const nbs = await fetchNotebooks();
        return { ok: true, notebooks: nbs };
      case "create-notebook": {
        const notebookId = await createNotebook();
        return { ok: true, notebookId };
      }
      case "save-selected-notebook":
        await browser.storage.local.set({
          [STORAGE_KEYS.selectedNotebookId]: message.notebookId || ""
        });
        return { ok: true };
      case "send-to-notebook": {
        const { notebookId, urls } = message;
        const sanitized = Array.isArray(urls) ? sanitizeUrls(urls) : [];
        if (!notebookId) throw new Error("No notebook selected.");
        if (sanitized.length === 0) throw new Error("No valid source URLs provided.");
        await addSourcesToNotebook(notebookId, sanitized);
        await browser.storage.local.set({ [STORAGE_KEYS.selectedNotebookId]: notebookId });
        return { ok: true, notebookUrl: `${NOTEBOOKLM_ORIGIN}/notebook/${notebookId}` };
      }
      case "create-notebook-and-send": {
        const sanitized = Array.isArray(message.urls) ? sanitizeUrls(message.urls) : [];
        if (sanitized.length === 0) throw new Error("No valid source URLs provided.");
        const notebookId = await createNotebook();
        await addSourcesToNotebook(notebookId, sanitized);
        await browser.storage.local.set({ [STORAGE_KEYS.selectedNotebookId]: notebookId });
        return { ok: true, notebookId, notebookUrl: `${NOTEBOOKLM_ORIGIN}/notebook/${notebookId}` };
      }
      case "open-notebooklm":
        browser.tabs.create({ url: NOTEBOOKLM_ORIGIN });
        return { ok: true };
      default:
        throw new Error(`Unknown message type: ${message.type}`);
    }
  }

  // --- Helpers ---
  async function getPageContext(tabId: number | undefined, senderTab: any) {
    const fallback = {
      title: senderTab?.title || "",
      url: senderTab?.url || "",
      description: "",
      selectedText: "",
      canonicalUrl: senderTab?.url || "",
      byline: "",
      arxiv: null,
      youtube: null
    };

    if (!tabId) return { ok: true, page: fallback };

    try {
      const response = await browser.tabs.sendMessage(tabId, { type: "collect-page-context" });
      return { ok: true, page: { ...fallback, ...(response || {}) } };
    } catch (e) {
      console.warn("[STN-Background] Could not communicate with content script:", e);
      return { ok: true, page: fallback };
    }
  }

  function extractToken(key: string, html: string) {
    const regex = new RegExp(`"${key}":"([^"]+)"`);
    const match = regex.exec(html);
    return match ? match[1] : "";
  }

  async function fetchNotebookTokens() {
    let response;
    try {
      response = await fetch(`${NOTEBOOKLM_ORIGIN}/`, { redirect: "error", credentials: "include" });
    } catch (e) {
      throw new Error("Please open NotebookLM in this browser and sign in first.");
    }

    if (!response.ok) {
        throw new Error("Please open NotebookLM in this browser and sign in first.");
    }

    const html = await response.text();
    const buildLabel = extractToken("cfb2h", html);
    const at = extractToken("SNlM0e", html);

    if (!buildLabel || !at) {
        throw new Error("NotebookLM session not detected. Open NotebookLM and sign in first.");
    }

    return { buildLabel, at };
  }

  async function fetchNotebooks() {
    const { buildLabel, at } = await fetchNotebookTokens();
    console.log("[STN-Background] Fetching notebooks with buildLabel:", buildLabel);
    const params = new URLSearchParams({
      rpcids: "wXbhsf",
      "source-path": "/",
      bl: buildLabel,
      _reqid: String(Math.floor(Math.random() * 900000) + 100000),
      rt: "c"
    });
    const body = new URLSearchParams({
      "f.req": JSON.stringify([
        [["wXbhsf", JSON.stringify([null, 1, null, [2]]), null, "generic"]]
      ]),
      at
    });

    const response = await fetch(`${NOTEBOOKLM_ORIGIN}/_/LabsTailwindUi/data/batchexecute?${params}`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      credentials: "include",
      body
    });

    if (!response.ok) throw new Error(`Fetch notebooks failed: ${response.statusText}`);

    const text = await response.text();
    console.log("[STN-Background] batchexecute response length:", text.length);
    const parsed = parseBatchExecutePayload(text);
    if (!parsed) {
      console.warn("[STN-Background] Could not parse notebook list from response");
      return [];
    }

    console.log("[STN-Background] Parsed entries:", parsed.length);
    const notebooks = parsed
      .filter((entry: any) => entry && entry.length >= 3)
      .filter((entry: any) => !(Array.isArray(entry[5]) && entry[5][0] === 3))
      .map((entry: any) => ({
        id: entry[2],
        name: entry[0]?.trim() || "Untitled notebook",
        sources: Array.isArray(entry[1]) ? entry[1].length : 0,
        emoji: entry[3] || "📓"
      }));
    console.log("[STN-Background] Filtered notebooks:", notebooks.length);
    return notebooks;
  }

  async function createNotebook() {
    const { buildLabel, at } = await fetchNotebookTokens();
    const params = new URLSearchParams({
      rpcids: "CCqFvf",
      "source-path": "/",
      bl: buildLabel,
      _reqid: String(Math.floor(Math.random() * 900000) + 100000),
      rt: "c"
    });
    const body = new URLSearchParams({
      "f.req": JSON.stringify([[["CCqFvf", JSON.stringify([null]), null, "generic"]]]),
      at
    });

    const response = await fetch(`${NOTEBOOKLM_ORIGIN}/_/LabsTailwindUi/data/batchexecute?${params}`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      credentials: "include",
      body
    });

    if (!response.ok) throw new Error(`Create notebook failed: ${response.statusText}`);
    const text = await response.text();
    const match = text.match(/\b[0-9a-fA-F-]{36}\b/);
    if (!match) throw new Error("Notebook created but ID extraction failed.");
    return match[0];
  }

  async function addSourcesToNotebook(notebookId: string, urls: string[]) {
    const { buildLabel, at } = await fetchNotebookTokens();
    const params = new URLSearchParams({
      rpcids: "izAoDd",
      "source-path": `/notebook/${notebookId}`,
      bl: buildLabel,
      _reqid: String(Math.floor(Math.random() * 900000) + 100000),
      rt: "c"
    });
    const sources = urls.map((url) => [null, null, [url]]);
    const body = new URLSearchParams({
      "f.req": JSON.stringify([[["izAoDd", JSON.stringify([sources, notebookId]), null, "generic"]]]),
      at
    });

    const response = await fetch(`${NOTEBOOKLM_ORIGIN}/_/LabsTailwindUi/data/batchexecute?${params}`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      credentials: "include",
      body
    });

    if (!response.ok) throw new Error(`Source import failed: ${response.statusText}`);
  }

  function parseBatchExecutePayload(text: string) {
    try {
      // Legacy approach: payload is on the 4th line (index 3)
      const payloadLine = text.split("\n")[3];
      if (!payloadLine) {
        console.error("[STN-Background] No payload line found at index 3");
        return null;
      }
      return JSON.parse(JSON.parse(payloadLine)[0][2])[0];
    } catch (e) {
      // Fallback: search for line containing wXbhsf
      try {
        const lines = text.split("\n");
        const found = lines.find(line => line.includes('["wXbhsf"'));
        if (!found) {
          console.error("[STN-Background] No wXbhsf line found in response");
          return null;
        }
        const outerArr = JSON.parse(found);
        return JSON.parse(outerArr[0][2])[0];
      } catch (e2) {
        console.error("[STN-Background] Payload parse error:", e2);
        return null;
      }
    }
  }

  async function getSavedNotebookId(): Promise<string> {
    const saved = await browser.storage.local.get(STORAGE_KEYS.selectedNotebookId);
    return (saved[STORAGE_KEYS.selectedNotebookId] as string) || "";
  }

  function sanitizeUrls(urls: string[]) {
    return Array.from(new Set(
      urls
        .filter(u => typeof u === "string" && u.length > 10)
        .map(u => u.trim())
        .filter(u => u.startsWith("https://") || u.startsWith("http://"))
    ));
  }
});
