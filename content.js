let currentLang = "zh";

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "collect-page-context") {
    return;
  }

  sendResponse(collectPageContext());
});

// Sync language from storage
async function initialize() {
  try {
    const result = await chrome.storage.local.get(["language"]);
    if (result.language) {
      currentLang = result.language;
    }
    bootInlineLauncher();
  } catch (error) {
    console.error("Failed to initialize launcher", error);
  }
}

initialize();

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.language) {
    currentLang = changes.language.newValue;
    // We might need to re-render or notify the shadow DOM if it's already mounted
    const root = document.getElementById("stn-inline-root");
    if (root && root.updateTranslations) {
      root.updateTranslations();
    }
  }
});

function t(key, params = {}) {
  const i18n = window.__STN_I18N__;
  if (!i18n) return key;
  return i18n.getTranslation(currentLang, key, params);
}

function collectPageContext() {
// ... (rest of the functions remain same until renderInlineLauncher)
  const selection = window.getSelection?.();
  const selectedText = selection ? selection.toString().trim() : "";
  const canonicalLink = document.querySelector('link[rel="canonical"]');
  const descriptionMeta = document.querySelector('meta[name="description"], meta[property="og:description"]');
  const authorMeta = document.querySelector('meta[name="author"], meta[property="article:author"]');
  const arxiv = detectArxivContext();
  const youtube = detectYouTubeContext();

  return {
    title: cleanText(document.title),
    url: location.href,
    canonicalUrl: canonicalLink?.href || location.href,
    description: cleanText(descriptionMeta?.content || ""),
    selectedText: cleanText(selectedText),
    byline: cleanText(authorMeta?.content || ""),
    arxiv,
    youtube
  };
}

function cleanText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function detectArxivContext() {
  const { hostname, pathname } = location;
  if (hostname !== "arxiv.org") {
    return null;
  }

  const absMatch = pathname.match(/^\/abs\/([^/?#]+)/);
  if (absMatch) {
    const paperId = absMatch[1];
    return {
      isArxiv: true,
      pageType: "abs",
      paperId,
      pdfUrl: `https://arxiv.org/pdf/${paperId}.pdf`
    };
  }

  const pdfMatch = pathname.match(/^\/pdf\/([^/?#]+?)(?:\.pdf)?$/);
  if (pdfMatch) {
    const paperId = pdfMatch[1];
    return {
      isArxiv: true,
      pageType: "pdf",
      paperId,
      pdfUrl: `https://arxiv.org/pdf/${paperId}.pdf`
    };
  }

  return {
    isArxiv: true,
    pageType: "other",
    paperId: "",
    pdfUrl: ""
  };
}

function detectYouTubeContext() {
  const { hostname, pathname, search } = location;
  const isYouTubeHost = hostname === "www.youtube.com" || hostname === "youtube.com" || hostname === "m.youtube.com" || hostname === "youtu.be";

  if (!isYouTubeHost) {
    return null;
  }

  if (hostname === "youtu.be") {
    const videoId = pathname.replace(/^\/+/, "").split("/")[0];
    if (!videoId) {
      return null;
    }
    return {
      isYouTube: true,
      pageType: "video",
      videoId,
      videoUrl: `https://www.youtube.com/watch?v=${videoId}`
    };
  }

  if (pathname === "/watch") {
    const params = new URLSearchParams(search);
    const videoId = params.get("v");
    if (!videoId) {
      return null;
    }
    return {
      isYouTube: true,
      pageType: "video",
      videoId,
      videoUrl: `https://www.youtube.com/watch?v=${videoId}`
    };
  }

  return {
    isYouTube: true,
    pageType: "other",
    videoId: "",
    videoUrl: ""
  };
}

function bootInlineLauncher() {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mountInlineLauncher, { once: true });
    return;
  }

  mountInlineLauncher();
}

function mountInlineLauncher() {
  const page = collectPageContext();
  if (page.arxiv?.pageType === "abs" || page.arxiv?.pageType === "pdf") {
    mountArxivLauncher(page);
    return;
  }

  if (page.youtube?.pageType === "video") {
    mountYouTubeLauncher(page);
  }
}

function mountArxivLauncher(page) {
  const anchor = document.querySelector('a[href*="/pdf/"]');
  if (!anchor || document.getElementById("stn-inline-root")) {
    return;
  }

  const root = document.createElement("div");
  root.id = "stn-inline-root";
  root.style.display = "inline-block";
  root.style.marginLeft = "8px";
  root.style.verticalAlign = "middle";
  anchor.insertAdjacentElement("afterend", root);
  renderInlineLauncher(root, page, { compact: true, host: "arxiv" });
}

function mountYouTubeLauncher(page) {
  const tryMount = () => {
    const actionRow = document.querySelector("ytd-watch-metadata #top-level-buttons-computed, ytd-watch-metadata #menu");
    if (!actionRow || document.getElementById("stn-inline-root")) {
      return Boolean(document.getElementById("stn-inline-root"));
    }

    const downloadButton = findYouTubeDownloadButton(actionRow);
    if (!downloadButton) {
      return false;
    }

    const root = document.createElement("div");
    root.id = "stn-inline-root";
    root.style.display = "block";
    root.style.width = "fit-content";
    root.style.marginTop = "8px";

    const wrapper = document.createElement("div");
    wrapper.style.position = "relative";
    wrapper.style.width = "100%";
    wrapper.appendChild(root);

    actionRow.insertAdjacentElement("afterend", wrapper);
    renderInlineLauncher(root, page, { compact: true, host: "youtube" });
    alignYouTubeLauncher(root, actionRow, downloadButton);

    const realign = () => alignYouTubeLauncher(root, actionRow, downloadButton);
    window.addEventListener("resize", realign);

    return true;
  };

  if (tryMount()) {
    return;
  }

  const observer = new MutationObserver(() => {
    if (tryMount()) {
      observer.disconnect();
    }
  });

  observer.observe(document.documentElement, { childList: true, subtree: true });
  setTimeout(() => observer.disconnect(), 10000);
}

function findYouTubeDownloadButton(actionRow) {
  const candidates = actionRow.querySelectorAll('button, yt-button-view-model, tp-yt-paper-button, button-view-model');
  for (const candidate of candidates) {
    const text = cleanText(candidate.textContent || "");
    const aria = cleanText(candidate.getAttribute?.("aria-label") || "");
    if (/\bdownload\b/i.test(text) || /\bdownload\b/i.test(aria)) {
      return candidate;
    }
  }
  return null;
}

function alignYouTubeLauncher(root, actionRow, downloadButton) {
  const rowRect = actionRow.getBoundingClientRect();
  const buttonRect = downloadButton.getBoundingClientRect();
  const wrapper = root.parentElement;
  const preferredLeft = Math.max(0, buttonRect.left - rowRect.left);
  const availableWidth = wrapper?.clientWidth || actionRow.clientWidth || rowRect.width;
  const rootWidth = root.offsetWidth || 0;
  const maxLeft = Math.max(0, availableWidth - rootWidth);
  const safeLeft = Math.min(preferredLeft, maxLeft);
  root.style.marginLeft = `${safeLeft}px`;
}

function renderInlineLauncher(root, page, options) {
  const shadow = root.attachShadow({ mode: "open" });
  const sourceUrl = page.arxiv?.pdfUrl || page.youtube?.videoUrl || page.canonicalUrl || page.url;
  const sourceLabel = page.arxiv?.pdfUrl ? t("type_pdf") : t("type_video");
  const isYouTube = options.host === "youtube";
  const isArxiv = options.host === "arxiv";

  const render = () => {
    const label = page.arxiv?.pdfUrl ? t("type_pdf") : page.youtube?.videoUrl ? t("type_video") : t("type_notebook");
    const currentSourceLabel = page.arxiv?.pdfUrl ? t("type_pdf") : t("type_video");

    shadow.innerHTML = `
      <style>
        :host {
          all: initial;
        }

        .wrap {
          font-family: "Avenir Next", "Segoe UI", sans-serif;
          color: #1c160f;
          display: inline-block;
          max-width: 100%;
          position: relative;
        }

        .card {
          ${isYouTube
            ? "border: 1px solid rgba(0,0,0,0.08); border-radius: 18px; background: rgba(255,255,255,0.96); box-shadow: 0 2px 8px rgba(0,0,0,0.08); padding: 4px;"
            : "border: 1px solid rgba(53, 37, 18, 0.12); border-radius: 999px; background: #fffaf3; box-shadow: 0 4px 14px rgba(67,44,12,0.08); padding: 3px;"}
          display: inline-block;
        }

        .topline {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .brand {
          display: flex;
          align-items: center;
          gap: 6px;
          min-width: 0;
        }

        .logo {
          width: ${isYouTube ? "18px" : "16px"};
          height: ${isYouTube ? "18px" : "16px"};
          border-radius: ${isYouTube ? "6px" : "5px"};
          background-image: url('${chrome.runtime.getURL("assets/icon48.png")}');
          background-size: cover;
          background-position: center;
          box-shadow: 0 4px 10px rgba(0,0,0,0.18);
        }

        .eyebrow {
          display: none;
          font-size: 9px;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: #7a6a59;
          font-weight: 700;
        }

        .title {
          font-size: ${isYouTube ? "12px" : "11px"};
          font-weight: 700;
          line-height: 1.1;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .toggle {
          height: ${isYouTube ? "28px" : "24px"};
          padding: 0 10px;
          border-radius: ${isYouTube ? "14px" : "999px"};
          border: 1px solid ${isYouTube ? "rgba(0,0,0,0.1)" : "rgba(53, 37, 18, 0.12)"};
          background: ${isYouTube ? "#f2f2f2" : "rgba(255,255,255,0.88)"};
          cursor: pointer;
          font: inherit;
          color: ${isYouTube ? "#0f0f0f" : "#1c160f"};
          font-size: 11px;
          font-weight: 600;
          flex-shrink: 0;
        }

        .panel {
          margin-top: 8px;
          display: none;
          position: absolute;
          z-index: 2147483647;
          ${isArxiv ? "left: 0; right: auto;" : "right: 0;"}
          top: 100%;
          min-width: ${isYouTube ? "280px" : "260px"};
          max-width: 320px;
          border: 1px solid rgba(53, 37, 18, 0.12);
          border-radius: 16px;
          background: linear-gradient(135deg, rgba(255,248,237,0.98), rgba(255,235,212,0.96));
          box-shadow: 0 16px 30px rgba(67, 44, 12, 0.18);
          padding: 12px;
        }

        .panel.open {
          display: block;
        }

        .primary, .secondary, .ghost, select {
          font: inherit;
        }

        .primary, .secondary, .ghost {
          border: 0;
          cursor: pointer;
          min-height: ${isYouTube ? "34px" : "32px"};
          border-radius: ${isYouTube ? "17px" : "10px"};
          padding: 0 12px;
          font-size: 12px;
        }

        .primary {
          background: linear-gradient(135deg, #e66d3d, #bf4d1f);
          color: white;
          font-weight: 700;
          box-shadow: 0 8px 16px rgba(191,77,31,0.18);
        }

        .secondary {
          background: ${isYouTube ? "#0f0f0f" : "#1c160f"};
          color: white;
          font-weight: 700;
        }

        .ghost {
          background: ${isYouTube ? "#f2f2f2" : "rgba(255,255,255,0.82)"};
          border: 1px solid ${isYouTube ? "rgba(0,0,0,0.1)" : "rgba(53, 37, 18, 0.12)"};
          color: ${isYouTube ? "#0f0f0f" : "#1c160f"};
          font-weight: 600;
        }

        .hint {
          margin: 0 0 10px;
          font-size: 11px;
          line-height: 1.35;
          color: #6f6253;
        }

        .row {
          display: flex;
          gap: 10px;
          align-items: center;
        }

        .row + .row {
          margin-top: 10px;
        }

        .grow {
          flex: 1;
        }

        select {
          width: 100%;
          height: 34px;
          border-radius: ${isYouTube ? "12px" : "10px"};
          border: 1px solid ${isYouTube ? "rgba(0,0,0,0.12)" : "rgba(53, 37, 18, 0.12)"};
          background: rgba(255,255,255,0.92);
          padding: 0 12px;
          color: #1c160f;
          font-size: 12px;
        }

        .status {
          margin-top: 10px;
          min-height: 18px;
          font-size: 12px;
          color: #6f6253;
        }

        .status.error {
          color: #9a2f23;
        }

        .status.success {
          color: #246a4b;
        }

        .existing {
          display: none;
        }

        .existing.open {
          display: block;
        }
      </style>
      <div class="wrap">
        <div class="card">
          <div class="topline">
            <div class="brand">
              <div class="logo"></div>
              <div>
                <div class="eyebrow">${isArxiv ? "ArXiv" : isYouTube ? "YouTube" : t("type_notebook")}</div>
                <div class="title">${t("hero_title")}</div>
              </div>
            </div>
            <button class="toggle" type="button">${panelOpen ? t("btn_hide") : t("btn_save")}</button>
          </div>
          <div class="panel ${panelOpen ? "open" : ""}">
            <p class="hint">${t("inline_hint", { type: currentSourceLabel })}</p>
            <div class="row">
              <button class="primary grow" type="button">${t("btn_create")}</button>
              <button class="ghost auth" type="button">${t("btn_authorize")}</button>
            </div>
            <div class="row">
              <button class="ghost existing-toggle grow" type="button">${existingOpen ? t("btn_hide_existing") : t("btn_add_to_existing")}</button>
            </div>
            <div class="existing ${existingOpen ? "open" : ""}">
              <div class="row">
                <select class="grow notebook-select"></select>
              </div>
              <div class="row">
                <button class="ghost refresh" type="button">${t("btn_refresh")}</button>
                <button class="secondary grow add-existing" type="button">${t("btn_add")}</button>
              </div>
            </div>
            <div class="status"></div>
          </div>
        </div>
      </div>
    `;

    // Re-wire events after re-render
    wireEvents();
    if (notebooks.length) {
      renderNotebookOptions();
    }
    if (currentStatus) {
      setStatus(currentStatus.message, currentStatus.tone);
    }
  };

  let panelOpen = false;
  let existingOpen = false;
  let notebooks = [];
  let selectedNotebookId = "";
  let currentStatus = null;

  const wireEvents = () => {
    const toggle = shadow.querySelector(".toggle");
    const panel = shadow.querySelector(".panel");
    const createButton = shadow.querySelector(".primary");
    const authorizeButton = shadow.querySelector(".auth");
    const existingToggle = shadow.querySelector(".existing-toggle");
    const existingPanel = shadow.querySelector(".existing");
    const notebookSelect = shadow.querySelector(".notebook-select");
    const refreshButton = shadow.querySelector(".refresh");
    const addExistingButton = shadow.querySelector(".add-existing");

    toggle?.addEventListener("click", async () => {
      panelOpen = !panelOpen;
      panel?.classList.toggle("open", panelOpen);
      toggle.textContent = panelOpen ? t("btn_hide") : t("btn_save");
      if (panelOpen && notebooks.length === 0) {
        await loadNotebooks();
      }
    });

    createButton?.addEventListener("click", async () => {
      setStatus(t("status_importing_arxiv")); // Using arxiv as generic for create-and-send
      try {
        const response = await chrome.runtime.sendMessage({
          type: "create-notebook-and-send",
          urls: [sourceUrl]
        });
        if (!response.ok) {
          throw new Error(response.error || t("status_create_failed"));
        }
        setStatus(t("status_imported_opening"), "success");
        window.open(response.notebookUrl, "_blank", "noopener,noreferrer");
      } catch (error) {
        setStatus(error.message, "error");
      }
    });

    authorizeButton?.addEventListener("click", async () => {
      await chrome.runtime.sendMessage({ type: "open-notebooklm" });
    });

    existingToggle?.addEventListener("click", async () => {
      existingOpen = !existingOpen;
      existingPanel?.classList.toggle("open", existingOpen);
      existingToggle.textContent = existingOpen ? t("btn_hide_existing") : t("btn_add_to_existing");
      if (existingOpen && notebooks.length === 0) {
        await loadNotebooks();
      }
    });

    refreshButton?.addEventListener("click", loadNotebooks);

    notebookSelect?.addEventListener("change", async (event) => {
      selectedNotebookId = event.target.value;
      await chrome.runtime.sendMessage({
        type: "save-selected-notebook",
        notebookId: selectedNotebookId
      });
    });

    addExistingButton?.addEventListener("click", async () => {
      if (!selectedNotebookId) {
        setStatus(t("status_choose_existing"), "error");
        return;
      }

      setStatus(page.arxiv?.pdfUrl ? t("status_adding_arxiv") : t("status_adding_youtube"));
      try {
        const response = await chrome.runtime.sendMessage({
          type: "send-to-notebook",
          notebookId: selectedNotebookId,
          urls: [sourceUrl]
        });
        if (!response.ok) {
          throw new Error(response.error || t("status_send_failed"));
        }
        setStatus(t("status_added_opening"), "success");
        window.open(response.notebookUrl, "_blank", "noopener,noreferrer");
      } catch (error) {
        setStatus(error.message, "error");
      }
    });
  };

  async function loadNotebooks() {
    setStatus(t("status_fetching_notebooks"));
    try {
      const response = await chrome.runtime.sendMessage({ type: "fetch-notebooks" });
      if (!response.ok) {
        throw new Error(response.error || t("status_fetch_failed"));
      }
      notebooks = response.notebooks || [];
      const saved = await chrome.storage.local.get("selectedNotebookId");
      selectedNotebookId = saved.selectedNotebookId || notebooks[0]?.id || "";
      renderNotebookOptions();
      setStatus(notebooks.length ? t("status_ready") : t("no_notebooks"));
    } catch (error) {
      setStatus(error.message, "error");
    }
  }

  function renderNotebookOptions() {
    const notebookSelect = shadow.querySelector(".notebook-select");
    if (!notebookSelect) return;
    notebookSelect.innerHTML = "";
    if (!notebooks.length) {
      const option = document.createElement("option");
      option.value = "";
      option.textContent = t("no_notebooks");
      notebookSelect.append(option);
      return;
    }

    for (const notebook of notebooks) {
      const option = document.createElement("option");
      option.value = notebook.id;
      option.textContent = `${notebook.emoji} ${notebook.name} (${notebook.sources})`;
      notebookSelect.append(option);
    }
    notebookSelect.value = selectedNotebookId;
  }

  function setStatus(message, tone = "") {
    currentStatus = { message, tone };
    const status = shadow.querySelector(".status");
    if (!status) return;
    status.textContent = message;
    status.className = `status${tone ? ` ${tone}` : ""}`;
  }

  root.updateTranslations = () => {
    render();
  };

  render();
}
