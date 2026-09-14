---
draft: false
title: "从 Notion 迁移到自托管笔记应用：EdgeEver 指南"
snippet: "利用 Notion MCP 与 EdgeEver MCP，把 Notion 页面迁到自托管笔记实例。"
image: {
    src: "/images/notion-migration.jpg",
    alt: "从 Notion 迁移到 EdgeEver"
}
publishDate: "2026-07-06 19:30"
category: "Migration"
author: "EdgeEver Team"
tags: [notion, migration, self-hosted, mcp]
---

得益于 EdgeEver 对 AI Agent 和 Model Context Protocol (MCP) 的原生支持，如果你想将 Notion 笔记库搬迁到 EdgeEver，最优雅的方式是利用 AI 助手作为数据桥梁，同时挂载 **Notion MCP** 和 **EdgeEver MCP** 服务，实现全自动的云对云笔记导入。

如果目标是自托管笔记而不是继续留在 Notion，也可以先看 [EdgeEver 作为印象笔记替代方案](/self-hosted-evernote-alternative) 的说明。

### 常见问题

- **这是官方一键导出吗？** 不是。流程依赖 Notion MCP 与 EdgeEver MCP，由 AI 助手逐页复制。
- **数据库和块属性会原样保留吗？** 请在导入后核对页面内容。EdgeEver 是笔记工作区，不是 Notion 数据库。
- **可以从印象笔记迁吗？** 可以，见 [印象笔记迁移指南](/blog/evernote-migration-guide)。

---

### 迁移步骤

#### 步骤 1：在 AI 助手中安装并启用两个 MCP 服务

1. **配置 Notion MCP 服务**：
   在你的 AI 助手（如 Claude Code/Cursor/Cline 等）中配置好 Notion MCP 服务。配置成功后，AI 助手将获得直接读取你 Notion 页面（Pages）和数据库（Databases）的授权。
   
2. **配置 EdgeEver MCP 服务**：
   - 登录你的 EdgeEver 实例，点击左下角的 **个人中心** -> **MCP 设置**。
   - 生成 API Token 并点击 **复制完整 MCP 配置**，安装到你的 AI 助手中。

确保你的 AI 助手在运行中能够同时调用这两个 MCP 服务。

#### 步骤 2：对 AI 助手下达迁移指令

复制以下 Prompt 发送给已经挂载好两个 MCP 的 AI 助手：

```text
你是我的 AI 助手。现在你同时连接了我的 Notion MCP 服务 and 新 EdgeEver MCP 服务。
请帮我把旧 Notion 里的笔记和数据库页面迁移到新 EdgeEver 中：
1. 首先调用 Notion MCP 的读取接口，分批次读出我的 Notion 页面内容（包括标题、正文、创建时间、标签等）。
2. 然后调用 EdgeEver MCP 的写入接口，将这些读取到的页面批量导入到我的 EdgeEver 实例中。
请在全量迁移完成后，告诉我总共成功同步导入了多少篇笔记，以及是否有格式转换失败的页面。
```

AI 助手将自动解析并转换 Notion 的 Block 格式，并调用 EdgeEver 接口完成无痛数据写入。

#### 步骤 3：在网页端验证
回到 EdgeEver 网页端刷新，确认所有的 Notion 页面已成功转入，笔记内容和排版也都已完美同步。
