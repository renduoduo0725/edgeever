# 本机 ACP Agent 的笔记库访问

桌面端在用户向支持会话级 MCP 服务的本机 Agent 发送消息时，自动提供当前登录账号的 EdgeEver MCP 工具。用户无需在该 Agent 中配置 EdgeEver 实例或创建 API Token。工具遵循现有服务端笔记权限，可读取、创建、修改和删除当前工作区中的内容。Agent 的其他本机工具权限仍由其自身和 ACP 客户端控制。

Claude Code 使用 ACP 项目提供的 `claude-agent-acp` 连接组件，Hermes Agent 使用 `hermes acp`；两者均支持会话级 MCP 服务。请先分别安装连接组件或 Agent 并完成认证，再在 EdgeEver 中选择。OpenClaw 使用 `openclaw acp`，但它拒绝会话级 MCP 服务，因此可在 EdgeEver 中使用 ACP 对话，却无法自动访问当前账号的笔记。如需让 OpenClaw 访问笔记，需在其 Gateway 中配置 EdgeEver MCP，并核对目标实例和账号。

对于支持会话级 MCP 的 Agent，桌面主进程保留登录会话凭据，并为每次对话轮次建立仅监听本机的临时转发入口。Agent 获得的是该入口的临时凭据；轮次结束、取消或当前实例及登录会话改变时，入口失效。无法确认当前登录状态时，不启动带笔记工具的 Agent 轮次。

ACP 会话中的服务名为 `edgeever-current-workspace`。如果 Agent 自己已经配置了 EdgeEver MCP，它可能同时看到两套工具。协议层面不会冲突，但两套配置可能指向不同的实例或账号，也可能导致重复写入。EdgeEver 会在会话中指示 Agent 使用本次提供的服务，并在设置中提示用户核对既有配置；ACP 协议无法保证覆盖或移除 Agent 的持久 MCP 配置。

本功能改变了本机 ACP Agent 的权限边界。正式发布前仍须在受支持的真实 Agent、打包桌面客户端和旧版本升级链路上验证工具发现、账号切换、读写及失败恢复。
