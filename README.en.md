# Send to NotebookLM (STN)

[![Version](https://img.shields.io/badge/version-3.0.0-blue.svg)](package.json)

[简体中文](README.md) | [English](README.en.md)

Send to NotebookLM is a powerful browser extension designed to automate your research workflow. Capture web pages, arXiv papers, and YouTube videos directly into Google NotebookLM, and use the built-in "Enhancer" to automate artifact generation.

## ✨ Key Features

### 🚀 One-Click Capture
- **YouTube**: Extract video transcripts and send them to NotebookLM via an inline button.
- **arXiv**: Import paper abstracts and PDFs directly as sources.
- **Universal Web Pages**: Send any URL from the extension popup or context menu.

### 📊 Notebooks Management
- **Centralized View**: View and manage all your NotebookLM notebooks directly within the extension.
- **Bulk Import**: Import multiple URLs to a specific notebook in one go.
- **Quick Source Add**: Add new sources to any notebook without opening the NotebookLM website.
- **Automated Artifacts**: Trigger generation of **Slide Decks**, **Briefing Docs (Reports)**, and **Video Overviews** with just one click.

### 🛠️ NotebookLM Enhancer
Automatically applies your preferred presets when generating artifacts:
- **Chat**: Configure default conversational goals (e.g., Learning Guide) and response lengths.
- **Custom Focus Prompt**: Define specific research angles or personas for your notebook.
- **Automated Generations**: Support for Slides, Infographics, Reports, and Video Overviews.

### 📱 Seamless UX & Privacy
- **Independent & Standalone**: Fully decentralized architecture. No backend server, no Google OAuth required.
- **Privacy First**: All data is stored locally. No tracking or external analytics.
- **Deep Integration**: Native-feeling buttons injected into YouTube and arXiv.

## 📥 Installation

1. Download or clone this repository.
2. Build the extension:
   ```bash
   bun install
   bun run build
   ```
3. Open Chrome and navigate to `chrome://extensions/`.
4. Enable **Developer mode** (top right).
5. Click **Load unpacked** and select the `.output/chrome-mv3` directory.

## 📖 Usage

1. Open [NotebookLM](https://notebooklm.google.com/) and ensure you are signed in.
2. Navigate to a YouTube video, arXiv paper, or any web page.
3. Click the **Send to NotebookLM** button.
4. Use the **Notebooks** page in the extension options to manage your content and trigger artifact generation.
5. Configure your **Enhancer** settings in the Options page for automated prompt injection.

## 🛠️ Development

Built with [WXT](https://wxt.dev/), [Svelte](https://svelte.dev/), and [Tailwind CSS](https://tailwindcss.com/).

```bash
# Install dependencies
bun install

# Start development server
bun run dev

# Build for production
bun run build
```

## ❓ FAQ

- **Q: Do I need to configure an API Key or authorization?**
  - **A**: **Not at all**. This version integrates directly with your browser session; just install and use.
- **Q: Why does it say "Session not detected"?**
  - **A**: Please ensure you are logged into the [NotebookLM official site](https://notebooklm.google.com/) in your browser.
- **Q: Will my data be uploaded?**
  - **A**: This extension does not have a backend server. All configurations and list data are stored only in your local browser.

## ❤️ Support the Developer

If you find this tool helpful, feel free to buy me a coffee! Your support keeps me motivated to maintain and develop new features.

<div align="center">
  <img src="src/assets/alipay-qr.jpg" width="200" alt="Alipay Support" />
  <p>Alipay (支付宝)</p>
</div>

---
*Send to NotebookLM v3.0.0 - The most powerful way to feed your brain.*

