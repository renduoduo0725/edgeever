# 网页剪藏插件商店提交

Chrome、Edge 和 Firefox 的上架由官方仓库工作流 **Submit Web Clipper** 提交。
它和 `bun run release` 分开。产品正式发布不会上传浏览器插件，商店审核也不会
改变 GitHub Release。

Edge 用户安装的是 Chrome 网上应用店商品
`gjadpfmanienmlofajibkfkkpfdkclgo`。一次 Chrome 提交覆盖这个商品。Firefox
单独提交到 `edgeever-web-clipper`。这条工作流不向 Microsoft Edge 附加组件网站
发布。

工作流会构建安装包、上传并提交审核。它不能代替商店审核。用户会留在各自商店
最后一个已通过的版本，直到 Chrome 和 Mozilla 分别审核完成。已经上传过的版本号
不能重复使用。提交改动前要先提高 `apps/extension/package.json` 里的版本。

## 运行

打开 https://github.com/tianma-if/edgeever/actions/workflows/extension-store.yml，
选择 **Run workflow**。Firefox 更新说明留空时，使用一行版本说明；也可以贴上
希望 Mozilla 展示的说明。`dry_run` 只构建安装包，不会调用商店。

本机环境里已经放好下面的凭据时，也可以直接运行：

```sh
bun run publish:extension -- --dry-run
bun run publish:extension -- --notes "这次改了什么。"
```

`--platform chrome` 或 `--platform firefox` 可以只重试一个商店。Chrome
上同一个版本已经在审核中时，会保持原提交。Firefox 上同一个版本正在审核但还没有
源码包时，下一次运行会补上源码包。

## 凭据

把这些 Actions secrets 加到 `tianma-if/edgeever`。Fork 不会运行这个 Job。

Chrome 可以使用服务账号，也可以使用 refresh token。服务账号不会过几天就失效：

1. 在 Google Cloud 启用 Chrome Web Store API，并创建一个服务账号。不要给它
   额外的项目角色。
2. 在 Chrome 网上应用店开发者后台的 Account 里添加这个服务账号邮箱。一个发布者
   只能登记一个服务账号。
3. 创建 JSON 密钥，把整个文件存为
   `CHROME_WEB_STORE_SERVICE_ACCOUNT_JSON`。

refresh token 这条替代路径使用 `CHROME_WEB_STORE_CLIENT_ID`、
`CHROME_WEB_STORE_CLIENT_SECRET` 和 `CHROME_WEB_STORE_REFRESH_TOKEN`，范围是
`https://www.googleapis.com/auth/chromewebstore`。Google 账号需要开启两步验证。
OAuth 客户端如果停留在测试状态，refresh token 会在七天后失效，所以要把同意屏幕
发布出去，或者改用服务账号。

Firefox 使用 https://addons.mozilla.org/developers/addon/api/key/ 生成的 API 密钥：

- `AMO_JWT_ISSUER`
- `AMO_JWT_SECRET`

下面两个可选 secret 会写进 Firefox 给审核员的说明：

- `EDGE_EVER_REVIEW_INSTANCE_URL`
- `EDGE_EVER_REVIEW_API_TOKEN`

Chrome 的上传接口没有更新说明字段。Chrome 的商店简介和隐私披露保持后台里上次
保存的内容。权限或公开介绍发生变化时，先在后台修改。Firefox 会把工作流里的说明
作为 `en-US` 版本说明，并附上 `apps/extension/SOURCE_BUILD.md` 里的构建步骤。

当前 Firefox 商品使用许可证 `AGPL-3.0-only`。工作流每次提交版本都会带上这个许可证。
