# Send to NotebookLM

Chrome extension for sending web pages, arXiv PDFs, and YouTube videos to NotebookLM.

## Features

- Send the current page URL to a NotebookLM notebook from the popup
- Create a new notebook before importing arXiv PDFs or YouTube URLs
- Add to an existing notebook from popup quick mode or inline launcher
- Use inline launchers on supported arXiv and YouTube pages
- Use context-menu entries for current page or links

## Usage

1. Open [NotebookLM](https://notebooklm.google.com/) in the same browser profile and sign in.
2. Open a regular page, an arXiv paper page, or a YouTube video page.
3. Use the popup, inline launcher, or context-menu action to send content.

## Quick Modes

- arXiv pages import the paper PDF, either into a new notebook or an existing one
- YouTube video pages import the canonical watch URL, either into a new notebook or an existing one

## Load Locally

1. Open `chrome://extensions`
2. Enable `Developer mode`
3. Click `Load unpacked`
4. Select this repository's built extension directory after running `npm run build`:

```text
.output/chrome-mv3
```

## Development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

Production output is generated in `.output/chrome-mv3/`.

## Notes

- The extension depends on your active NotebookLM browser session
- NotebookLM internal RPC identifiers may change over time
- Inline launcher placement may need adjustment if a supported website changes its DOM structure

## Extending Website Support

- Website-specific logic lives in `src/lib/site-adapters.ts`
- Each adapter declares URL matching, source extraction, mount point discovery, and insertion strategy
- The content script now injects only on supported websites, reducing overhead on unrelated pages
- NotebookLM tokens and notebook lists are cached briefly in the background script to reduce repeated waits
