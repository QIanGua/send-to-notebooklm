const { getTranslation } = window.__STN_I18N__;

const state = {
  page: null,
  notebooks: [],
  selectedNotebookId: "",
  sending: false,
  showExistingNotebookPanel: false,
  language: "zh",
  showSettings: false
};

const elements = {
  modeBadge: document.getElementById("modeBadge"),
  pageTitle: document.getElementById("pageTitle"),
  pageMeta: document.getElementById("pageMeta"),
  pageDescription: document.getElementById("pageDescription"),
  selectionWrap: document.getElementById("selectionWrap"),
  selectedText: document.getElementById("selectedText"),
  targetCard: document.getElementById("targetCard"),
  arxivExistingCard: document.getElementById("arxivExistingCard"),
  existingNotebookPanel: document.getElementById("existingNotebookPanel"),
  toggleExistingBtn: document.getElementById("toggleExistingBtn"),
  notebookField: document.getElementById("notebookField"),
  notebookSelect: document.getElementById("notebookSelect"),
  arxivNotebookSelect: document.getElementById("arxivNotebookSelect"),
  status: document.getElementById("status"),
  refreshBtn: document.getElementById("refreshBtn"),
  arxivRefreshBtn: document.getElementById("arxivRefreshBtn"),
  createNotebookBtn: document.getElementById("createNotebookBtn"),
  openNotebookLmBtn: document.getElementById("openNotebookLmBtn"),
  quickAuthorizeBtn: document.getElementById("quickAuthorizeBtn"),
  addToExistingBtn: document.getElementById("addToExistingBtn"),
  sendBtn: document.getElementById("sendBtn"),
  openPageBtn: document.getElementById("openPageBtn"),
  sendHint: document.getElementById("sendHint"),
  sendLabel: document.getElementById("sendLabel"),
  settingsToggle: document.getElementById("settingsToggle"),
  settingsPanel: document.getElementById("settingsPanel"),
  languageSelect: document.getElementById("languageSelect")
};

boot();

async function boot() {
  wireEvents();
  const saved = await chrome.storage.local.get(["language"]);
  state.language = saved.language || "zh";
  elements.languageSelect.value = state.language;
  
  applyTranslations();
  setStatus(t("status_loading"));
  await Promise.all([loadPageContext(), loadNotebooks()]);
  setStatus(t("status_ready"));
}

function t(key, params = {}) {
  return getTranslation(state.language, key, params);
}

function applyTranslations() {
  const i18nElements = document.querySelectorAll("[data-i18n]");
  i18nElements.forEach(el => {
    const key = el.getAttribute("data-i18n");
    el.textContent = t(key);
  });
}

function wireEvents() {
  elements.refreshBtn.addEventListener("click", loadNotebooks);
  elements.arxivRefreshBtn.addEventListener("click", loadNotebooks);
  elements.createNotebookBtn.addEventListener("click", createNotebookAndSelect);
  elements.openNotebookLmBtn.addEventListener("click", () => sendMessage({ type: "open-notebooklm" }));
  elements.quickAuthorizeBtn.addEventListener("click", () => sendMessage({ type: "open-notebooklm" }));
  elements.sendBtn.addEventListener("click", sendCurrentPage);
  elements.addToExistingBtn.addEventListener("click", sendArxivPdfToExistingNotebook);
  elements.openPageBtn.addEventListener("click", openCurrentPage);
  elements.toggleExistingBtn.addEventListener("click", toggleExistingNotebookPanel);
  
  elements.settingsToggle.addEventListener("click", () => {
    state.showSettings = !state.showSettings;
    elements.settingsPanel.classList.toggle("hidden", !state.showSettings);
  });

  elements.languageSelect.addEventListener("change", async (event) => {
    state.language = event.target.value;
    await chrome.storage.local.set({ language: state.language });
    applyTranslations();
    renderPage(); // Update dynamic descriptions
    renderNotebooks(); // Update "No notebooks" text
    if (state.page?.arxiv?.pdfUrl || state.page?.youtube?.videoUrl) {
      renderMode(state.page); // Refresh labels like "Create New" vs "Send page"
    }
  });

  elements.notebookSelect.addEventListener("change", async (event) => {
    state.selectedNotebookId = event.target.value;
    await sendMessage({
      type: "save-selected-notebook",
      notebookId: state.selectedNotebookId
    });
  });
  elements.arxivNotebookSelect.addEventListener("change", async (event) => {
    state.selectedNotebookId = event.target.value;
    syncNotebookSelects();
    await sendMessage({
      type: "save-selected-notebook",
      notebookId: state.selectedNotebookId
    });
  });
}

async function loadPageContext() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const response = await sendMessage({
    type: "get-page-context",
    tabId: tab?.id
  });

  if (!response.ok) {
    throw new Error(response.error || t("status_fetch_failed"));
  }

  state.page = response.page;
  renderPage();
}

async function loadNotebooks() {
  toggleBusy(true);
  setStatus(t("status_fetching_notebooks"));

  try {
    const response = await sendMessage({ type: "fetch-notebooks" });
    if (!response.ok) {
      throw new Error(response.error || t("status_fetch_failed"));
    }

    const saved = await chrome.storage.local.get("selectedNotebookId");
    state.selectedNotebookId = saved.selectedNotebookId || response.notebooks[0]?.id || "";
    state.notebooks = response.notebooks;
    renderNotebooks();
    setStatus(response.notebooks.length ? t("status_choose_and_send") : t("status_no_notebook_found"), "success");
  } catch (error) {
    renderNotebooks([]);
    setStatus(error.message, "error");
  } finally {
    toggleBusy(false);
  }
}

async function createNotebookAndSelect() {
  toggleBusy(true);
  setStatus(t("status_creating_notebook"));

  try {
    const response = await sendMessage({ type: "create-notebook" });
    if (!response.ok || !response.notebookId) {
      throw new Error(response.error || t("status_create_failed"));
    }

    await loadNotebooks();
    state.selectedNotebookId = response.notebookId;
    elements.notebookSelect.value = response.notebookId;
    await sendMessage({
      type: "save-selected-notebook",
      notebookId: response.notebookId
    });
    setStatus(t("status_new_notebook_selected"), "success");
  } catch (error) {
    setStatus(error.message, "error");
  } finally {
    toggleBusy(false);
  }
}

async function sendCurrentPage() {
  if (state.sending) {
    return;
  }

  const arxivPdfUrl = state.page?.arxiv?.pdfUrl || "";
  const isArxivQuickMode = Boolean(arxivPdfUrl) && (state.page?.arxiv?.pageType === "abs" || state.page?.arxiv?.pageType === "pdf");
  const youtubeVideoUrl = state.page?.youtube?.videoUrl || "";
  const isYoutubeQuickMode = Boolean(youtubeVideoUrl) && state.page?.youtube?.pageType === "video";
  const targetUrl = isArxivQuickMode
    ? arxivPdfUrl
    : isYoutubeQuickMode
      ? youtubeVideoUrl
      : (state.page?.canonicalUrl || state.page?.url || "");
  if (!targetUrl) {
    setStatus(t("status_invalid_url"), "error");
    return;
  }

  state.sending = true;
  toggleBusy(true);
  setStatus(
    isArxivQuickMode
      ? t("status_importing_arxiv")
      : isYoutubeQuickMode
        ? t("status_importing_youtube")
        : t("status_sending")
  );

  try {
    const response = (isArxivQuickMode || isYoutubeQuickMode)
      ? await sendMessage({
          type: "create-notebook-and-send",
          urls: [targetUrl]
        })
      : await sendMessage({
          type: "send-to-notebook",
          notebookId: elements.notebookSelect.value,
          urls: [targetUrl]
        });

    if (!response.ok) {
      throw new Error(response.error || t("status_send_failed"));
    }

    setStatus(
      isArxivQuickMode
        ? t("status_import_success_arxiv")
        : isYoutubeQuickMode
          ? t("status_import_success_youtube")
          : t("status_import_success"),
      "success"
    );
    await chrome.tabs.create({ url: response.notebookUrl });
    window.close();
  } catch (error) {
    setStatus(error.message, "error");
  } finally {
    state.sending = false;
    toggleBusy(false);
  }
}

async function sendArxivPdfToExistingNotebook() {
  if (state.sending) {
    return;
  }

  const targetUrl = state.page?.arxiv?.pdfUrl || state.page?.youtube?.videoUrl || "";
  const notebookId = elements.arxivNotebookSelect.value;
  if (!targetUrl || !notebookId) {
    setStatus(t("status_choose_existing"), "error");
    return;
  }

  state.sending = true;
  toggleBusy(true);
  setStatus(
    state.page?.arxiv?.pdfUrl
      ? t("status_adding_arxiv")
      : t("status_adding_youtube")
  );

  try {
    const response = await sendMessage({
      type: "send-to-notebook",
      notebookId,
      urls: [targetUrl]
    });

    if (!response.ok) {
      throw new Error(response.error || t("status_send_failed"));
    }

    setStatus(
      state.page?.arxiv?.pdfUrl ? t("status_add_success_arxiv") : t("status_add_success_youtube"),
      "success"
    );
    await chrome.tabs.create({ url: response.notebookUrl });
    window.close();
  } catch (error) {
    setStatus(error.message, "error");
  } finally {
    state.sending = false;
    toggleBusy(false);
  }
}

function renderPage() {
  const page = state.page;
  elements.pageTitle.textContent = page?.title || t("page_untitled");

  const meta = [];
  if (page?.byline) {
    meta.push(page.byline);
  }
  if (page?.canonicalUrl || page?.url) {
    meta.push(shortenUrl(page.canonicalUrl || page.url));
  }
  elements.pageMeta.textContent = meta.join("  ·  ");
  const isArxivQuickMode = Boolean(page?.arxiv?.pdfUrl) && (page?.arxiv?.pageType === "abs" || page?.arxiv?.pageType === "pdf");
  const isYoutubeQuickMode = Boolean(page?.youtube?.videoUrl) && page?.youtube?.pageType === "video";
  elements.pageDescription.textContent = isArxivQuickMode
    ? t("desc_arxiv", { url: shortenUrl(page.arxiv.pdfUrl) })
    : isYoutubeQuickMode
      ? t("desc_youtube", { url: shortenUrl(page.youtube.videoUrl) })
      : (page?.description || t("desc_default"));

  renderMode(page);

  if (page?.selectedText) {
    elements.selectionWrap.classList.remove("hidden");
    elements.selectedText.textContent = page.selectedText.slice(0, 260);
  } else {
    elements.selectionWrap.classList.add("hidden");
    elements.selectedText.textContent = "";
  }
}

function renderMode(page) {
  const isArxivQuickMode = Boolean(page?.arxiv?.pdfUrl) && (page?.arxiv?.pageType === "abs" || page?.arxiv?.pageType === "pdf");
  const isYoutubeQuickMode = Boolean(page?.youtube?.videoUrl) && page?.youtube?.pageType === "video";

  if (isArxivQuickMode) {
    document.body.classList.add("mode-arxiv");
    elements.modeBadge.textContent = t("mode_arxiv_import");
    elements.modeBadge.classList.remove("hidden");
    elements.targetCard.classList.add("hidden");
    elements.arxivExistingCard.classList.remove("hidden");
    elements.quickAuthorizeBtn.classList.remove("hidden");
    elements.sendLabel.textContent = t("label_create_new");
    elements.sendHint.textContent = t("hint_create_arxiv");
    elements.sendBtn.textContent = t("btn_create");
    renderExistingNotebookPanel();
    return;
  }

  if (isYoutubeQuickMode) {
    document.body.classList.add("mode-arxiv");
    elements.modeBadge.textContent = t("mode_youtube_import");
    elements.modeBadge.classList.remove("hidden");
    elements.targetCard.classList.add("hidden");
    elements.arxivExistingCard.classList.remove("hidden");
    elements.quickAuthorizeBtn.classList.remove("hidden");
    elements.sendLabel.textContent = t("label_create_new");
    elements.sendHint.textContent = t("hint_create_youtube");
    elements.sendBtn.textContent = t("btn_create");
    renderExistingNotebookPanel();
    return;
  }

  document.body.classList.remove("mode-arxiv");
  elements.modeBadge.textContent = "";
  elements.modeBadge.classList.add("hidden");
  elements.targetCard.classList.remove("hidden");
  elements.arxivExistingCard.classList.add("hidden");
  elements.quickAuthorizeBtn.classList.add("hidden");
  elements.sendLabel.textContent = t("label_send_ready");
  elements.sendHint.textContent = t("hint_send_url");
  elements.sendBtn.textContent = t("btn_send_page");
}

function renderNotebooks() {
  renderNotebookOptions(elements.notebookSelect);
  renderNotebookOptions(elements.arxivNotebookSelect);
  syncNotebookSelects();
  renderExistingNotebookPanel();
}

function toggleBusy(isBusy) {
  elements.refreshBtn.disabled = isBusy;
  elements.arxivRefreshBtn.disabled = isBusy;
  elements.createNotebookBtn.disabled = isBusy;
  elements.addToExistingBtn.disabled = isBusy;
  elements.sendBtn.disabled = isBusy;
  elements.notebookSelect.disabled = isBusy;
  elements.arxivNotebookSelect.disabled = isBusy;
}

function setStatus(message, tone = "") {
  elements.status.textContent = message;
  elements.status.className = "status";
  if (tone === "error") {
    elements.status.classList.add("is-error");
  }
  if (tone === "success") {
    elements.status.classList.add("is-success");
  }
}

async function openCurrentPage() {
  const url = state.page?.url;
  if (url) {
    await chrome.tabs.create({ url });
  }
}

function shortenUrl(url) {
  try {
    const parsed = new URL(url);
    return `${parsed.hostname}${parsed.pathname === "/" ? "" : parsed.pathname}`;
  } catch {
    return url;
  }
}

async function sendMessage(message) {
  return chrome.runtime.sendMessage(message);
}

function renderNotebookOptions(selectElement) {
  selectElement.innerHTML = "";

  if (!state.notebooks.length) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = t("no_notebooks");
    selectElement.append(option);
    return;
  }

  for (const notebook of state.notebooks) {
    const option = document.createElement("option");
    option.value = notebook.id;
    option.textContent = `${notebook.emoji} ${notebook.name} (${notebook.sources})`;
    selectElement.append(option);
  }
}

function syncNotebookSelects() {
  const selectedId = state.selectedNotebookId || state.notebooks[0]?.id || "";
  elements.notebookSelect.value = selectedId;
  elements.arxivNotebookSelect.value = selectedId;
}

function toggleExistingNotebookPanel() {
  state.showExistingNotebookPanel = !state.showExistingNotebookPanel;
  renderExistingNotebookPanel();
}

function renderExistingNotebookPanel() {
  const expanded = state.showExistingNotebookPanel;
  elements.existingNotebookPanel.classList.toggle("hidden", !expanded);
  elements.toggleExistingBtn.setAttribute("data-i18n", expanded ? "btn_hide" : "btn_show");
  elements.toggleExistingBtn.textContent = expanded ? t("btn_hide") : t("btn_show");
}
