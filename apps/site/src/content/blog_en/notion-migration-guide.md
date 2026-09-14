---
draft: false
title: "Migrate from Notion to a self-hosted notes app"
snippet: "Use Notion MCP and EdgeEver MCP to copy Notion pages into a self-hosted notes instance."
image: {
    src: "/images/notion-migration.jpg",
    alt: "Migrate Notion to EdgeEver"
}
publishDate: "2026-07-06 19:30"
category: "Migration"
author: "EdgeEver Team"
tags: [notion, migration, self-hosted, mcp]
---

Thanks to EdgeEver's native support for AI Agent and Model Context Protocol (MCP), if you want to migrate your Notion workspace to EdgeEver, the most elegant way is to use your AI assistant as a bridge. By mounting both the **Notion MCP** and **EdgeEver MCP** servers, you can achieve fully automatic cloud-to-cloud page migration.

If the goal is a self-hosted notes app rather than staying on Notion, see the [self-hosted Evernote alternative](/en/self-hosted-evernote-alternative) page first.

### FAQ

- **Is this an official one-click export?** No. The flow uses Notion MCP and EdgeEver MCP, with an AI assistant copying pages.
- **Are databases and block properties preserved as-is?** Review pages after import. EdgeEver is a notes workspace, not a Notion database.
- **Can I migrate from Evernote instead?** Yes. See the [Evernote migration guide](/en/blog/evernote-migration-guide).

---

### Migration Steps

#### Step 1: Install and Enable Both MCP Servers in Your AI Assistant

1. **Configure Notion MCP**:
   Set up the Notion MCP server in your AI assistant (e.g., Claude Code, Cursor, Cline). Once configured, the AI assistant will be authorized to read your Notion Pages and Databases.

2. **Configure EdgeEver MCP**:
   - Log in to your EdgeEver instance, and click **Profile** -> **MCP settings**.
   - Generate an API Token, click **Copy full MCP configuration**, and set it up in your AI assistant.

Make sure your AI assistant can access and call both MCP servers simultaneously.

#### Step 2: Prompt the AI Assistant to Start the Migration

Copy and send the following prompt to the AI assistant that has access to both MCPs:

```text
You are my AI assistant. You are currently connected to both my Notion MCP server and my new EdgeEver MCP server.
Please help me migrate my Pages and Databases from Notion to EdgeEver:
1. Call the Notion MCP tools to read my Notion page content (including titles, body content, creation time, tags, etc.) in batches.
2. Call the EdgeEver MCP tools to write them into my new EdgeEver instance.
Please report the total number of successfully imported pages and if any page translation failed.
```

The AI assistant will automatically parse and convert Notion's Block format and call the EdgeEver write tools to complete the data transfer.

#### Step 3: Verify in Web Browser
Go back to your EdgeEver web client and refresh the page to confirm that all Notion pages have been successfully recorded, and that their formatting and tags are synchronized.
