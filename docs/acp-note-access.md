# Note access for local ACP agents

When a user sends a message to a local agent that accepts session-scoped MCP servers, EdgeEver automatically supplies MCP tools for the signed-in account. The user does not need to configure the EdgeEver instance in that agent or create an API token. The tools follow the existing server-side note permissions and can read, create, edit, and delete content in the current workspace. The agent's other local tool permissions remain subject to the agent and ACP client.

Claude Code uses the `claude-agent-acp` connector from the ACP project, and Hermes Agent uses `hermes acp`. Both accept session MCP servers. Install and authenticate the connector or agent separately before selecting it in EdgeEver. OpenClaw uses `openclaw acp`, which rejects session-scoped MCP servers. Its ACP conversation can run in EdgeEver, but automatic current-account note access is unavailable. To let OpenClaw access notes, configure EdgeEver MCP in its Gateway and verify the configured instance and account.

For agents that accept session MCP, the desktop main process retains the login credential and creates a temporary loopback bridge for each turn. The agent receives a temporary credential for that bridge. The bridge expires when the turn ends or is cancelled, or when the current instance or login session changes. A turn with note tools does not start if the current sign-in state cannot be verified.

The ACP session server is named `edgeever-current-workspace`. An agent that already has EdgeEver MCP configured may see two sets of tools. This causes no protocol conflict, but the configurations may target different instances or accounts and may lead to duplicate writes. EdgeEver instructs the agent to use the session server and warns the user to check existing configurations. ACP cannot guarantee that an agent's persistent MCP configuration is replaced or removed.

This feature changes the permission boundary for local ACP agents. Before a formal release, verify tool discovery, account switching, writes, and failure recovery with supported real agents, packaged desktop apps, and an upgrade from an older version.
