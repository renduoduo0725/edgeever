# Claude Code 自建网关配置

桌面端 Claude Code 连接组件在本机运行。凭证和模型配置属于 Claude Code，与 EdgeEver 实例中配置的 AI 服务商相互独立。

从 Finder 或 Dock 启动的应用不会读取 `~/.zshrc`。请将持久配置写入用户级 `~/.claude/settings.json`，不要仅依赖 shell 中的 export。EdgeEver 为 ACP 创建临时工作目录，因此开发项目 `.claude/` 目录中的配置不会配置这些会话。

将下面的示例合并到已有用户配置中，不要覆盖其他设置。将地址、密钥和模型 ID 替换成网关接受的实际值：

```json
{
  "model": "opus",
  "env": {
    "ANTHROPIC_BASE_URL": "https://your-gateway.example",
    "ANTHROPIC_API_KEY": "your-api-key",
    "ANTHROPIC_DEFAULT_OPUS_MODEL": "your-gateway-full-model-id"
  }
}
```

该配置选择 `opus` 系列，并将其映射到网关的完整模型 ID。如果选择 Sonnet 或 Haiku，还需配置对应的 `ANTHROPIC_DEFAULT_SONNET_MODEL` 或 `ANTHROPIC_DEFAULT_HAIKU_MODEL`。如果网关要求使用 `ANTHROPIC_AUTH_TOKEN` 而非 `ANTHROPIC_API_KEY`，请遵循网关说明，避免设置相互冲突的凭证。

该文件包含凭证，请妥善保管。已有 shell 环境变量也可能影响模型选择；连接组件优先使用 `ANTHROPIC_MODEL`，其次使用 `model` 设置。从终端启动 EdgeEver 时，请检查是否有冲突的 export。

在 EdgeEver 的“设置 → 模型与代理”中选择“Claude Code”，重新检查连接，再发送一条简短消息确认网关实际接受配置的模型。连接检查成功不能验证模型权限、网关可用性或计费额度。

适配器明确报告没有凭证时，EdgeEver 显示“未登录 / 缺少凭证”。适配器声明支持认证状态报告但没有返回状态时，EdgeEver 提示无法验证认证状态。没有该扩展的旧连接组件保留基于会话创建的连接检查方式。

适配器 stderr 经过限量、脱敏后，以 `acp.adapter-stderr` 事件写入 `desktop.log`。macOS 默认位置为 `~/Library/Application Support/EdgeEver/logs/desktop.log`；自定义桌面数据目录会改变此位置。分享前请检查日志，不要分享配置文件或凭证。

参考：[Claude Code 配置](https://code.claude.com/docs/en/settings)、[模型配置](https://code.claude.com/docs/en/model-config)。
