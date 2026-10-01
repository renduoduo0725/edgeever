---
draft: false
title: "EdgeEver 产品全景能力概览：全平台客户端、自由部署、双协议 AI 协同与可视化图表笔记"
snippet: "基于核心仓库 README、文档与代码实现，全面整理 EdgeEver 当前的全平台、多部署、ACP/MCP 双协议 AI、可视化图表与开放数据能力。"
image: {
    src: "/images/major-update.jpg",
    alt: "EdgeEver 产品全景概览"
}
publishDate: "2026-09-30 12:00"
category: "Product"
author: "EdgeEver Team"
tags: [updates, cross-platform, docker, acp, mcp, companion, diagram, creator]
---

EdgeEver 是一款现代化的开源笔记工作区。它为你找回经典印象笔记的三栏高效体验，同时具备完全开放的数据架构、ACP/MCP 双协议原生 AI 协同、可视化图表笔记与自由部署能力，让个人知识沉淀更轻量、更自由。

以下内容基于 `edgeever` 仓库的最新 README、架构文档和代码实现进行系统梳理。

---

### 1. 自由选择部署方式：Cloudflare Serverless 与 Docker

EdgeEver 同一套应用完美支持两种自托管形态：

- **Cloudflare Serverless 部署**：终身免服务器，完全运行在 Cloudflare Workers、D1 与 R2 免费额度内（可容纳约 15 万条短笔记和 5 万张图片），零月租、零运维。
- **Docker 一键脚本自托管**：官方容器镜像托管于 GHCR，支持单行命令 `curl -fsSL https://edgeever.org/install.sh | bash` 在 VPS、NAS 或家庭服务器快速启动，存储按需扩展，轻松承载百万级笔记与海量附件。

### 2. 双协议原生 AI 协同：AI 伴侣侧边栏、本机 ACP Agent 与 Remote MCP

EdgeEver 构建了完整的个人知识库 AI 协同矩阵：

- **桌面端 ACP（Agent Client Protocol）直连本机 Agent**：桌面端通过标准 ACP 协议直接协同本机运行的 AI Agent（如 Codex、Antigravity、Claude Code、WorkBuddy、DeepSeek Harness、pi agent 等），无需云端中转，以极低延迟、深度上下文辅助代码与文档写作。
- **常驻 AI 伴侣侧边栏 (Companion Sidebar)**：彻底取代老旧弹窗，支持多会话随时切换；在编辑器中对笔记全文或选中文本一键进行要点提炼、即时解释、多语言翻译、语法校对与续写润色。
- **内置 Remote MCP 协议**：内置 Model Context Protocol endpoint 与 stdio bridge，直接授权外部 AI Agent 安全读写与整理笔记，也可与外部知识生态轻松打通。
- **接入主流大模型**：支持配置 OpenAI、Anthropic Claude、Google Gemini、DeepSeek 及自定义兼容端点。

### 3. 可视化图表笔记与创作者排版

- **原生可视化图表笔记 (Visual Diagram Notes)**：告别外部绘图工具，笔记内原生绘制思维导图、流程图与架构图；基于结构化 IR，内置 AI 助手与外部 Agent 可一句话智能生成与修改图表，支持自动布局、全端同步及矢量导出。
- **微信公众号一键排版复制**：专为中文创作者设计，Markdown 瞬间转换为带内联样式的公众号精美排版，一键复制粘贴直接发布。
- **笔记外观排版与自定义 CSS**：支持单篇笔记的字号、行高与调色板独立设置，并提供明暗双模式的自定义 CSS 预设与一览同屏预览。
- **Mermaid 架构图与 KaTeX 公式**：原生渲染架构图、流程图、时序图与数学公式，切换视图时保留可编辑源码。
- **PDF 预览与通用附件**：支持直观预览 PDF 文档，无缝插入 Office、压缩包及音视频等通用附件。

### 4. 全平台原生客户端与多端体验

摆脱商业笔记“免费版仅限 2 台设备”的束缚，自建专属 API 支持多端无缝协同：

- **macOS 桌面端**：基于 Electron + Rust sidecar + SQLite 本地数据服务，兼顾极速本地响应、ACP 本机协同、离线编辑与一键全屏专注模式；内存机制经深度优化，切笔记不堆积图片与文档缓存，后台长久待机依然流畅。
- **Windows x64 桌面端**：提供本地 SQLite 镜像、自动更新以及 Windows 资源管理器右键“发送到 EdgeEver”系统级集成。
- **Linux 桌面端**：提供 Linux x64 AppImage 预览版，支持应用内跨版本检查更新。
- **iOS 原生 App**：基于原生 SwiftUI（iOS 17+）构建，已上架 App Store，集成 TipTap EditorBundle 与本地 SQLite 镜像，支持微信公众号文章一键分享剪藏与撤销重做。
- **Android App**：已上架 Google Play，并在 GitHub Releases 提供签名 APK，支持离线记录、微信文章分享剪藏与撤销重做。
- **全能浏览器剪藏插件**：已在 Chrome Web Store、Microsoft Edge 与 Firefox Add-ons 全面上架，不仅支持网页全文与选区剪藏，还支持右键图片直接存为笔记、右键保存 X (Twitter) 推文与 Google 图片搜索关键词记录。

### 5. 经典三栏布局与专注模式

- **经典三栏**：笔记本树、笔记列表与主编辑区一目了然，零迁移学习成本。
- **富文本 / Markdown 双视图**：桌面端支持在 TipTap 富文本与 Markdown 源码视图之间自由切换。
- **无限层级与批量操作**：支持无限多级笔记本嵌套、拖拽重排与笔记批量移动/合并。
- **历史版本回溯**：自动记录修改历史，随时查阅与还原过往版本。
- **公开分享密码保护**：支持公开分享笔记并随时停用，支持为分享链接设置自动生成的访问密码，分享笔记页面支持双击放大查看图片。

### 6. 数据主权、多账号空间与无损迁移

- **多账号独立空间**：单实例支持创建多个独立成员账号，用户数据与 MCP Token 完全物理隔离。
- **无损 ZIP 打包导出**：一键打包包含 Markdown、Front Matter、嵌套目录及附件的完整档案，支持跨实例完整还原。
- **平滑迁入工具**：提供针对印象笔记（Evernote ENEX / evernote-backup）、Memos、Notion 与 Flomo 的自动化迁移工具与指南。
- **前端智能图片压缩**：上传前在浏览器端静默压缩大图（精简 50%-90% 体积），加载更迅速、存储更省心。
- **官方插件市场**：支持通过丰富插件 API 扩展 EdgeEver（如任务管理、AI RSS 订阅等），具备受控权限隔离与声明式设置。


