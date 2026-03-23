# Send to NotebookLM (STN)

[![Version](https://img.shields.io/badge/version-2.1.0-blue.svg)](package.json)

[English](README.md) | [简体中文](README.zh-CN.md)

Send to NotebookLM 是一个功能强大的浏览器扩展，旨在通过将网页、arXiv 论文和 YouTube 视频直接捕获到 Google NotebookLM 中，来简化您的研究流程。它还内置了 “Enhancer” 增强功能，可自动配置您的内容生成设置。

## ✨ 核心特性

### 🚀 一键捕获
- **YouTube**: 自动提取视频字幕，并通过操作栏中的内置 “Send to NotebookLM” 按钮将其发送到您的笔记本。
- **arXiv**: 检测论文摘要和 PDF，提供内置按钮将它们作为 PDF 源导入。
- **通用网页**: 通过扩展弹出窗口或右键菜单，将任何网页 URL 发送到 NotebookLM。

### 🛠️ NotebookLM 增强器 (Enhancer)
在 NotebookLM 中生成内容时自动应用您的首选预设：
- **对话 (Chat)**: 配置默认对话目标（如：学习指南）和回答长度。
- **幻灯片 (Slide Deck)**: 设置首选格式（详细报告 vs 演讲者幻灯片）、语言和长度。
- **信息图 (Infographic)**: 自定义方向（横向/纵向）、视觉风格（草图、动漫等）和详细程度。

### 📱 无缝体验
- **内置启动器**: 在 YouTube 和 arXiv 中直接注入原生感体验的按钮。
- **快速弹出窗**: 无需离开当前标签页即可管理笔记本列表并发送内容。
- **右键菜单**: 右键单击任何页面或链接即可立即发送。

## 📥 安装步骤

1. 下载或克隆此存储库。
2. 构建扩展：
   ```bash
   bun install
   bun run build
   ```
3. 打开 Chrome 浏览器并导航到 `chrome://extensions/`。
4. 启用 **开发者模式** (右上角)。
5. 点击 **加载解压的扩展程序** 并选择 `.output/chrome-mv3` 目录。

## 📖 使用指南

1. 打开 [NotebookLM](https://notebooklm.google.com/) 并确保已登录。
2. 导航到 YouTube 视频、arXiv 论文或任何网页。
3. 点击 **Send to NotebookLM** 按钮（页面内置或在弹出窗中）。
4. 选择现有笔记本或创建新笔记本以导入内容。
5. 在 **选项 (Options)** 页面中，您可以预先配置对话、幻灯片和信息图的增强设置。

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


