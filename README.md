# Send to NotebookLM (STN)

[![Version](https://img.shields.io/badge/version-3.0.0-blue.svg)](package.json)

[简体中文](README.md) | [English](README.en.md)

Send to NotebookLM 是一个功能强大的浏览器扩展，旨在自动化您的研究流程。将网页、arXiv 论文和 YouTube 来源直接捕获到 Google NotebookLM 中，并利用内置的 “Enhancer” 增强功能自动生成各种研究产物。

## ✨ 核心特性

### 🚀 一键捕获
- **YouTube**: 发送 YouTube 链接，让 NotebookLM 基于字幕/转写文本处理该来源。
- **arXiv**: 直接将论文摘要和 PDF 作为源导入。
- **通用网页**: 通过扩展弹出窗或右键菜单发送任何网页。

### 📊 笔记本 (Notebooks) 管理
- **集中视图**: 在插件中直接查看和管理您所有的 NotebookLM 笔记本。
- **批量导入**: 一次性将多个 URL 导入到指定的笔记本。
- **快速添加源**: 无需打开 NotebookLM 网站即可向任何笔记本添加新来源。
- **自动化产物**: 一键触发 **幻灯片 (Slides)**、**简报文档 (Reports)** 和 **视频综述 (Video Overviews)** 的生成。

### 🛠️ NotebookLM 增强器 (Enhancer)
在 NotebookLM 中生成内容时自动应用您的首选预设：
- **对话 (Chat)**: 配置默认对话目标（如：学习指南）和回答长度。
- **自定义关注点 (Focus Prompt)**: 为您的笔记本定义特定的研究视角或角色的预设提示词。
- **自动化生成**: 支持幻灯片、信息图、简报和视频综述。

### 📱 无缝体验与隐私
- **独立运行 (Standalone)**: 完全去中心化架构，无需后端服务器，无需 Google OAuth 授权。
- **隐私至上**: 所有数据均存储在本地，无追踪，无外部分析。
- **原生体验**: 在 YouTube 和 arXiv 中注入原生感十足的快捷按钮。

## 📥 安装步骤

### 选项 A：从 ZIP 压缩包安装 (推荐)

1. 下载插件的压缩包（`.zip` 文件）并将其解压到本地文件夹。
2. 打开 Chrome 浏览器并导航到 `chrome://extensions/`。
3. 在右上角开启 **开发者模式**。
4. 点击 **加载解压的扩展程序** (Load unpacked)。
5. 选择您刚才解压出的文件夹（确保文件夹内直接包含 `manifest.json` 文件）。

### 选项 B：从源码构建安装

1. 克隆或下载此存储库。
2. 运行构建命令：
   ```bash
   bun install
   bun run build
   ```
3. 打开 Chrome 浏览器并导航到 `chrome://extensions/`。
4. 开启 **开发者模式**。
5. 点击 **加载解压的扩展程序** 并选择项目下的 `.output/chrome-mv3` 目录。

## 📖 使用指南

1. 打开 [NotebookLM](https://notebooklm.google.com/) 并确保已登录。
2. 导航到 YouTube 视频、arXiv 论文或任何网页。
3. 点击 **Send to NotebookLM** 按钮。
4. 使用插件选项页中的 **Notebooks** 页面管理您的内容并触发产物生成。
5. 在选项页中配置您的 **Enhancer** 设置，以实现自动化的提示词注入。

## 🛠️ 开发指南

本项目使用 [WXT](https://wxt.dev/)、[Svelte](https://svelte.dev/) 和 [Tailwind CSS](https://tailwindcss.com/) 构建。

```bash
# 安装依赖
bun install

# 启动开发服务器
bun run dev

# 生产环境构建
bun run build
```

## ❓ 常见问题

- **Q: 是否需要配置 API Key 或授权？**
  - **A**: **完全不需要**。此版本直接与您的浏览器会话集成，安装即可使用。
- **Q: 为什么提示“无法检测到会话”？**
  - **A**: 请确保您已在浏览器中登录 [NotebookLM 官网](https://notebooklm.google.com/)。
- **Q: 我的数据会被上传吗？**
  - **A**: 本插件不设后端服务器，所有配置和列表数据仅存储在您的本地浏览器中。
- **Q: 能把 B站/其他站点的“原视频文件”直接导入 NotebookLM 吗？**
  - **A**: 不能通过当前这条 URL 导入链路做到。对非 YouTube 视频页，NotebookLM 只会读取页面 URL；对 YouTube，NotebookLM 处理的是字幕/转写文本，不是原视频文件。

## ❤️ 支持开发

如果您觉得这个工具对您有所帮助，欢迎请我喝杯咖啡！您的支持是我持续维护和开发新功能的动力。

<div align="center">
  <img src="src/assets/alipay-qr.jpg" width="200" alt="支付宝打赏" />
  <p>支付宝 (Alipay)</p>
</div>

---
*Send to NotebookLM v3.0.0 - 让您的研究流程如虎添翼。*
