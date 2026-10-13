# Claude Code with a custom gateway

The desktop Claude Code connector runs locally. Its credentials and model configuration belong to Claude Code, independently of the AI providers configured on your EdgeEver instance.

Apps launched from Finder or Dock do not read `~/.zshrc`. Put persistent Claude Code configuration in the user-level `~/.claude/settings.json` instead of relying only on shell exports. EdgeEver creates temporary ACP workspaces, so settings in your development project's `.claude/` directory do not configure those sessions.

Merge this example into your existing user settings; do not overwrite unrelated settings. Replace the endpoint, key, and model ID with values accepted by your gateway:

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

This selects the `opus` family and maps it to the gateway's full model ID. If you select Sonnet or Haiku, configure the corresponding `ANTHROPIC_DEFAULT_SONNET_MODEL` or `ANTHROPIC_DEFAULT_HAIKU_MODEL` mapping as well. Follow your gateway's authentication instructions if it uses `ANTHROPIC_AUTH_TOKEN` instead of `ANTHROPIC_API_KEY`; do not set conflicting credentials.

Keep this file private: it contains credentials. Existing shell environment variables can also affect model selection; the connector gives `ANTHROPIC_MODEL` priority over the `model` setting. If you start EdgeEver from a terminal, check for conflicting exports.

In EdgeEver, open **Settings → Models & Agents**, select **Claude Code**, and check the connection again. Then send a short message to verify the gateway actually accepts the configured model. A successful connection check does not verify model access, gateway availability, or billing quota.

When the adapter explicitly reports no credentials, EdgeEver displays **Not signed in / missing credentials**. When it advertises authentication reporting but does not return a status, EdgeEver reports that authentication status could not be verified. Older connectors without this extension retain their session-based connection check.

Adapter stderr is recorded as bounded, sanitized `acp.adapter-stderr` events in `desktop.log`. On macOS the default location is `~/Library/Application Support/EdgeEver/logs/desktop.log`; a custom desktop data directory changes this location. Review logs before sharing them, and never share your settings file or credentials.

References: [Claude Code settings](https://code.claude.com/docs/en/settings), [model configuration](https://code.claude.com/docs/en/model-config).
