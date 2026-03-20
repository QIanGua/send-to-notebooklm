const NOTEBOOKLM_ORIGIN = "https://notebooklm.google.com";
const STORAGE_KEYS = {
  selectedNotebookId: "selectedNotebookId"
};

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: "send-page",
      title: "Send page to NotebookLM",
      contexts: ["page"]
    });
    chrome.contextMenus.create({
      id: "send-link",
      title: "Send link to NotebookLM",
      contexts: ["link"]
    });
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  const targetUrl = info.menuItemId === "send-link" ? info.linkUrl : info.pageUrl;
  const title = info.selectionText || tab?.title || targetUrl;

  if (!targetUrl) {
    return;
  }

  try {
    let notebookId = await getSavedNotebookId();
    if (!notebookId) {
      notebookId = (await fetchNotebooks())[0]?.id || "";
    }
    if (!notebookId) {
      await chrome.tabs.create({ url: chrome.runtime.getURL("popup.html") });
      return;
    }

    await addSourcesToNotebook(notebookId, [targetUrl]);
    await chrome.tabs.create({
      url: `${NOTEBOOKLM_ORIGIN}/notebook/${notebookId}`
    });
  } catch (error) {
    console.error("Context menu send failed", { targetUrl, title, error });
    await chrome.tabs.create({
      url: `${NOTEBOOKLM_ORIGIN}/`
    });
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender)
    .then((result) => sendResponse(result))
    .catch((error) => {
      console.error("Message handling failed", { message, error });
      sendResponse({
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error"
      });
    });

  return true;
});

async function handleMessage(message, sender) {
  switch (message?.type) {
    case "get-page-context":
      return getPageContext(message.tabId, sender.tab);
    case "fetch-notebooks":
      return {
        ok: true,
        notebooks: await fetchNotebooks()
      };
    case "create-notebook": {
      const notebookId = await createNotebook();
      return {
        ok: true,
        notebookId
      };
    }
    case "save-selected-notebook":
      await chrome.storage.local.set({
        [STORAGE_KEYS.selectedNotebookId]: message.notebookId || ""
      });
      return { ok: true };
    case "send-to-notebook": {
      const notebookId = message.notebookId;
      const urls = Array.isArray(message.urls) ? sanitizeUrls(message.urls) : [];

      if (!notebookId) {
        throw new Error("Please choose a notebook first.");
      }
      if (urls.length === 0) {
        throw new Error("No valid URL found on this page.");
      }

      await addSourcesToNotebook(notebookId, urls);
      await chrome.storage.local.set({
        [STORAGE_KEYS.selectedNotebookId]: notebookId
      });

      return {
        ok: true,
        notebookUrl: `${NOTEBOOKLM_ORIGIN}/notebook/${notebookId}`
      };
    }
    case "create-notebook-and-send": {
      const urls = Array.isArray(message.urls) ? sanitizeUrls(message.urls) : [];
      if (urls.length === 0) {
        throw new Error("No valid source URL found for this page.");
      }

      const notebookId = await createNotebook();
      await addSourcesToNotebook(notebookId, urls);
      await chrome.storage.local.set({
        [STORAGE_KEYS.selectedNotebookId]: notebookId
      });

      return {
        ok: true,
        notebookId,
        notebookUrl: `${NOTEBOOKLM_ORIGIN}/notebook/${notebookId}`
      };
    }
    case "open-notebooklm":
      await chrome.tabs.create({ url: NOTEBOOKLM_ORIGIN });
      return { ok: true };
    default:
      throw new Error("Unsupported request.");
  }
}

async function getPageContext(tabId, senderTab) {
  const fallback = {
    title: senderTab?.title || "",
    url: senderTab?.url || "",
    description: "",
    selectedText: "",
    canonicalUrl: senderTab?.url || "",
    byline: "",
    arxiv: null
  };

  if (!tabId) {
    return { ok: true, page: fallback };
  }

  try {
    const response = await chrome.tabs.sendMessage(tabId, {
      type: "collect-page-context"
    });

    return {
      ok: true,
      page: {
        ...fallback,
        ...(response || {})
      }
    };
  } catch {
    return { ok: true, page: fallback };
  }
}

function extractToken(key, html) {
  const match = new RegExp(`"${key}":"([^"]+)"`).exec(html);
  return match ? match[1] : "";
}

async function fetchNotebookTokens() {
  let response;
  try {
    response = await fetch(`${NOTEBOOKLM_ORIGIN}/`, { redirect: "error" });
  } catch {
    throw new Error("Open NotebookLM once in this browser to authorize the extension.");
  }

  if (!response.ok) {
    throw new Error("Open NotebookLM once in this browser to authorize the extension.");
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
  const params = new URLSearchParams({
    rpcids: "wXbhsf",
    "source-path": "/",
    bl: buildLabel,
    _reqid: `${Math.floor(Math.random() * 900000) + 100000}`,
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
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body
  });

  if (!response.ok) {
    throw new Error("Could not fetch notebooks from NotebookLM.");
  }

  const text = await response.text();
  const parsed = parseBatchExecutePayload(text);

  return (parsed || [])
    .filter((entry) => entry && entry.length >= 6 && !(Array.isArray(entry[5]) && entry[5][0] === 3))
    .map((entry) => ({
      id: entry[2],
      name: entry[0]?.trim() || "Untitled notebook",
      sources: entry[1]?.length || 0,
      emoji: entry[3] || "Notebook"
    }));
}

async function createNotebook() {
  const { buildLabel, at } = await fetchNotebookTokens();
  const params = new URLSearchParams({
    rpcids: "CCqFvf",
    "source-path": "/",
    bl: buildLabel,
    _reqid: `${Math.floor(Math.random() * 900000) + 100000}`,
    rt: "c"
  });
  const body = new URLSearchParams({
    "f.req": JSON.stringify([
      [["CCqFvf", JSON.stringify([null]), null, "generic"]]
    ]),
    at
  });

  const response = await fetch(`${NOTEBOOKLM_ORIGIN}/_/LabsTailwindUi/data/batchexecute?${params}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body
  });

  if (!response.ok) {
    throw new Error("Could not create a new notebook.");
  }

  const text = await response.text();
  const match = text.match(/\b[0-9a-fA-F-]{36}\b/);
  if (!match) {
    throw new Error("Notebook created, but the new notebook ID could not be read.");
  }

  return match[0];
}

async function addSourcesToNotebook(notebookId, urls) {
  const { buildLabel, at } = await fetchNotebookTokens();
  const params = new URLSearchParams({
    rpcids: "izAoDd",
    "source-path": `/notebook/${notebookId}`,
    bl: buildLabel,
    _reqid: `${Math.floor(Math.random() * 900000) + 100000}`,
    rt: "c"
  });
  const sources = urls.map((url) => [null, null, [url]]);
  const body = new URLSearchParams({
    "f.req": JSON.stringify([
      [["izAoDd", JSON.stringify([sources, notebookId]), null, "generic"]]
    ]),
    at
  });

  const response = await fetch(`${NOTEBOOKLM_ORIGIN}/_/LabsTailwindUi/data/batchexecute?${params}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body
  });

  if (!response.ok) {
    throw new Error("NotebookLM rejected the source import request.");
  }
}

function parseBatchExecutePayload(text) {
  const payloadLine = text.split("\n")[3];
  if (!payloadLine) {
    throw new Error("NotebookLM returned an unexpected response.");
  }

  try {
    return JSON.parse(JSON.parse(payloadLine)[0][2])[0];
  } catch {
    throw new Error("Could not parse NotebookLM data.");
  }
}

async function getSavedNotebookId() {
  const saved = await chrome.storage.local.get(STORAGE_KEYS.selectedNotebookId);
  return saved[STORAGE_KEYS.selectedNotebookId] || "";
}

function sanitizeUrls(urls) {
  return [...new Set(
    urls
      .map((value) => (typeof value === "string" ? value.trim() : ""))
      .filter((value) => value.startsWith("https://") || value.startsWith("http://"))
  )];
}
