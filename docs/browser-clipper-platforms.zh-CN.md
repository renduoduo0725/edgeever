# 浏览器平台剪藏

[English](browser-clipper-platforms.md)

关联 [Issue #493](https://github.com/tianma-if/edgeever/issues/493) 和[实施方案](browser-clipper-platform-expansion-plan.zh-CN.md)。更新于 2026-10-11：Phase 1 已准备提交 PR 审查；扩展商店发布和完整跨浏览器实站验收仍待完成。

## Phase 1：五个社交平台（2026-10-10）

Facebook、Instagram、LinkedIn、Threads、Bluesky 已新增专用读取器。打开支持的单帖后使用工具栏，或在帖卡上右键选择对应平台命令。选区剪藏保持优先。已打开的信息流需要刷新一次以加载目标监听器；无法识别卡片时打开详情页。不自动抓取或代为登录。

| 平台 | 支持的详情 URL | 保存内容 |
| --- | --- | --- |
| Facebook | `facebook.com/{account}/posts/{id}`、`permalink.php`、`story.php` | 完整可读主帖、作者／组织、可用时间、已加载配图，排除评论与控件。 |
| Instagram | `instagram.com/p/{code}/`、`/reel/{code}/` | 完整可读配文、Handle、时间、完整已加载轮播图片或视频封面。 |
| LinkedIn | `linkedin.com/posts/…-activity-{id}-…`、`/feed/update/urn:li:activity:{id}/` | 完整动态、发布者、时间、完整已加载图集。 |
| Threads | `threads.com/@{handle}/post/{code}` 及 `threads.net` 别名 | 完整动态、Handle、时间、已加载图片及明确引用内容。 |
| Bluesky | `bsky.app/profile/{handle}/post/{id}` | 正文、作者、可用时间、CDN 原尺寸图片及可见引用帖。 |

标签为 `web-clip` 加 `facebook`、`instagram`、`linkedin`、`threads` 或 `bluesky`。不下载视频。轮播缺项、正文截断、登录墙及错误 ID 会明确失败。来源身份使用帖头链接，排除正文及引用帖中的链接；隐藏 Meta 卡片不视为可读。

在 Ego Chromium 中采样了未登录真实页面，五站右键目标均已实测，包含 Bluesky 信息流。去敏夹具中 Facebook／Instagram／LinkedIn／Threads／Bluesky 预期图片数为 1／3／8／4／1。实际打包脚本测试覆盖菜单与工具栏一致性、信息流定位、引用内容、排队右键、导航、错误身份和图片部分失败。Chromium 持久化测试加载真实扩展及夹具，通过本地 API 保存；图片来源使用受控本地服务器，不是真实 CDN。屏蔽来源后检查全部预期附件及重新打开的编辑器正文。

本 PR 包含实现与回归检查。210 项扩展测试、根项目与移动端类型检查、Web 及 Chromium／Firefox 构建通过；Firefox lint 保留两条上游 Readability 警告。登录后的推荐流、Edge／Firefox 运行时保存及 Firefox Android 仍未验收。


八个平台的 Chromium E2E 通过（先前三个适配器加 P1），覆盖全部预期图片资源、重新打开编辑器后的图片、不可读页面拒绝和测试数据清理。Wrangler 4.112.0 开发代理间歇对 POST 返回 `503`，正文为 “Your worker restarted mid-request”。本次通过 `EDGE_EVER_CLIPPER_TEST_INSTANCE_URL=http://127.0.0.1:64641` 直连同一本地 workerd API；新开发进程需要重新确定内部端口，测试默认实例 URL 仍使用 base URL。未改生产 API 或运行时代码。Ego 已安装的开发扩展已重新加载；原有来源页需刷新以加载新目标监听器。

2026-10-11：修复 Instagram 为轮播各页提供独立配文时的误判。读取器用目标帖链接和当前可见页配文确认内容，保留已加载的全部逐张配文与媒体封面；父级文案若只是截断前缀则用完整逐张文案替换，独立父级文案继续保留。Google 的 `DeKe6teEpya` 实站页面已读取已加载的父级配文和 20 张封面（1 个视频、19 张照片）；回归检查任意页配文、隐藏卡片、无关文字和轮播缺项。视频本身仍不下载。新增样例通过真实扩展、本地 API、20 张图片转存和屏蔽来源后重开笔记的 Chromium E2E；本次使用默认本地实例地址。

2026-10-11：补齐 LinkedIn `ugcPost` 分享链接和登录后 SDUI 帖卡识别，UGC 与 activity ID 保持区分。目标身份从主配文中的准确 UGC ID 读取，不使用评论或引用链接。实站样例 `7497764716677758977` 已读取完整正文、Friends of NASA、页面显示的相对时间和 8 张图片；归档正文中的 LinkedIn 安全跳转链接还原为目的地址，不保留跳转跟踪参数。该样例的单独 Chromium E2E 通过真实扩展、本地 API、8 张图片转存和屏蔽来源后重开笔记；使用同一 workerd 的内部 API 地址避开开发代理的间歇 503。整组测试首次遇到代理 503，重跑后停在先前 Instagram 的浏览器流程并被中断，因此本次不声称整组 E2E 通过。测试笔记及令牌已清理。

2026-10-11：补齐未登录的 LinkedIn UGC 帖子。公开帖卡同时提供 `data-activity-urn` 和 `data-attributed-urn`，JSON-LD 使用 activity 地址；读取器依据帖卡本身的声明匹配 UGC 请求，并保留请求的来源身份。匿名 HTTP 响应确认有完整正文、准确发布时间和全部 8 张图片，不要求登录；错误归属 ID 和正文中的其他帖子链接仍被拒绝。该未登录样例通过真实扩展、本地 API、8 张图片转存及屏蔽来源后重开显示的单独 Chromium E2E；多状态连续测试未完成，不据此声称整组 E2E 通过。

2026-10-11：对照本地实例中同一 LinkedIn 帖子的登录与未登录剪藏，正文文字、8 张图片及顺序一致。移除误混入正文的作者资料（如关注者数量）；帖子正文中相同的文字仍保留。登录与未登录正文共用清理和 Markdown 转换：统一换行、跳转链接、话题链接及 LinkedIn 自动添加的链接加粗；可见正文不完整时才用 JSON-LD 补全文本。两份真实页面样本在 Chromium 中得到完全一致的正文 Markdown 和链接目标，均保留 8 张图片，回归测试直接比较两种状态的正文。发布时间保留页面实际提供的精确或相对时间。已有笔记不自动改写。

2026-10-11：修复 Threads `DeMqtuYgkaL` 的省略链接导致可读配文匹配失败。仅在准确帖卡和发布时间链接范围内，使用真实 href 核对配文中的链接；错误链接仍拒绝。实站读取到完整配文、NASA、原发布时间和 1 张视频封面，不下载视频。

## Substack 短帖与已加载文章

Substack Note 详情页 `https://substack.com/@{handle}/note/c-{id}` 通过工具栏或详情页右键菜单保存。按原帖的作者路径、Note ID 和头部永久链接绑定正文；优先使用完整详情，避免选中同一帖子在推荐列表里的截断卡片。保留当前显示的全部段落、格式、作者、来源时间和已加载配图，排除头像、互动操作、评论及侧栏；隐藏或截断正文明确失败。当前仅适配上述详情 URL，不声明推荐流右键定位支持。

Substack 长文章仍通过网页采集入口，识别 Substack 子域名，以及带 Substack 样式资源标记的自定义域名。保留文章标题、副标题、正文、章节、图片与图注，排除订阅组件、分享按钮和章节链接控件。选区继续优先，只读取当前页面内容；未验证付费文章及特殊媒体嵌入。

2026-10-11：实测用户提供的 Ted Gioia Note `c-357811021`，未登录页面可阅读完整五段正文和一张配图；发布时间来自该原帖 JSON-LD。实站读取排除评论与侧栏。另实测 One Useful Thing 自定义域名的公开文章 `the-dot-and-the-swarm`，保留首尾正文、三个章节和三张图片。两份脱敏结构样例通过单独 Chromium E2E：真实扩展、本地 API、全部图片转存、屏蔽来源后重开笔记显示图片。短帖另外使用真实 Substack CDN 配图验证，独立下载 65,583 字节，归档前后 SHA-256 一致，屏蔽来源后重开仍显示；长文章图片验证使用受控下载源。测试笔记与令牌已清理，完整平台 E2E 本次未重跑；不声明所有 Substack 页面或跨浏览器运行时均已验收。

## Medium 已加载文章

Medium 仍通过通用网页剪藏入口保存，新增正文块提取：保留页面已经显示的标题、副标题、正文、章节、图片和图注，去掉会员提示、互动数字、高亮操作提示及图片查看提示。识别 Medium 域名和带 Medium 站点标记的自定义域名；不抓取隐藏付费正文。选区优先级保持不变。

2026-10-11：实测用户提供的文章 `a2ce2e6de88e`，原 Medium 地址跳转到 `scottbatson.dev`。当前浏览器可阅读完整正文，实站提取保留首尾正文、Slow work／Writing 章节及 2 张图片和图注。该文章及上述 Threads 样例通过单独 Chromium E2E：真实扩展、本地 API、全部图片转存、屏蔽来源后重开笔记并显示图片。图片下载源由受控本地服务器替代，不能据此宣称真实 CDN 转存或 Medium 所有文章已验收。沿用同一 workerd 的内部地址避开开发代理间歇 503；测试笔记和令牌已清理。整组 E2E 未在本次重跑。

## 先前的详情页适配

## 使用方式

配置扩展的 EdgeEver 实例和 API Token 后，打开详情页，使用工具栏保存，或在页面空白处右键选择对应平台的保存命令。

| 平台 | 详情页 | 保存内容 |
| --- | --- | --- |
| Hacker News | `https://news.ycombinator.com/item?id=…` 主帖 | 标题、可用作者和发布时间、采集时积分、正文和原始外链。链接帖可以没有正文；不继续抓取外链文章。 |
| V2EX | `https://www.v2ex.com/t/…` 或 `https://v2ex.com/t/…` | 正文、可用作者和发布时间、全部附言及其序号和可用时间，不含评论。 |
| 小宇宙 | `https://www.xiaoyuzhoufm.com/episode/…` | 单集标题、节目名称、发布时间、完整 Show Notes、其中的时间轴和明确写出的主播、封面及正文图片。没有有效链接的时间戳保留为文本。 |

有文本选区时，工具栏优先保存选区。已有选区和图片右键命令保留；新菜单只使用页面上下文。首页、列表、节目主页、用户主页和 HN 评论页不属于专用剪藏目标，请先打开详情页。

平台笔记带 `web-clip` 和 `hacker-news`、`v2ex` 或 `xiaoyuzhou` 标签。来源去除跟踪参数、评论分页和锚点。原始发布时间与采集时间分别记录；只有日期或相对时间时保留其精度，缺失字段省略。

抓取时间、发布时间和附言时间统一使用剪藏时浏览器所在系统的时区，格式为 `yyyy-MM-dd HH:mm:ss`，不显示时区标记或小数秒。例如在 Asia/Shanghai 系统环境中，V2EX 的 `2023-12-13T13:25:31+08:00` 显示为 `2023-12-13 13:25:31`。时区明确时换算到系统时区；未知时区不推测，保留原始时钟值，只有日期或相对时间时保持原信息。HN 页面省略时区的完整时间已与官方 API 的 Unix 时间戳核对，HN 专用解析器为其补上 `Z`。这些时间保存为正文文本，不随之后的设备时区变化。现有视频笔记仅记录本地抓取日期。V2EX 附言以序号作为小标题，时间另起一段普通文本。格式调整用于新剪藏，已有笔记保持原样。

详情页读取失败时，不回退成整页保存。按提示登录、等待加载、展开正文或回到目标详情页后重试。小宇宙只有确认 Show Notes 为空时，才保存元数据并注明“本期无 Show Notes”；读取失败不等于没有内容。不下载音频、不转录，也不生成摘要。

## 图片与反馈

正文先保存，再沿用现有图片转存流程：最多 30 张、每张 20 MiB、累计 60 MiB，完整流程预算 45 秒。

- 无图片或图片全部转存时显示保存成功；只有全部转存后才说明图片已归档。
- 下载、上传、回写失败或超限时，保留笔记并提示“正文已保存，部分图片仍为外链”。超出 30 张的图片也计入未转存数量。
- 转存期间编辑过笔记时，保留用户版本，不覆盖，也不重复创建。

图片归档表示图片可从 EdgeEver 实例资源读取，不是对整个客户端断网能力的新承诺。

## 验证记录

代码基线为上游 `96626ef2`，扩展开发版本为 `0.1.17`，未递增商店版本。以下先前记录描述上一批本地验证。

以下检查通过：

```sh
bun run test:extension
bun run typecheck
bun run typecheck:mobile
bun run build:web
bun run build:extension
bun run build:extension:firefox
bun run lint:extension:firefox
bunx playwright test tests/e2e/web-clipper-html-safety.spec.ts tests/e2e/web-clipper-platforms.spec.ts tests/e2e/web-clipper-page-images.spec.ts --reporter=line
```

扩展测试 **136 项通过**，**3 项 Chromium E2E 通过**；类型检查、移动端类型检查、Web 与 Chromium/Firefox 扩展构建通过。Firefox lint 为 **0 errors、0 notices、2 warnings**；lint 和 Chromium 验证不代表 Firefox 实机验收完成。

2026-10-09 补充回归：此前 HN 提交 `16e11216` 将发布时间保存为不带时区的文本。对照[官方 API](https://hacker-news.firebaseio.com/v0/item/40380738.json)，样本的 `1715879518` 对应 `2024-05-16T17:11:58Z`；已修正 HN 专用解析器，并验证显式时区、仅日期和相对时间保持原样。在实际安装的 Ego Chromium 扩展设置页复现的三条 `cross-world extension resource mismatch` 警告，通过仅在扩展构建中设置 `modulePreload: false` 消除；设置页及弹窗正常加载，“测试连接”成功返回笔记本列表。

小宇宙自身的 `UNSAFE_VAR_ASSIGNMENT` 已修复：复用已有 Domino 依赖，在纯 JavaScript DOM 中解析完整性校验数据，仍只保存页面 DOM 中的正文；注入脚本增加约 236 KB，未新增依赖或权限。

2026-10-10 已撤回为消除第三方警告而添加的 Readability 补丁、注册和专用测试，并重新安装锁定的原版 `@mozilla/readability@0.6.0`。其正文重试与 `<noscript>` 图片解析中的两条静态警告保留，不屏蔽 lint 规则。当前调用仅传入脱离页面的文档副本，且预先移除脚本、嵌入内容和 `<noscript>`。[Readability 本身不负责清洗不可信 HTML](https://github.com/mozilla/readability#security)，其输出不能直接作为安全 HTML 插入页面。

撤回后重跑 135 项扩展测试和 3 项 Chromium E2E 均通过。Show Notes 校验测试禁止浏览器 HTML 赋值和解析入口，并以脚本、事件属性、图片、iframe、音频和视频探针验证无代码执行或资源请求；活动页面中的对照图片成功触发请求和事件。另两项 E2E 验证通用页面图片保存及三站笔记、图片持久化。上述运行证据属于 Chromium。

- DOM 夹具采自下表的公开页面，移除无关内容和敏感参数，来源与预期记录在 `apps/extension/fixtures/platforms/sources.json`。边界变体为合成测试，不冒充实站样本。
- 测试覆盖元数据、附言、代码、图片、危险 HTML、日期精度、空内容、展开超时、选区优先、消息关联、权限、导航、图片部分失败、超限和编辑冲突。
- Playwright 1.62.1 使用 Chromium / Chrome for Testing **151.0.7922.34** 加载真实扩展，通过本地 API 保存三站样本，各验证成功和不可读失败路径，再在 Web 编辑器重开笔记。关闭来源页并阻断外部来源后，小宇宙封面仍由实例附件显示。仅临时测试扩展授予固定测试主机权限；正式 manifest 未增加权限。测试笔记和 Token 已清理。
- 原有通用页面图片 E2E 通过；扩展测试同时覆盖选区、图片及 X、Reddit、小红书、知乎、GitHub、YouTube/B 站相关代码，未逐站重做实站验收。
- 正确性、简化、设计三个独立只读复审均无未处理实质发现。已修复选区清洗为空后的全文误保存、标题空白误判和小宇宙站内导航旧数据问题。

实站采样在未登录的 Ego Chromium 浏览器中进行，报告的 UA 为 Chrome/152.0.0.0。这些步骤运行构建后的提取脚本；持久化由上述本地实例 E2E 独立验证。

| 样本 | 预期与实测 |
| --- | --- |
| [HN 主帖 40380738](https://news.ycombinator.com/item?id=40380738) | 成功保留作者 `jnnnthnn`、原时间、主帖全文末段和外链，不含评论。 |
| [HN 评论 40384810](https://news.ycombinator.com/item?id=40384810) | 正确返回不可读，拒绝作为主帖。 |
| [V2EX 1000000](https://www.v2ex.com/t/1000000) | HTTP 实页采样及夹具验证保留正文、两条附言和各自时间，不含回复。实站浏览器导航超时，该站浏览器实站保存未验证。 |
| [小宇宙第 25 期](https://www.xiaoyuzhoufm.com/episode/62ad4ae5f9b62781ea058a02) | 完整保留时间轴和最后的音乐条目。展开前 DOM 已含全文，无需额外点击。 |
| [小宇宙第 161 期](https://www.xiaoyuzhoufm.com/episode/6a8ef24e1352af56ff3c83f3) | 从第 25 期经节目页切换后，首屏 `__NEXT_DATA__` 仍为旧 ID。改用当前路由已加载的单集数据校验 DOM 后，提取新 ID、新标题、新正文，无旧单集内容。 |

**尚未完成** Chrome、Edge、Firefox 各自加载扩展后的三站完整实站保存验收；Firefox Android 也未验证，因此本批不能标为全部验收完成。2026-10-09 核对确认 HN 初版已通过 [PR #505](https://github.com/tianma-if/edgeever/pull/505) 合并；本 PR 包含 HN 时间修正、预加载修正及 V2EX/小宇宙实现。


## 2026-10-11 本地审查

本轮修复 Instagram 父级配文截断后遗漏后半正文的问题，保存已加载的全部逐张配文并保留独立父级文案；Meta 可读性检查和右键定位共用同一帖卡边界；拒绝隐藏的 Facebook／Bluesky／LinkedIn 正文；删除依据普通分数正文推测 Bluesky 图片数量的逻辑；已识别但不可读的 Medium／Substack 文章明确失败，不再退回整页采集。文章识别与 Markdown 转换复用共享能力。先前 Instagram 验证没有断言最后一张图片的文案，本轮回归及 Chromium 编辑器验证已补齐。

端到端夹具测试覆盖全部 15 个样例，通过真实扩展、本地 API、图片转存及屏蔽来源后的编辑器重开，同时验证不可读／隐藏内容拒绝和清理。因本地开发代理间歇超时，扩展、API 断言及编辑器 API 请求均直连同一 workerd；这证明本地业务链路，不能视为代理故障已修复，也不代表所有实站 CDN 或浏览器均已验收。浏览器 HTML 安全检查通过。Firefox 仅完成构建与 lint，本轮未新增 Firefox 运行时验收。
