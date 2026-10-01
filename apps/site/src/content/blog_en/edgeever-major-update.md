---
draft: false
title: "EdgeEver Product Capability Overview: Cross-Platform Apps, Flexible Deploy, Dual-Protocol AI & Visual Diagram Notes"
snippet: "A comprehensive product overview based on the latest EdgeEver README, architecture docs, and implementation, covering ACP/MCP AI synergy, visual diagrams, and open data."
image: {
    src: "/images/major-update.jpg",
    alt: "EdgeEver product capability overview"
}
publishDate: "2026-09-30 12:00"
category: "Product"
author: "EdgeEver Team"
tags: [updates, cross-platform, docker, acp, mcp, companion, diagram, creator]
---

EdgeEver is a modern, open-source notes workspace. It brings back the familiar, high-efficiency three-pane experience from classic Evernote, while providing an open data architecture, native ACP/MCP dual-protocol AI synergy, visual diagram notes, and flexible self-hosted deployments.

The summary below is based on the latest README, architecture documentation, and codebase structure in the `edgeever` repository.

---

### 1. Flexible Deployment: Cloudflare Serverless & Docker

EdgeEver supports two modern self-hosting options from the same codebase:

- **Cloudflare Serverless Deployment**: 100% free serverless architecture running entirely within Cloudflare Workers, D1, and R2 free tiers (accommodating ~150,000 short notes and ~50,000 images) with zero server bills and zero maintenance.
- **1-Line Docker Self-Hosting**: Official container images hosted on GHCR, deployable via `curl -fsSL https://edgeever.org/install.sh | bash` on your VPS, NAS, or home server with scalable storage for millions of notes and large attachments.

### 2. Dual-Protocol Native AI Synergy: Companion Sidebar, Local ACP Agents & Remote MCP

EdgeEver provides a comprehensive personal knowledge AI synergy matrix:

- **Desktop ACP (Agent Client Protocol) Direct Local Agent Connection**: Desktop connects directly to locally running AI Agents via standard ACP (such as Codex, Antigravity, Claude Code, WorkBuddy, DeepSeek Harness, pi agent, etc.) without cloud relay, delivering zero-latency, deep-context collaborative writing.
- **Persistent AI Companion Sidebar**: Completely replaces legacy dialogs, supporting multi-chat switching and instant action on note text or selections (summarize, explain, translate, proofread, and rewrite).
- **Built-in Remote MCP Endpoint**: Built-in Model Context Protocol endpoint and stdio bridge authorizing external AI Agents to safely read, create, and organize notes.
- **Connect Your Own Models**: Support for OpenAI, Anthropic Claude, Google Gemini, DeepSeek, and custom compatible endpoints.

### 3. Visual Diagram Notes & Creator Tools

- **Native Visual Diagram Notes**: Ditch external drawing tools and sketch mind maps, flowcharts, and architecture diagrams directly in notes. Backed by a structured IR, the built-in assistant and external AI agents can generate and refine diagrams from a single prompt, complete with smart auto-layout, cross-device sync, and vector export.
- **One-Click Styled Rich Copy**: Converts Markdown into beautifully styled HTML with inline CSS, ready to paste directly into Substack, Medium, or newsletters.
- **Note Appearance & Custom CSS**: Independent font size, line height, and palette settings per note, with light/dark custom CSS presets and side-by-side preview.
- **Mermaid Diagrams & KaTeX Math**: Native rendering for architecture diagrams, sequence charts, and LaTeX equations while preserving editable source code.
- **PDF Preview & Universal Attachments**: Inline PDF document previews alongside Office files, archives, audio, and video attachments.

### 4. All-Platform Native Apps & Multi-Device Sync

Break free from commercial "2-device login limits" with a self-hosted API that synchronizes across all your devices:

- **macOS Desktop App**: Electron + Rust sidecar + SQLite local data service for instant local performance, ACP local agent synergy, offline editing, and full-screen focus mode; switching notes does not retain cached images/documents, keeping memory light and responsive.
- **Windows x64 Desktop App**: Local SQLite mirror, automatic updates, and Windows Explorer right-click "Send to EdgeEver" system integration.
- **Linux Desktop App**: Linux x86_64 AppImage preview distribution with in-app cross-version update support.
- **iOS Native App**: Built with pure SwiftUI (iOS 17+), published on the App Store, integrating TipTap EditorBundle and local SQLite sync via GRDB, supporting share-sheet clipping and undo/redo.
- **Android App**: Available on Google Play and signed APKs on GitHub Releases, featuring offline capture, share-sheet clipping, and undo/redo.
- **Web Clipper Extension**: Available on Chrome Web Store, Microsoft Edge Add-ons, and Firefox Add-ons for clipping articles, selections, right-click images, and X (Twitter) posts.

### 5. Classic Three-Pane Layout, Dual View & Focus Mode

- **Classic Three-Pane**: Notebook tree, note list, and main editor with zero learning curve.
- **Rich Text / Markdown Dual View**: Switch seamlessly between TipTap rich text and Markdown source on desktop.
- **Unlimited Nesting & Batch Operations**: Deeply nested notebooks, drag-and-drop reorganization, and multi-note batch move or merge.
- **Revision History**: Automatic version tracking with instant review and rollback.
- **Public Note Sharing**: Share notes publicly with optional auto-generated passwords; shared note pages support double-click image zooming.

### 6. Data Sovereignty, Multi-Account Workspaces & Lossless Migration

- **Isolated User Workspaces**: Single instance supports multiple independent user accounts with isolated data and MCP tokens.
- **Lossless ZIP Backup & Restore**: One-click export including Markdown, Front Matter, nested hierarchies, attachments, and revision history for cross-instance recovery.
- **Smooth Migration Tools**: Built-in migration scripts and step-by-step guides for Evernote (ENEX / evernote-backup), Memos, Notion, and Flomo.
- **Client-Side Image Compression**: Silently compresses images in the browser before upload (saving 50%-90% storage).
- **Official Plugin Platform**: Extend EdgeEver via rich plugin APIs with sandboxed permissions and declarative settings.


