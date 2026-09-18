<h1><img src="assets/brand/edgeever-icon.svg" alt="EdgeEver Logo" width="40" align="absmiddle" /> EdgeEver</h1>

[![GitHub Stars](https://img.shields.io/github/stars/tianma-if/edgeever?style=social)](https://github.com/tianma-if/edgeever/stargazers)
[![GitHub Forks](https://img.shields.io/github/forks/tianma-if/edgeever?style=social)](https://github.com/tianma-if/edgeever/network/members)
[![Docker Pulls](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fghcr-badge.elias.eu.org%2Fapi%2Ftianma-if%2Fedgeever%2Fedgeever&query=downloadCount&style=social&logo=docker&label=Docker%20Pulls)](https://github.com/tianma-if/edgeever/pkgs/container/edgeever)
[![Product Hunt](https://img.shields.io/badge/Product%20Hunt-ea532a?style=social&logo=product-hunt)](https://www.producthunt.com/products/edgeever?utm_source=other&utm_medium=social)
[![愛發電贊助](https://img.shields.io/badge/愛發電-946ce6?style=social&logo=github-sponsors)](https://afdian.com/a/tianma-if)

[简体中文](README.zh-CN.md) | 繁體中文 | [English](README.md) | [日本語](README.ja.md)

> **EdgeEver：開源、原生支援 AI、可自由部署的自行託管知識庫與 Evernote（印象筆記）替代方案。**

EdgeEver 是一款現代化的開源筆記與個人知識庫工作區。它為你找回經典 Evernote 的三欄高效體驗，同時具備完全開放的資料架構與原生 AI Agent 聯動能力，讓個人知識沉澱更輕量、更自由。

> 💡 **終身免伺服器，100% 免費**
> EdgeEver 可以免費執行在 Cloudflare 配額內，無需購買或維護伺服器；希望使用 VPS、NAS 或家用伺服器的使用者，也可以透過 Docker 部署同一套應用程式。

> ⭐ 如果 EdgeEver 對你有幫助，歡迎點個 Star。你的支持會幫助更多人發現這個專案。

## 為什麼做 EdgeEver

很多長期使用 **Evernote** 的使用者，核心需求只是一個**可靠、開放、回應迅速**的個人知識庫。然而，當下的主流方案都各有痛點：

* **Evernote**：功能日益臃腫，商業廣告與繁雜附加功能充斥，效能與記憶體佔用居高不下；且資料相對封閉難以匯出，免費版限制重重，支援 AI/MCP 的方案訂閱成本高昂。
* **Obsidian**：Markdown 開放，核心閉源；官方同步收費，第三方同步繁瑣；圖片與附件與文字混存，儲存庫體積極易膨脹導致行動端同步緩慢，且刪除筆記後殘留附件難清理；對於「隨時隨地隨手記」的輕量場景來說偏重。
* **Memos 等輕量筆記**：雖然簡單好用，但時間軸卡片版面與習慣了經典「三欄工作流程」的使用者有著天然的互動習慣差異。

**EdgeEver 恰好填補了這一空白**：全端開源，雲端同步與自行託管都可自行部署；同時保留經典三欄版面與流暢排版，原生支援接入 AI Agent，部署維護零門檻、零費用。

> 💡 **建議做法：**
> 全平台隨時捕捉靈感與素材，在經典三欄中深度整理沉澱；借助原生 MCP 協定，不僅能讓 AI Agent 隨時檢索與協同思考，還可輕鬆串接 Notion、飛書等外部常用工具鏈；對外一鍵排版發布，完整資料零成本自行託管，打造開放互聯、真正屬於你的智慧第二大腦。

## 線上展示

- Demo 網址：[https://demo.edgeever.org](https://demo.edgeever.org)

公開展示環境會在每天凌晨 3:00（北京時間）自動重設並還原範例筆記，請不要儲存私密內容。

## 用戶端下載

<p>
  <a href="https://github.com/tianma-if/edgeever/releases/latest"><img src="assets/readme/platforms/macos.svg" alt="下載 macOS 用戶端" width="40" height="40" /></a>&nbsp;&nbsp;
  <a href="https://github.com/tianma-if/edgeever/releases/latest"><img src="assets/readme/platforms/windows.svg" alt="下載 Windows 用戶端" width="40" height="40" /></a>&nbsp;&nbsp;
  <a href="https://github.com/tianma-if/edgeever/releases/latest"><img src="assets/readme/platforms/tux.svg" alt="下載 Linux x86_64 AppImage 預覽版" width="40" height="40" /></a>&nbsp;&nbsp;
  <a href="https://play.google.com/store/apps/details?id=org.edgeever.mobile&hl=zh-TW"><img src="assets/readme/platforms/google-play.svg" alt="從 Google Play 下載 Android 用戶端" width="40" height="40" /></a>&nbsp;&nbsp;
  <a href="https://apps.apple.com/tw/app/edgeever/id6792625631"><img src="assets/readme/platforms/app-store.svg" alt="從 App Store 下載 iOS 用戶端" width="40" height="40" /></a>
</p>

> iOS 用戶端需要使用非中國大陸區 Apple ID 下載。

## 功能

- **自由選擇部署方式**：既可免費執行於 Cloudflare Serverless，也可透過 Docker 部署到 VPS、NAS 或家用伺服器。按 Cloudflare 免費儲存額度估算，個人部署可容納約 15 萬條短筆記和約 5 萬張圖片；Docker 儲存可按需擴充，輕鬆承載百萬級筆記與海量圖片。
- **資料開放，不設圍牆**：以標準 SQLite 儲存，提供 REST API、MCP 與 CLI 介面。資料隨時可讀可匯出，不再擔心被任何特定平台綁定。
- **無損 ZIP 打包與無縫遷移**：一鍵打包匯出包含 Markdown、Front Matter、巢狀目錄及附件的完整檔案，同時保留歷史版本與結構化資料，方便在不同實例間完整還原。
- **原生 AI Agent 智慧聯動**：內建 MCP（Model Context Protocol）協定，支援 Claude Code、Codex、Antigravity 等 AI 助手直接讀取與整理筆記，也可與 Notion Database、飛書多維表格輕鬆串接。
- **接入自己的 AI 模型**：支援新增多個 OpenAI、Anthropic、Gemini 相容服務與第三方中轉平台，在編輯器中隨時對全文或選取範圍進行智慧摘要、重點擷取、文法校對、翻譯與續寫潤飾。
- **豐富的外掛 API**：可透過[外掛開發文件](docs/plugin-development.zh-CN.md)擴充 EdgeEver。
- **多端無縫同步，無裝置限制**：自行託管資料無商業限制，擺脫免費帳號僅限 2 台裝置的束縛，在 PC、平板與手機上隨心同步。
- **經典三欄版面與專注模式**：筆記本樹、筆記列表與編輯區一目了然；桌面版一鍵開啟專注模式，讓思緒盡情鋪滿螢幕。
- **無限層級筆記本**：輕鬆建構清晰的多層目錄結構。
- **微信公眾號一鍵排版與複製**：專為中文創作者設計，支援將筆記一鍵轉換為帶行內樣式的公眾號美化格式，直接複製貼上至微信公眾號後台，告別複雜的第三方排版工具。
- **優雅的雙檢視編輯**：桌面版支援在富文字與 Markdown 原始碼檢視之間自由切換。
- **單篇筆記便捷匯出**：可將目前筆記直接匯出為 Markdown、HTML 或 PDF，方便獨立儲存、分享與發布。
- **Mermaid 架構圖與流程圖繪製**：原生支援 Mermaid 程式碼區塊繪製，檢視切換時完整保留可編輯原始碼，讓繪製邏輯圖表更直觀。
- **視覺化圖表筆記**：Web 與桌面版支援建立、編輯心智圖、流程圖和架構圖，提供語意元件、系統邊界、連線說明、自動版面、歷史版本及 PNG/SVG 匯出；Android 與 iOS App 保留同一份圖表資料，並提供語意化唯讀檢視。詳見[視覺化圖表筆記設計說明](docs/visual-diagram-notes.zh-CN.md)。
- **筆記歷史版本回溯**：自動記錄修改歷史，隨時查閱與還原過往版本。
- **公開筆記分享**：支援公開分享筆記，並可隨時取消分享；需要時可為分享連結開啟自動產生的存取密碼。
- **行動 App 微信公眾號文章擷取**：在手機上將微信公眾號文章分享至 EdgeEver，即可擷取正文並儲存為可繼續編輯的筆記。
- **智慧前端圖片壓縮**：圖片上傳前在瀏覽器端靜默完成壓縮，常見截圖與大圖精簡 50%-90% 體積，載入更迅速、儲存更省心。
- **通用檔案附件支援**：支援輕鬆上傳並插入 PDF、Office 文件、壓縮檔及影音等各種附件；透過分塊上傳與串流處理，安全支援最大 1 GiB 附件。
- **高效多選與批次操作**：支援筆記批次合併、批次移動，以及筆記本拖放排序與層級調整。
- **離線草稿與同步佇列**：網路不穩定時自動儲存離線草稿，恢復連線後自動進入佇列同步。
- **登入防暴力破解保護**：伺服端依帳號與 IP 記錄失敗登入並自動限流、冷卻，降低暴力破解與密碼噴灑攻擊風險，守護私密筆記資料。
- **多帳號與個人空間隔離**：單一實例支援建立多個獨立帳號，使用者資料相互隔離，配備直覺的管理員帳號管理與安全加密機制。
- **全平台多端涵蓋**：支援 Web、[Android](https://play.google.com/store/apps/details?id=org.edgeever.mobile&hl=zh-TW)、[macOS](https://github.com/tianma-if/edgeever/releases)、[Windows](https://github.com/tianma-if/edgeever/releases/latest)、[Linux](https://github.com/tianma-if/edgeever/releases/latest) 和 [iOS](https://apps.apple.com/tw/app/edgeever/id6792625631)；網頁擷取擴充功能支援 [Chrome](https://chromewebstore.google.com/detail/edgeever-web-clipper/gjadpfmanienmlofajibkfkkpfdkclgo)、[Edge](https://chromewebstore.google.com/detail/edgeever-web-clipper/gjadpfmanienmlofajibkfkkpfdkclgo) 和 [Firefox](https://addons.mozilla.org/zh-TW/firefox/addon/edgeever-web-clipper/)。

## 部署

Cloudflare 是建議的零伺服器部署方式；希望使用 VPS、NAS 或家用伺服器的使用者也可以選擇 Docker。

Cloudflare 線上部署可以選擇以下兩種方式之一：

### 方案一：AI Agent 一鍵部署（建議）

將下方提示詞直接複製傳送給 AI Agent（如 Codex、Claude、Cursor、workbuddy、Antigravity、OpenClaw、Hermes Agent 等）。執行過程中，如需存取 GitHub 或 Cloudflare，請確認權限範圍並依提示完成授權。

```text
請線上完成 EdgeEver 部署：
1. Fork https://github.com/tianma-if/edgeever。
2. 在 Cloudflare 中建立 D1 `edgeever` 與 R2 `edgeever-resources`。
3. 將這個 Fork 匯入 Cloudflare Workers & Pages，並將 `main` 設為正式環境分支。
4. 新增一個名為 `EDGE_EVER_AUTH_PASSWORD` 的 Worker Secret，值為使用者自行設定的
   管理員登入密碼，建議使用至少 32 個字元且僅用於此實例的強密碼。
5. 啟動首次建置，驗證 `/api/health`、`/api/openapi.json`，並使用使用者名稱 `admin`
   和設定的密碼驗證登入。
6. 啟用並手動執行一次名為 `Update deployed EdgeEver` 的 GitHub Actions 工作流程，
   以便後續自動同步更新，持續獲得 EdgeEver 最新的產品特性與問題修復。
```

> 詳細約定與要求請查看：[AI Agent 線上部署約定](docs/agent-deploy-cloudflare.zh-CN.md)。

### 方案二：手動線上部署

只需在網頁端完成 6 步設定：

1. **Fork 儲存庫**：在 GitHub 點選右上角 **Fork**，將專案 Fork 到您的個人帳戶下。
2. **建立 Cloudflare 資源**：建立 D1 `edgeever` 與 R2 `edgeever-resources`。
3. **匯入並設定專案**：在 Cloudflare **Workers & Pages** 中匯入該 Fork，並將 `main` 設為正式環境分支。binding 由部署指令產生，不要修改 Fork 中的檔案。
4. **設定管理員密碼**：新增一個名為 `EDGE_EVER_AUTH_PASSWORD` 的 Worker Secret，並將其值設為您要使用的管理員登入密碼。建議使用至少 32 個字元且僅用於此實例的強密碼。
5. **首次建置與驗證**：啟動首次建置。部署完成後造訪 `/api/health`，確認回傳 `200`，並使用使用者名稱 `admin` 和設定的密碼驗證登入。
6. **啟用自動更新**：進入 Fork 的 **Actions** 分頁，點選 **I understand my workflows, go ahead and enable them**，然後手動執行一次 **Update deployed EdgeEver**，確保後續能夠自動獲得 EdgeEver 的最新功能與修復。

> 📖 包含具體參數與建置指令的詳細步驟，請查看 [線上部署完整文件](docs/deploy-cloudflare-button.zh-CN.md)。

> 💡 **Cloudflare R2 開通**：雖然 Cloudflare R2 儲存提供了足夠寬裕、在筆記場景中完全不會超量的[免費儲存額度](https://developers.cloudflare.com/r2/pricing/#free-tier)，但需先開通 R2 subscription 並綁定付款方式。Cloudflare [官方支援](https://developers.cloudflare.com/billing/get-started/update-billing-info/#supported-payment-methods) 銀聯（UnionPay）、Visa、Mastercard 等金融卡與信用卡，以及 PayPal、Apple Pay、Google Pay 等付款方式。

### 方案三：在 VPS 或 NAS 上使用 Docker

使用 GitHub 託管的安裝指令碼和官方 GHCR 映像：

```sh
curl -fsSL https://edgeever.org/install.sh | bash
```

此指令會自動拉取最新映像、產生管理員密碼、使用 Docker Compose 啟動
EdgeEver，並設定每日自動更新。手動部署與設定說明見 [Docker 部署文件](docs/deploy-docker.zh-CN.md)。

EdgeEver 官方容器映像託管於 GitHub Container Registry（GHCR）。部分中國大陸
網路環境可能出現連線緩慢或逾時。如果無法正常拉取，請在部署前自行設定可用的
網路代理或可信的映像加速服務。第三方網路及映像服務的可用性與安全性由
使用者自行評估。

---

## 多帳號登入

部署完成後，單一實例支援多帳號登入。

實例管理員可以在 **個人中心** -> **帳號管理** 中建立、停用成員帳號或重設密碼。每個成員擁有完全隔離的個人空間，包括筆記本、筆記、附件、回收筒、匯入匯出和 MCP Token 等。

## 瀏覽器網頁擷取擴充功能

網頁擷取擴充功能已在 Chrome、Microsoft Edge 與 Firefox 正式上架。請從對應的瀏覽器商店安裝（Edge 瀏覽器亦可直接安裝 Chrome Web Store 版本）：

<p>
  <a href="https://chromewebstore.google.com/detail/edgeever-web-clipper/gjadpfmanienmlofajibkfkkpfdkclgo"><img src="https://raw.githubusercontent.com/alrra/browser-logos/58881b84c4d73adc03c06fa2c275a7abee02d935/src/chrome/chrome.svg" alt="為 Google Chrome 安裝 EdgeEver 網頁擷取擴充功能" width="36" height="36" /></a>&nbsp;&nbsp;
  <a href="https://chromewebstore.google.com/detail/edgeever-web-clipper/gjadpfmanienmlofajibkfkkpfdkclgo"><img src="https://raw.githubusercontent.com/alrra/browser-logos/58881b84c4d73adc03c06fa2c275a7abee02d935/src/edge/edge.svg" alt="為 Microsoft Edge 安裝 EdgeEver 網頁擷取擴充功能" width="36" height="36" /></a>&nbsp;&nbsp;
  <a href="https://addons.mozilla.org/zh-TW/firefox/addon/edgeever-web-clipper/"><img src="https://raw.githubusercontent.com/alrra/browser-logos/58881b84c4d73adc03c06fa2c275a7abee02d935/src/firefox/firefox.svg" alt="為 Firefox 安裝 EdgeEver 網頁擷取擴充功能" width="36" height="36" /></a>
</p>

## 社群與回饋

- Bug、功能建議和部署問題請優先提交 [GitHub Issues](https://github.com/tianma-if/edgeever/issues)，方便後續使用者檢索和重用解決方案。
- 貢獻程式碼前請閱讀[貢獻程式碼須知](CONTRIBUTING.zh-CN.md)。如果您的 Fork 同時用於部署 EdgeEver，請將 `main` 分支僅用於部署；從官方 `upstream/main` 新建獨立分支，在該分支中同步上游、開發並提交 Pull Request，不要在部署用的 `main` 上開發或執行 Sync fork。

### 微信交流群

歡迎加入 EdgeEver AI 交流群，這裡聚集了大量 Vibe Coding 與 AI 玩家。一起交流 EdgeEver 體驗、AI Agent 實戰落地、高性價比／免費 AI 資源及自動化工作流程。

> 群組 QR Code 7 天內有效。如果 QR Code 過期，請加入微信 `m1245207870`，並備註「EdgeEver 進群」。

<p align="center">
  <img src="assets/wechat-group-qr.jpg" alt="EdgeEver AI 交流群 QR Code" width="260" />
</p>

## 外掛與主題

EdgeEver 的 Web 與桌面版支援外掛和無程式碼主題，可從外掛市集、GitHub 或 Manifest 網址安裝。安裝清單會隨目前工作區在瀏覽器和桌面應用程式之間同步，每個用戶端會自行下載並校驗外掛套件；Android 和 iOS 原生應用程式不執行外掛。設定和金鑰仍只保存在目前裝置。官方外掛市集僅收錄自由及開源外掛，此要求不限制使用者直接透過 GitHub 或 Manifest 網址安裝其他外掛。開發者可使用 `@edgeever/plugin-api`，詳情參閱[外掛開發文件](docs/plugin-development.zh-CN.md)和[官方外掛市集上架政策](docs/plugin-marketplace-policy.zh-CN.md)。

## 技術棧

- Bun workspace monorepo，包含 Web、API、官網與共享型別套件。
- 前端：Vite、React、React Router、TanStack Query，UI 基於 Tailwind CSS、shadcn/ui、Radix UI。
- 編輯器：TipTap / ProseMirror，支援 Markdown；PWA 使用 vite-plugin-pwa、Workbox、Dexie。
- Android App：`apps/mobile` 中的 Expo + React Native，採用 SQLite 本機儲存與增量同步。
- iOS App：`apps/ios` 中的原生 SwiftUI（iOS 17+），內建 TipTap EditorBundle、GRDB 本機鏡像／outbox，介面與 Android 殼層對齊。
- 原生桌面版：Electron + Rust sidecar，兼顧跨平台一致體驗與高效能本機資料服務；基於 SQLite 支援離線編輯、連網後增量同步與本機備份。
- 網頁擷取：Manifest V3、Mozilla Readability、Turndown，支援 Chrome、Microsoft Edge 與 Firefox。
- 後端：一套基於 Hono/Zod 的業務應用，提供 REST API 與 Remote MCP；Cloudflare 使用 Workers/D1/R2，Docker 使用 Bun/SQLite/本機檔案或 S3。
- 官網：Astro 靜態網站，位於 `apps/site`，可獨立建置並部署到 Cloudflare Pages。

## 快速開始

```sh
bun install
bun run dev
```

本機開發預設自動登入，首次帳號為 `owner` / `edgeever-local-dev`；測試登入頁可主動登出。

## 目錄結構

```text
apps/web          Vite + React 前端、PWA、離線草稿與同步佇列
apps/extension    Chrome/Edge/Firefox Manifest V3 網頁擷取擴充功能
apps/api          Cloudflare Worker + Hono API、MCP endpoint
apps/mobile       Expo + React Native Android App
apps/ios          原生 SwiftUI iOS App（TipTap EditorBundle、GRDB）
apps/desktop      Electron 桌面版殼層、preload bridge 與原生打包設定
apps/site         Astro 官方網站，可獨立部署
packages/client   Web 與行動端共享的 API Client
packages/shared   共享型別、Zod schema、TipTap / Markdown 內容轉換
crates/desktop-sidecar
                   Rust sidecar，負責本機 SQLite、離線資料、備份與資源服務
scripts           Wrangler 封裝、密碼雜湊、CLI、MCP stdio bridge、Evernote ENEX 匯入
migrations        D1/SQLite 共用、只增不改的資料庫 migration
docs              架構、遷移與部署文件
.github/workflows Web、行動端、iOS、桌面版打包、部署與 Release 的 CI
wrangler.toml     Cloudflare Workers、Assets、D1、R2 設定
```

## 內容格式

EdgeEver 同時保存三種內容形態：

```text
content_json      TipTap/ProseMirror 文件，編輯器權威格式
content_markdown  API、Agent、匯入匯出使用
content_text      搜尋、摘要和索引使用
```

請開啟 **我的** -> **匯入與匯出**，匯出或匯入 EdgeEver ZIP。壓縮檔中的 `notes/` 目錄可直接作為 Markdown 閱讀和遷移，結構化資料則用於在 EdgeEver 實例之間完整還原；匯入時目標實例中的無關資料會保留，相同 EdgeEver ID 的內容會被覆蓋。

## MCP

在 **個人中心** -> **MCP 設定** 中建立 API Token 並交給 AI Agent，即可讓 Agent 在帳號授權範圍內安全地管理你的知識庫。系統同時支援文字筆記與圖表筆記（涵蓋心智圖、流程圖和架構圖三種），支援對這些筆記進行完整的增刪改查；同時還可管理筆記範本與 AI 指令，並與 Notion Database、飛書多維表格等工具聯動。

> 💡 **情境啟發：**
> 讓 AI 真正成為你的知識管家與創作外腦——不僅能將方案秒級產生為可互動的心智圖與架構圖，還能為 AI Agent 提供私有脈絡。憑藉 EdgeEver 強大的富文字編輯與精美排版能力，AI 協同沉澱的不再是冰冷文字，而是結構工整、排版優雅、隨時可一鍵分發的高品質知識資產。

## 圖片壓縮規則

圖片壓縮僅在 Web 端上傳前執行，由設定頁的「壓縮筆記內圖片」開關控制。啟用後，瀏覽器會把 PNG、JPEG、WebP、AVIF 嘗試壓縮為 WebP，並將最長邊限制在 `2560px` 以內；如果壓縮結果不比原圖小，則保留原圖。

Cloudflare Worker 側執行圖片處理會消耗運算／圖片處理額度，因此 EdgeEver 將圖片壓縮放在 Web 用戶端完成；REST API 或 MCP 上傳入口會依用戶端提供的檔案內容直接入庫，不再由伺服端自動壓縮。

## 進階物件儲存

實例 Owner 可在**設定 → 進階設定 → OSS 物件儲存**中設定相容 S3 API 的物件儲存。切換儲存不會遷移或影響既有附件。

## 匯入與遷移 (Migration)

若你想從其他筆記軟體遷移到 EdgeEver，請參考以下精簡遷移指引：

- **Evernote（印象筆記）的遷入**：請參考 [docs/evernote-migration-guide.md](docs/evernote-migration-guide.md)
- **Memos 筆記的遷入**：請參考 [docs/memos-migration-guide.md](docs/memos-migration-guide.md)
- **Notion 筆記的遷入**：請參考 [docs/notion-migration-guide.md](docs/notion-migration-guide.md)

## Docker 部署

Docker 與 Cloudflare 共用同一套前端、API 路由、業務服務、鑑權、MCP 實作和 migration。容器使用 SQLite，並支援本機檔案或 S3 相容附件儲存，提供 `amd64` 與 `arm64` 映像。詳見[使用 Docker 部署 EdgeEver](docs/deploy-docker.zh-CN.md)和[自行託管與 Docker 架構](docs/self-hosting-architecture.zh-CN.md)。

## 同步時序

Web、PWA 與桌面版會在停止編輯 30 秒後上傳筆記，並在頁面可見時每 5 分鐘檢查雲端變更；視窗聚焦與手動重新整理仍會立即拉取。可在 [`apps/web/src/lib/workspace-refresh.ts`](apps/web/src/lib/workspace-refresh.ts) 中調整 `DEFERRED_MEMO_SYNC_DELAY_MS` 和 `BACKGROUND_WORKSPACE_REFRESH_INTERVAL_MS`。

## 致謝

- EdgeEver 的筆記產品設計也參考了 [Evernote（印象筆記）](https://evernote.com/) 等成熟筆記工具的公開產品體驗。相關功能由 EdgeEver 獨立設計與實作。
- 心智圖與視覺化圖表筆記的產品設計參考了 [XMind](https://xmind.com/) 和 [ProcessOn](https://www.processon.com/) 等圖表工具的公開產品體驗。相關功能由 EdgeEver 獨立設計與實作。
- 編輯器主題的排版架構、標題層級與章節結構參考了 [obsidian-minimal](https://github.com/kepano/obsidian-minimal)、[Outline](https://github.com/outline/outline) 和 [墨格](https://moyufang.cn/editor) 的公開方案。名稱、素材與實作均由 EdgeEver 獨立完成。

## 商標與品牌使用

EdgeEver 名稱、Logo 及其他品牌識別用於識別官方專案。Fork 或修改版可以說明其「基於 EdgeEver」，但不得暗示官方身分或誤導使用者。開源授權不授予商標權利；其他使用須事先取得專案維護者的書面許可。

## 免責聲明

EdgeEver 是一款完全獨立的開源筆記軟體，由個人和社群自主開發維護。本專案與 Evernote®（印象筆記）及其關聯公司不存在任何商業合作、授權、贊助或隸屬關係。

EdgeEver 是自行託管軟體。除官方展示實例外，專案維護者不託管、控制或審核使用者內容。實例中儲存或展示的內容由使用者或實例營運者負責，不代表專案維護者的立場。
