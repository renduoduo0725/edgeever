# Chrome Web Store listing

## Product details

- Name: `EdgeEver Web Clipper`
- Primary language: `中文（简体）`
- Category: `Workflow & Planning`
- Homepage: `https://edgeever.org/`
- Support URL: `https://github.com/tianma-if/edgeever/issues`
- Privacy policy: `https://edgeever.org/privacy`

## Localized listings

- `中文（简体）`: Primary language
- `English`: Localized listing

Select the matching language in the Chrome Web Store developer dashboard and enter the corresponding copy below. Store listing localization is separate from the extension's packaged `_locales` messages.

## Upload files

- Package: `store-assets/edgeever-web-clipper-v0.1.7.zip`
- Store icon: `public/icons/icon-128.png`
- Screenshot: `store-assets/screenshot-options-1280x800.jpg`
- Small promo tile: `store-assets/promo-small-440x280.jpg`

### 中文（简体）

#### Summary

将当前网页、选中文字、右键图片或 X 推文保存到你自托管的 EdgeEver 实例。

#### Detailed description

EdgeEver Web Clipper 可以把当前网页、选中的文字、右键选中的图片，或 X 上的一条推文保存到自托管的 EdgeEver 实例。

主要功能：

- 自动提取文章正文，并转换为便于搜索和编辑的 Markdown。
- 选中一段文字后右键，选择“保存选中文字到 EdgeEver”，只保存这段文字。
- 在图片上右键，选择“保存图片到 EdgeEver”，把图片文件存成一条新笔记。
- 在 X 上右键推文正文，选择“保存这条推文到 EdgeEver”。长文会先展开“显示更多”，再保存全文和已经显示的图片。
- 这几项命令直接出现在右键菜单的第一级。
- 在笔记中保留来源网址和剪藏时间。
- 可选择默认笔记本，并自动添加 `web-clip` 标签。
- 网页内容直接发送到你配置的 EdgeEver 实例，不经过开发者的中转服务器。

使用前，请在插件设置中填写 EdgeEver 实例地址和 API Token。插件只会在你点击“剪藏当前网页”，或选择“保存选中文字到 EdgeEver”“保存图片到 EdgeEver”“保存这条推文到 EdgeEver”后读取当前标签页。图片若无法由页面直接交出，才会再向你请求该图片所在网站的访问权限。

EdgeEver 是开源、自托管的现代笔记工作区。项目主页与源代码：https://github.com/tianma-if/edgeever

### English

#### Summary

Save a webpage, selected text, a right-clicked image, or an X post to your self-hosted EdgeEver.

#### Detailed description

EdgeEver Web Clipper saves the current webpage, selected text, a right-clicked image, or an X post to your self-hosted EdgeEver instance.

Key features:

- Extract article content automatically and convert it to searchable, editable Markdown.
- Select text, right-click, and choose “Save selection to EdgeEver” to store that passage only.
- Right-click an image and choose “Save image to EdgeEver” to store the image file as a new note.
- On X, right-click the post text and choose “Save this post to EdgeEver”. Long posts are expanded before saving, so the full text and already shown photos go into one note.
- These commands stay on the top-level right-click menu.
- Preserve the source URL and clipping time in the note.
- Select a default notebook and add the `web-clip` tag automatically.
- Send webpage content directly to your configured EdgeEver instance without a developer-operated relay server.

Before using the extension, enter your EdgeEver instance URL and API token in the extension settings. The extension reads the current tab only after you click “Clip current page” or choose “Save selection to EdgeEver”, “Save image to EdgeEver”, or “Save this post to EdgeEver”. It asks for access to an image's site only when that page cannot provide the image file.

EdgeEver is an open-source, self-hosted modern notes workspace. Project homepage and source code: https://github.com/tianma-if/edgeever

## Privacy practices

### Single purpose

Save the current webpage, user-selected text, a user-chosen image, or one X post to the self-hosted EdgeEver instance explicitly configured by the user.

### Permission justifications

- `activeTab`: Read the active page only after the user clicks the extension's save action or chooses Save selection to EdgeEver, Save image to EdgeEver, or Save this post to EdgeEver.
- `contextMenus`: Add one top-level item for the thing the user right-clicked: selected text, an image, or an X post. It runs only after the user selects that item.
- `scripting`: Inject the packaged capture script into the active page after the user initiates a capture.
- `storage`: Store the user's EdgeEver instance URL, API token, and default notebook ID locally.
- Optional host permissions: Send API requests only to the EdgeEver instance origin the user approves. If a page cannot provide an image file, the extension can also ask for access to that image's site, or to all sites when the user explicitly chooses that option, and uses it only to download the image the user chose to save. Saving a post from an X timeline asks for access to X so the extension can remember which post was under the pointer. The script on X only records that target and runs after the user allows it.

### Data disclosures

The extension handles authentication information, website content, and web browsing activity. These data are used only for the user-triggered clipping feature. Page content is processed locally and sent directly to the user's configured EdgeEver instance. The developer does not receive or retain it.

- Data is not sold or transferred to third parties outside the approved use case.
- Data is not used for purposes unrelated to the extension's single purpose.
- Data is not used for creditworthiness or lending.
- No remote code is used.

## Distribution

- Visibility: Public
- Regions: All regions supported by the Chrome Web Store
- Defer publish: Off, unless a manual launch date is desired
