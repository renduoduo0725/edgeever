# Firefox Add-ons Submission

## Listing

- Name: EdgeEver Web Clipper
- Summary: Save a webpage, selected text, an image, or an X post to your EdgeEver instance.
- Category: Bookmarks
- Homepage: https://edgeever.org
- Support: https://github.com/tianma-if/edgeever/issues
- Privacy policy: https://edgeever.org/en/privacy

## Description

EdgeEver Web Clipper saves the current webpage, selected text, a right-clicked image, or an X post directly to the self-hosted EdgeEver instance you configure.

- Extract readable article content, or right-click selected text and save that passage only.
- Right-click an image and save that image file as a new note.
- On X, right-click the post text and save the full post, including text behind Show more, plus photos already shown.
- These commands stay on the top-level right-click menu.
- Convert captured HTML to Markdown locally.
- Choose a default EdgeEver notebook.
- Send content directly to your instance without an EdgeEver-operated relay.
- No advertising, analytics, tracking, or telemetry.

Before using the extension, enter your EdgeEver instance URL and API token in the extension settings. The extension reads and sends page content only after you click **Clip current page**, **Save selection to EdgeEver**, **Save image to EdgeEver**, or **Save this post to EdgeEver**.

## Data collection and transmission

- `authenticationInfo`: the API token is sent only to the EdgeEver instance configured by the user.
- `browsingActivity`: the current page URL is included in the note created by the user.
- `websiteContent`: the selected text, extracted article body, or image file is included in the note created by the user.

The project maintainers do not receive or retain this data. Instance settings are stored in the browser's local extension storage.

## Reviewer notes

1. Open the extension settings.
2. Enter the provided review EdgeEver instance URL and API token.
3. Choose **Test connection**, select a notebook, and save.
4. Open a normal HTTP or HTTPS webpage.
5. Open the extension, choose **Clip current page**, and verify that the success message appears.
6. On a normal webpage, select a passage, right-click it, choose **Save selection to EdgeEver**, and verify the note contains that passage and the page link.
7. On a normal webpage, right-click an image, choose **Save image to EdgeEver**, and verify the new note contains the image.
8. Open one X post page, right-click the post text (not a photo), choose **Save this post to EdgeEver**, and verify the note contains the post text and the post link.
9. Verify the created notes in the review EdgeEver instance.

Restricted browser pages, extension stores, built-in PDF viewers, and other privileged pages cannot be captured.

## Reproducible build

Requirements:

- Bun 1.3.14 or later
- Node.js 20 or later, required by `web-ext`

Commands:

```sh
bun install --frozen-lockfile
bun run test:extension
bun run build:extension:firefox
bun run lint:extension:firefox
```

The reviewable source is the repository source before Vite bundling. Third-party packages are installed from the npm registry through the committed Bun lockfile.

## 中文商店说明

EdgeEver 网页剪藏插件可将当前网页、选中的文字、右键选中的图片，或 X 上的一条推文直接保存到用户配置的自托管 EdgeEver 实例。

- 提取适合阅读的文章正文。选中文字后右键，只保存这一段。
- 在图片上右键，把图片文件存成一条新笔记。
- 在 X 上右键推文正文。长文会先展开“显示更多”，再保存全文和已经显示的图片。
- 这些命令直接出现在右键菜单的第一级。
- 在浏览器本地将 HTML 转换为 Markdown。
- 可选择默认 EdgeEver 笔记本。
- 数据直接发送到用户自己的实例，不经过 EdgeEver 中转服务。
- 不包含广告、分析、追踪或遥测。

使用前，请在插件设置中填写 EdgeEver 实例地址和 API Token。插件只会在用户点击“剪藏当前网页”，或选择“保存选中文字到 EdgeEver”“保存图片到 EdgeEver”“保存这条推文到 EdgeEver”后读取并发送网页内容。
