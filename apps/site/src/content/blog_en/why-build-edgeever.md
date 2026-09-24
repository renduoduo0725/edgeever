---
draft: false
title: "Why I Built EdgeEver"
snippet: "A founder-style note on classic Evernote workflows, open data, AI agents, and why EdgeEver exists."
image: {
    src: "/opengraph.jpg",
    alt: "EdgeEver open-source self-hosted notes workspace"
}
publishDate: "2026-07-05 20:10"
category: "Story"
author: "EdgeEver Team"
tags: [story, evernote, self-hosted, mcp, open-source]
---

I did not build EdgeEver because the world needs yet another notes app.

There are already plenty of them: lightweight notes, heavy knowledge bases, Markdown-first tools, collaborative workspaces, whiteboards, databases, and everything in between. But anyone who has used a notes app for years knows that the hard thing to replace is not a single feature. It is the workflow that has already become muscle memory.

For me, that workflow is close to classic Evernote: a notebook tree on the left, a note list in the middle, and the editor on the right. Open, search, organize, move, keep writing. Every action should feel direct. It does not need to look clever at every step. It needs to be stable, clear, fast, and trustworthy enough for years of personal knowledge.

Over time, I found it harder to get that feeling from existing products.

---

### I Wanted A Reliable Personal Knowledge Base

Many people are not asking for an ever-expanding productivity platform. We simply want a reliable personal knowledge base:

- Fast capture and organization
- Familiar notebook hierarchy
- Rich text, images, attachments, and long-form notes
- A good experience on both desktop and mobile
- A clear way to get our data back when needed

These needs are not flashy, but they are fundamental. When the fundamentals stop feeling reliable, a notes app stops being a tool and starts becoming overhead.

The reason I liked Evernote in the first place was that it handled these basics well for a long time. The three-pane layout, notebooks, search, and sync created a simple but efficient way to manage personal information.

But as products grow more complex, the part I actually want can end up buried under more and more layers.

---

### Bloat, Lock-In, And Migration Anxiety

For an individual user, the scariest thing about a notes app is not the lack of a button. It is trapped data.

When a product becomes heavier, adds more commercial layers, and starts making performance, memory use, or everyday responsiveness feel distracting, you naturally begin to ask: if I ever want to leave, can I take my content with me cleanly?

That question does not always have a comfortable answer.

Notes often contain years of material: images, attachments, web clips, fragments of thought, and unfinished plans. They are not just files. They are a personal knowledge trail. If migration depends on fragile third-party plugins, or exports into formats that are not open or easy to process, users live with a quiet kind of anxiety.

AI agents are also becoming a new entry point for work. Tools like Codex, Claude Code, Cursor, Antigravity, and WorkBuddy can already help us write code, organize material, and handle repetitive tasks. A notes system should be able to participate in that workflow safely and clearly.

If my knowledge base cannot be accessed through an API or MCP with explicit authorization, it has a hard time joining the next generation of workflows.

---

### Lightweight Alternatives Are Good, But I Still Want Three Panes

I have also looked at lighter, more open note-taking products. Many of them are clean and developer-friendly.

But for me, one gap remains: the classic Evernote-style three-pane experience still matters.

Three panes are not nostalgia. They are efficient information density:

- The left side shows where things live
- The middle lets me scan a group of notes quickly
- The right side puts me directly into editing

This layout works especially well for long-lived personal archives. It does not force me into a complex space first, and it does not ask me to design a whole system before managing content. It feels like a workbench: open it, and everything is within reach.

So EdgeEver is not trying to invent a brand-new paradigm. It is trying to fill a more specific gap: keep the familiar, direct three-pane notes experience while opening up the data model, deployment model, and agent interface.

---

### Why Cloudflare-Native Self-Hosting

I want EdgeEver to be a self-hosted product that ordinary individuals can actually keep using.

Traditional self-hosting often means servers, databases, object storage, backups, maintenance, and bills. For many people, that turns "own your data" into something that sounds good but is difficult to sustain.

Cloudflare D1, R2, Workers, and Pages offer a very practical combination for a personal knowledge base:

- D1 stores structured data and note content
- R2 stores images and attachments
- Workers provide the API
- The static frontend can run on the edge

At personal scale, this stack can be close to zero cost. More importantly, users do not need to maintain a server. Fork the repository, configure resources, deploy, then sync upstream updates and redeploy when needed.

That is one of the values EdgeEver is trying to express: self-hosting should not only belong to people who want to operate servers long term.

---

### Open Data Is The Baseline

EdgeEver keeps its content model explicit:

```text
content_json      TipTap/ProseMirror document, the editor source of truth
content_markdown  API, agent, import, and export format
content_text      Search, excerpts, and indexing
```

This is not about making the system look technically fancy. It is about not forcing every use case into one format.

The editor needs a structured document. APIs and migration workflows need Markdown. Search needs plain text. Each representation has a job. The clearer the data model is, the easier backup, migration, automation, and extension become.

I want EdgeEver users to have a simple sense of safety: this content is yours. You can read it through the REST API, let an agent organize it through MCP, or move it elsewhere when needed.

---

### MCP Makes Notes Actionable Again

Being AI-agent-friendly is a core part of EdgeEver.

In the past, notes apps mainly helped us save information. But saving is no longer enough. We also want tools to help us:

- Summarize scattered ideas
- Add tags to older notes
- Reconstruct project context from long-term notes
- Generate todos, docs, or plans from existing material
- Clean up hierarchy and formatting during migration

If all of this depends on copy and paste, it gets clumsy fast. MCP matters because users can explicitly authorize an AI agent to access their EdgeEver instance, so it can read and organize notes within clear boundaries.

That is another reason I wanted to build EdgeEver: notes should not be a sleeping archive. They should be callable, organizable, and reusable knowledge.

---

### What EdgeEver Wants To Be

EdgeEver is not trying to become an all-in-one super app.

It is meant to be an open, lightweight, long-lived personal notes foundation:

- Classic three-pane workflow
- Rich text, images, nested notebooks, and revision history
- Cloudflare-native deployment
- Clear data model with REST API and MCP
- Low cost for individual users
- Friendly to AI agents

If you miss the direct, dependable workbench feeling of earlier Evernote, but want a modern notes system that is open, self-hosted, and ready for AI agents, EdgeEver is built for that intersection.

I built it because I wanted a tool that feels familiar without being closed, lightweight without being shallow, personally owned while still ready for future automation workflows.

That is where EdgeEver begins.
