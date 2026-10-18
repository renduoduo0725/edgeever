# 分享图片的可选字体

[English](note-image-fonts.md)

正文设置、海报设计和分享图片使用同一份 23 款具名字体目录，其中包含乔木设计师基础包的全部五款字体。字体资源固定版本，远程按需下载。Web、桌面、Android 和 iOS 的安装资源均不增加这些字体的二进制文件；选择器、加载器和许可声明会增加少量应用代码。

| 字体 | 固定的软件包和样式清单 |
| --- | --- |
| 得意黑 | `@chinese-fonts/dyh@3.0.0/dist/SmileySans-Oblique/result.css` |
| 霞鹜文楷 | `@chinese-fonts/lxgwwenkai@3.0.0/dist/LXGWWenKai-Regular/result.css` |
| 朱雀仿宋 | `@chinese-fonts/zqfs@3.0.0/dist/ZhuqueFangsong-Regular/result.css` |
| 思源黑体 Heavy | `@fontsource/noto-sans-sc@5.3.1/900.css` |
| 普惠体 Regular · 推荐 | `@fontpkg/alibaba-pu-hui-ti-3-0@3.1.2/AlibabaPuHuiTi-3-55-Regular.ttf` |
| 普惠体 Heavy · 推荐 | `@fontpkg/alibaba-pu-hui-ti-3-0@3.1.2/AlibabaPuHuiTi-3-105-Heavy.ttf` |
| 优设标题黑 · 推荐 | `@fontpkg/you-she-biao-ti-hei@1.0.0/优设标题黑.ttf` |
| 阿里妈妈数黑体 · 推荐 | `@fontpkg/alimama-shu-hei-ti@1.0.5/AlimamaShuHeiTi-Bold.ttf` |

得意黑也是五款推荐包的成员。新增四款推荐字体使用未经修改的原始文件，固定字节长度与 SHA-256 摘要；支持 Web Crypto 时校验 SHA-256，所有环境均检查长度与容器。四个文件分别约 8.53 MB、2.54 MB、1.41 MB、1.36 MB，不转换、不拆分。选中字体或其预览行进入可见区域时，才下载对应原文件，安装应用时不下载。展开并滚动列表可能下载多款完整字体。

分享图片、正文排版与海报设计共用的字体清单定义在 `packages/shared/src/font-catalog.ts`，`note-image-remote-fonts.ts` 保留原分享图片导出的兼容入口，分片来自[中文网字计划](https://github.com/KonghaYao/chinese-free-web-font-storage)和 [Fontsource](https://fontsource.org/fonts/noto-sans-sc)。每次请求先使用 jsDelivr，失败后尝试 unpkg。对于使用 CSS 分片的字体，只接受固定软件包目录内的 WOFF2 字体描述，不将远程样式直接插入页面。

对于使用 CSS 分片的字体，选择后才请求其样式清单。渲染器根据卡片文字匹配 Unicode 范围，仅下载命中的分片，不下载整个字体家族。字符匹配在本地进行，字体请求不会发送笔记正文。清单和字体数据保存在独立、可丢弃的 IndexedDB 缓存 `edgeever-share-font-cache` 中；重复下载会合并，失败请求可以重试，存储不可用时仍可联网渲染。生成图片前会等待字体加载完成。

离线复用需要清单和相关文字分片仍在缓存中，新增字符可能需要另行下载。浏览器回收存储、WebView 限制或清理站点数据可能使离线缓存失效；可用时仍会使用 HTTP 缓存和会话内请求复用。在正文设置中选择目录字体会改变编辑器排版；现有卡片主题字体仍然保留。

原先四款可选字体采用 SIL OFL 1.1；本次新增的四款推荐字体保留原厂商授权及内嵌声明，不按 OFL 字体处理。版权声明和完整许可保留在 `packages/shared/src/note-image-remote-font-notices.ts`，并包含在 OFL 字体的生成 CSS 中，原始文件字体则在 CSS 中保留来源说明。字体轮廓和字体文件名称未经修改，CSS 家族别名用于隔离分享图片与编辑器字体。

本次检查包括共享单元测试、Web 与移动端类型检查、Web 构建、iOS 编辑器类型检查与构建，以及 Chrome 中联网导出和刷新页面后阻断字体 CDN 的导出验证。Android USB 真机与 iOS 真机仍需单独验收，桌面浏览器结果不代表原生平台已通过验收。

Web 字体选择器中的可见名称以及当前选中值使用对应字体显示，隐藏行不会启动预览下载。名称预览与图片导出共用已加载字体和持久资源缓存，不额外生成内嵌 base64 样式，也不加载纸张纹理。预览失败时保留可读的系统字体名称，不影响选择。

## 正文与海报共用字体

`font-loader.ts` 统一负责可选字体的下载、完整性检查、字体注册和导出 CSS。三个入口继续使用原有 `edgeever-share-font-cache` 数据库和 URL 缓存键，先前下载的字体仍可复用。Web `FontLabel` 组件只为可见行预览字体，各列表读取相同的 23 款目录条目及名称。

正文字体沿用原有存储键和旧选项。选择目录字体后，使用共享字体家族，并保留系统或原有本地字体回退。防抖观察器会在正文变化或切换笔记时加载新增字符分片。公开分享通过既有正文字体设置接受目录 ID，不改变数据库结构、不新增迁移。

海报源稿保留既有中文字体家族名称，加载时映射到目录 ID。模板先加载所选搭配，以及实际使用的明确字体和固定文字，再完成最终排版；创建文字对象和导出 PNG 时会等待对应文字的字体就绪。序列化源稿重开时走同一链路。全部 23 款海报字体统一使用共享加载器。旧正文选项保持可读，已选中的旧选项仍可显示；新选择使用共同目录。界面字体保留原有选项。

客户端不新增字体二进制文件，共享目录、加载器与预览控件会增加应用代码。Android 和 iOS 真机验收仍需单独完成，Web 与编辑器资源构建不能代替真机验收。

## 23 款统一字体目录

正文设置、海报设计和分享图片使用同一份 23 款字体目录，顺序和名称一致。各入口仍保留跟随系统、跟随主题等适用的特殊选项。旧正文设置保持可读，当前已选中的旧字体仍可显示，新选择使用共同目录。

新增接入的 15 款为：思源宋体、Anton、抖音美好体、马善政楷书、江城圆体、站酷庆科黄油体、未来荧黑、站酷快乐体、思源黑体、思源宋体 Heavy、Inter、DM Serif Display、Bebas Neue、Space Grotesk 和 JetBrains Mono。复用仓库提交 `0da78f6ce8a4643b2dfb7afe9f7a5101472c4ffb` 中已有的海报字体文件，目录记录文件长度和 SHA-256 摘要。Web 和桌面端优先复用已有 `/poster-fonts/` 资源，再尝试固定提交的 jsDelivr GitHub 地址和 raw GitHub 镜像；使用 file URL 的原生 WebView 使用远程来源。所有来源共用缓存键、完整性校验、加载状态和失败重试。

这些已有文件保持原样，包括此前已做过子集化的 WOFF2 文件。版权与许可全文通过 `poster-font-notices.ts` 保留在导出 CSS 中。西文字体的中文字符使用常规后备字体，下载西文字体不会增加其中文字形。没有新增或复制字体二进制到客户端安装包，仅增加目录、许可和应用代码。

Android 直接读取共享目录。iOS 选项由 `bun scripts/sync-font-catalog.mjs` 从同一目录生成，使用 `--check` 检查同步情况，确保已保存的分享字体与编辑器渲染一致。浏览器验证不能替代原生设备验收。
