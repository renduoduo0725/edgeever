export const alternativePageCopy = {
  "zh-CN": {
    eyebrow: "自托管笔记",
    title: "自托管印象笔记替代方案：Cloudflare 或 Docker",
    description:
      "EdgeEver 是开源、原生支持 AI 的自托管笔记工作区。保留印象笔记式三栏布局，可在 Cloudflare 免费额度内运行，或用同一套应用在 VPS、NAS、家庭服务器上 Docker 部署。",
    lead: [
      "EdgeEver 面向长期使用印象笔记、只想要一个可靠、开放、可自己部署的个人知识库的人。整栈开源，数据在你控制的 SQLite 里，并提供 REST API、MCP 与 ENEX 迁移路径。",
      "它不是又一个时间流动的碎片笔记，也不是本地 Markdown 仓库。交互上接近经典三栏：笔记本树、笔记列表、编辑区。",
    ],
    fitTitle: "适合谁",
    fit: [
      "习惯印象笔记三栏，而不是时间流动或纯文件仓库。",
      "希望自托管，不想再为笔记 SaaS 和设备数量付费。",
      "希望用 Cloudflare 免费额度，或一行命令在 VPS / NAS 上跑 Docker。",
      "希望把笔记交给 Claude Code、Codex 等 Agent，通过原生 MCP 读写。",
    ],
    notFitTitle: "不适合谁",
    notFit: [
      "如果默认需要 Joplin 那种端到端加密，EdgeEver 并不以 E2EE 为卖点；安全边界是「实例由你托管」。",
      "如果需要 Notion 式数据库和块工作区，请继续用 Notion 或同类工具。EdgeEver 是笔记工作区。",
      "如果只要本地文件夹、完全不要服务端，Obsidian 或纯 Markdown 目录可能更合适。",
    ],
    compareTitle: "和常见方案差在哪",
    compareIntro:
      "Joplin 是英文社区最常见的自托管印象笔记替代。EdgeEver 更接近经典三栏，并同时提供 Cloudflare 免费额度和 Docker。下表只写仓库和公开文档里能核对的事实，不比较「谁全面更好」。",
    compareHeaders: ["", "托管", "布局", "客户端", "印象笔记导入"],
    compareRows: [
      ["EdgeEver", "Cloudflare 免费额度或 Docker", "三栏笔记本", "macOS / Windows / Linux / iOS / Android / 剪藏", "已文档化的 ENEX + MCP 流程"],
      ["印象笔记", "厂商云，不可自托管", "三栏笔记本", "全平台", "—"],
      ["Joplin", "Joplin Server 或自选同步", "笔记本", "官方多端", "支持 ENEX"],
      ["Obsidian", "本地文件；官方同步收费", "文件仓库", "全平台", "社区方案"],
      ["Memos", "可自托管", "时间流动卡片", "偏 Web", "不是同一条迁移路径"],
    ],
    pathsTitle: "接下来怎么做",
    paths: [
      {
        title: "Cloudflare 自托管",
        summary: "推荐给不想维护服务器的个人用户。个人规模大约可放 15 万条短笔记和 5 万张图片。",
        href: "/blog/ai-agent-deploy-cloudflare",
        cta: "查看 Cloudflare 部署",
      },
      {
        title: "Docker 自托管",
        summary: "同一套应用，用一行命令装到 VPS、NAS 或家庭服务器，存储可按需扩展。",
        href: "/docker-deploy",
        cta: "查看 Docker 部署",
      },
      {
        title: "从印象笔记迁移",
        summary: "用 ENEX、evernote-backup 和 EdgeEver MCP 迁移笔记本树、附件与时间戳。",
        href: "/blog/evernote-migration-guide",
        cta: "查看迁移指南",
      },
      {
        title: "从 Notion 迁移",
        summary: "通过 Notion MCP 与 EdgeEver MCP，让 AI 助手做云对云导入。",
        href: "/blog/notion-migration-guide",
        cta: "查看 Notion 迁移",
      },
    ],
    faqTitle: "常见问题",
    faqs: [
      {
        question: "什么是自托管印象笔记替代方案？",
        answer:
          "指你可以自己部署、数据留在自己账号或硬件上的笔记应用，交互上接近印象笔记的笔记本和三栏工作区。EdgeEver 按这个目标来做，并补上开源、MCP 与 Cloudflare / Docker 部署。",
      },
      {
        question: "可以用 Docker 跑吗？",
        answer:
          "可以。官方提供一行安装脚本和完整 Docker 指南，支持 amd64 / arm64，以及本地存储或 S3 兼容对象存储。Cloudflare 与 Docker 跑的是同一套应用。",
      },
      {
        question: "能导入印象笔记吗？",
        answer:
          "可以。文档化的流程使用 ENEX、evernote-backup 和 MCP 导入脚本，保留创建/修改时间与嵌套笔记本。导入后请抽查带图片的笔记。",
      },
      {
        question: "Cloudflare 个人使用真的免费吗？",
        answer:
          "可以运行在 Cloudflare 免费额度内，无需另买服务器。额度会随 Cloudflare 政策变化；超出后再升级或改用 Docker。",
      },
      {
        question: "有 iOS 和 Android 客户端吗？",
        answer:
          "有。Android 在 Google Play，iOS 在 App Store。iOS 目前需要非中国大陆 Apple ID。另有 Chrome / Edge / Firefox 剪藏扩展。",
      },
      {
        question: "EdgeEver 和印象笔记是什么关系？",
        answer:
          "没有关联、没有赞助。EdgeEver 只是开源替代方案，迁移指南只处理用户自己拥有的数据。印象笔记和 Evernote 是其权利人的商标。",
      },
    ],
  },
  "en-US": {
    eyebrow: "Self-hosted notes",
    title: "A self-hosted Evernote alternative with Docker and Cloudflare",
    description:
      "EdgeEver is an open-source, AI-native notes workspace with the classic Evernote three-pane layout. Run it on Cloudflare's free tier, or install the same app with Docker on a VPS, NAS, or home server.",
    lead: [
      "EdgeEver is for people who still want a reliable, open, self-hosted personal knowledge base. The stack is open source. Notes live in SQLite you control, with a REST API, MCP, and a documented Evernote ENEX migration path.",
      "It is not a social timeline and not a folder of local Markdown files. The workspace stays close to classic Evernote: notebook tree, note list, editor.",
    ],
    fitTitle: "Who it is for",
    fit: [
      "You want Evernote-style notebooks, not a timeline or a file vault.",
      "You want to self-host instead of paying a notes SaaS or hitting device caps.",
      "You want Cloudflare's free tier, or a one-line Docker install on a VPS or NAS.",
      "You want coding agents such as Claude Code or Codex to read and organize notes through native MCP.",
    ],
    notFitTitle: "Who it is not for",
    notFit: [
      "If you need default end-to-end encryption like Joplin, EdgeEver does not advertise E2EE. The boundary is that you host the instance.",
      "If you need Notion-style databases and block workspaces, stay on Notion or a Notion-like app. EdgeEver is a notes workspace.",
      "If you only want local files and no server, Obsidian or a Markdown folder may fit better.",
    ],
    compareTitle: "How it differs from common options",
    compareIntro:
      "Joplin is the usual self-hosted Evernote alternative in English search results. EdgeEver is closer to the classic three-pane notes app, and it ships both Cloudflare free-tier hosting and Docker. The table only records facts that can be checked in this repository or in those products' public docs. It is not a ranking of which tool is better overall.",
    compareHeaders: ["", "Hosting", "Layout", "Clients", "Evernote import"],
    compareRows: [
      ["EdgeEver", "Cloudflare free tier or Docker", "Three-pane notebooks", "macOS / Windows / Linux / iOS / Android / clipper", "Documented ENEX + MCP flow"],
      ["Evernote", "Vendor cloud, not self-hosted", "Three-pane notebooks", "All major platforms", "—"],
      ["Joplin", "Joplin Server or your sync target", "Notebooks", "Official apps", "ENEX supported"],
      ["Obsidian", "Local files; official sync is paid", "File vault", "All major platforms", "Community tools"],
      ["Memos", "Self-hostable", "Timeline cards", "Web-first", "Not this migration path"],
    ],
    pathsTitle: "What to do next",
    paths: [
      {
        title: "Self-host on Cloudflare",
        summary: "The default for personal use if you do not want to run a server. A personal library typically fits about 150,000 short notes and 50,000 images.",
        href: "/blog/ai-agent-deploy-cloudflare",
        cta: "Open the Cloudflare guide",
      },
      {
        title: "Self-host with Docker",
        summary: "The same application, installed with one command on a VPS, NAS, or home server. Storage scales with your disk or S3-compatible bucket.",
        href: "/docker-deploy",
        cta: "Open the Docker guide",
      },
      {
        title: "Migrate from Evernote",
        summary: "Use ENEX, evernote-backup, and EdgeEver MCP to keep notebook hierarchy, attachments, and timestamps.",
        href: "/blog/evernote-migration-guide",
        cta: "Open the Evernote guide",
      },
      {
        title: "Migrate from Notion",
        summary: "Use Notion MCP together with EdgeEver MCP and let an AI assistant copy pages across.",
        href: "/blog/notion-migration-guide",
        cta: "Open the Notion guide",
      },
    ],
    faqTitle: "FAQ",
    faqs: [
      {
        question: "What is a self-hosted Evernote alternative?",
        answer:
          "A notes app you deploy yourself, with data in your account or on your hardware, and a workflow close to Evernote notebooks and the three-pane workspace. EdgeEver is built for that, plus open source, MCP, and Cloudflare or Docker hosting.",
      },
      {
        question: "Can I run it with Docker?",
        answer:
          "Yes. There is a one-line installer and a full Docker guide for amd64 and arm64, with local files or S3-compatible object storage. Cloudflare and Docker run the same application.",
      },
      {
        question: "Can I import Evernote notes?",
        answer:
          "Yes. The documented flow uses ENEX, evernote-backup, and an MCP import script. It preserves created/updated timestamps and nested notebooks. Spot-check notes with images after import.",
      },
      {
        question: "Is Cloudflare actually free for personal use?",
        answer:
          "A personal deployment can run within Cloudflare's free quotas, with no extra server to rent. Quotas follow Cloudflare's current limits; move to a paid plan or Docker if you outgrow them.",
      },
      {
        question: "Are there iOS and Android apps?",
        answer:
          "Yes. Android is on Google Play and iOS is on the App Store. The iOS app currently requires an Apple ID from outside mainland China. Web Clipper extensions are on Chrome, Edge, and Firefox.",
      },
      {
        question: "Is EdgeEver affiliated with Evernote?",
        answer:
          "No. EdgeEver is an independent open-source alternative. Migration guides only cover data you already own. Evernote is a trademark of its respective owner.",
      },
    ],
  },
} as const;
