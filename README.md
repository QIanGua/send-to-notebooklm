# Send to NotebookLM (STN)

[![Version](https://img.shields.io/badge/version-2.1.0-blue.svg)](package.json)

[English](README.md) | [简体中文](README.zh-CN.md)

Send to NotebookLM is a powerful browser extension designed to streamline your research workflow by capturing web pages, arXiv papers, and YouTube videos directly into Google NotebookLM. It also features a built-in "Enhancer" to automate your generation settings.

## ✨ Key Features

### 🚀 One-Click Capture
- **YouTube**: Automatically extracts video transcripts and sends them to your notebook via an inline "Send to NotebookLM" button in the action bar.
- **arXiv**: Detects paper abstracts and PDFs, providing an inline button to import them as PDF sources.
- **Universal Web Pages**: Send any web page URL to NotebookLM from the extension popup or context menu.

### 🛠️ NotebookLM Enhancer
Automatically applies your preferred presets when generating artifacts in NotebookLM:
- **Chat**: Configure default conversational goals (e.g., Learning Guide) and response lengths.
- **Slide Deck**: Set preferred format (Detailed vs. Presenter), language, and length.
- **Infographic**: Customize orientation (Landscape/Portrait), visual style (Sketch, Anime, etc.), and detail level.

### 📱 Seamless UX
- **Inline Launchers**: Native-feeling buttons injected directly into YouTube and arXiv.
- **Quick Popup**: Manage your notebook lists and send content without leaving the current tab.
- **Context Menu**: Right-click any page or link to send it instantly.

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
3. Click the **Send to NotebookLM** button (inline or in the popup).
4. Choose an existing notebook or create a new one to import the content.
5. In the **Options** page, you can pre-configure your Enhancer settings for Chat, Slides, and Infographics.

## 🛠️ Development

This project is built with [WXT](https://wxt.dev/), [Svelte](https://svelte.dev/), and [Tailwind CSS](https://tailwindcss.com/).

```bash
# Install dependencies
bun install

# Start development server
bun run dev

# Build for production
bun run build
```


