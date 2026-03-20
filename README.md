# Send to NotebookLM

中文 | [English](#english)

## 中文

一个轻量、顺手、偏美观的 Chrome 扩展原型，用来把网页、arXiv 论文 PDF、YouTube 视频快速发送到 NotebookLM。

### 当前特性

- 支持从 popup 获取并选择你的 NotebookLM notebooks
- 支持创建新 notebook
- 支持把当前网页 URL 发送到指定 notebook
- 支持右键菜单：
  - 发送当前页面到 NotebookLM
  - 发送链接到 NotebookLM
- 支持 arXiv 快捷模式：
  - 自动识别 `arxiv.org/abs/...` 和 `arxiv.org/pdf/...`
  - 默认一键新建 notebook 并导入论文 PDF
  - 也支持添加到已有 notebook
- 支持 YouTube 快捷模式：
  - 自动识别视频页面
  - 默认一键新建 notebook 并导入视频 URL
  - 也支持添加到已有 notebook
- 支持页面内入口：
  - arXiv 页面会在 `View PDF` 附近出现 `Send to NotebookLM`
  - YouTube 页面会在 `Download` 按钮下方附近出现 `Send to NotebookLM`

### 本地加载

1. 打开 `chrome://extensions`
2. 开启右上角 `Developer mode`
3. 点击 `Load unpacked`
4. 选择目录：

`/Users/qianlong/tries/2026-03-19-send-to-notebooklm/send-to-notebooklm`

### 使用说明

1. 先在同一个 Chrome 浏览器中打开并登录 [NotebookLM](https://notebooklm.google.com/)
2. 打开一个普通网页、arXiv 页面或 YouTube 视频页
3. 使用以下任一入口：
   - 点击浏览器工具栏中的扩展 popup
   - 在页面中点击内嵌的 `Send to NotebookLM`
   - 使用右键菜单

### arXiv 页面行为

- 默认主路径：`Create`
  - 新建 notebook
  - 导入当前论文 PDF
- 次路径：`Add to Existing`
  - 选择已有 notebook
  - 导入当前论文 PDF

### YouTube 页面行为

- 默认主路径：`Create`
  - 新建 notebook
  - 导入当前视频 URL
- 次路径：`Add to Existing`
  - 选择已有 notebook
  - 导入当前视频 URL

### 调试

- 如果 popup 或页面内按钮没有正常工作：
  1. 回到 `chrome://extensions`
  2. 找到 `Send to NotebookLM`
  3. 点击 `Reload`
  4. 刷新目标网页

- 如果需要查看报错：
  1. 在 `chrome://extensions` 中打开扩展详情
  2. 查看 `service worker`
  3. 打开 Console 检查错误日志

### 注意事项

- 扩展依赖你当前浏览器中的 NotebookLM 登录态
- NotebookLM 内部 RPC 接口未来可能变化
- YouTube 和 arXiv 的页面结构如果调整，页面内入口位置可能需要继续微调

---

## English

A lightweight and polished Chrome extension prototype for sending web pages, arXiv PDFs, and YouTube videos to NotebookLM.

### Features

- Fetches and lists your NotebookLM notebooks in the popup
- Creates a new notebook
- Sends the current page URL to a selected notebook
- Adds context-menu actions:
  - Send current page to NotebookLM
  - Send link to NotebookLM
- arXiv quick mode:
  - Detects `arxiv.org/abs/...` and `arxiv.org/pdf/...`
  - Default path creates a new notebook and imports the paper PDF
  - Also supports adding the PDF to an existing notebook
- YouTube quick mode:
  - Detects YouTube video pages
  - Default path creates a new notebook and imports the video URL
  - Also supports adding the video to an existing notebook
- Inline page actions:
  - On arXiv, a `Send to NotebookLM` entry appears near `View PDF`
  - On YouTube, a `Send to NotebookLM` entry appears near the action row around `Download`

### Load Locally

1. Open `chrome://extensions`
2. Enable `Developer mode`
3. Click `Load unpacked`
4. Select:

`/Users/qianlong/tries/2026-03-19-send-to-notebooklm/send-to-notebooklm`

### How to Use

1. Open and sign in to [NotebookLM](https://notebooklm.google.com/) in the same Chrome profile
2. Open a regular web page, an arXiv page, or a YouTube video page
3. Use any of these entry points:
   - The extension popup
   - The inline `Send to NotebookLM` button on the page
   - The browser context menu

### arXiv Behavior

- Primary path: `Create`
  - Creates a new notebook
  - Imports the current paper PDF
- Secondary path: `Add to Existing`
  - Select an existing notebook
  - Imports the current paper PDF

### YouTube Behavior

- Primary path: `Create`
  - Creates a new notebook
  - Imports the current video URL
- Secondary path: `Add to Existing`
  - Select an existing notebook
  - Imports the current video URL

### Debugging

- If the popup or inline launcher does not appear or work correctly:
  1. Go back to `chrome://extensions`
  2. Find `Send to NotebookLM`
  3. Click `Reload`
  4. Refresh the target page

- To inspect errors:
  1. Open the extension details page in `chrome://extensions`
  2. Open the `service worker`
  3. Check the Console output

### Notes

- The extension depends on your active NotebookLM browser session
- NotebookLM internal RPC identifiers may change in the future
- If YouTube or arXiv change their page structure, inline launcher placement may need further tuning
