# ChatGPT Integration

This directory is the canonical **pre-deployment source** for the Personal Browser Operator ChatGPT plugin.

It intentionally does not contain a committed live `mcp.json` yet. A portable plugin package must point to the actual verified public MCP endpoint; inventing a placeholder remote server would create a package that appears installable but cannot work.

## Source

```text
integrations/chatgpt/personal-browser-operator/
├── plugin.json
├── mcp.json.template
└── skills/
    └── browser-operator/
        └── SKILL.md
```

The browser skill teaches ChatGPT to use the MCP as a stateful operator:

```text
goal
→ durable task
→ persistent browser session
→ observe
→ bounded action
→ effect journal
→ re-observe
→ verify
→ recover / takeover / complete
```

## Render after deployment

After a public HTTPS origin has passed deployment acceptance:

```bash
PBO_MCP_URL=https://<verified-host>/mcp \
node scripts/render-chatgpt-plugin.mjs
```

The renderer fails closed unless the endpoint is public HTTPS and points to `/mcp`.

Output:

```text
dist/personal-browser-operator/
├── plugin.json
├── mcp.json
└── skills/browser-operator/SKILL.md
```

## Connection gates

Do not call the ChatGPT integration complete until all of these are evidenced:

1. public `/health` responds over HTTPS;
2. unauthenticated private routes remain denied;
3. authenticated remote MCP negotiation succeeds;
4. MCP tool discovery matches the intended server;
5. harmless public browser navigation succeeds;
6. observation and verification succeed;
7. the plugin is saved/connected in ChatGPT;
8. a representative harmless tool call succeeds from the ChatGPT surface;
9. same-browser takeover is demonstrated separately before relying on protected login workflows.

## Authentication

The current MCP server has a private bearer-token bootstrap. A final ChatGPT connection must use a host-supported secure authentication/connection path. Never commit bearer tokens into `plugin.json`, `mcp.json`, skills, Git, or chat-visible instructions.

Until a verified public MCP URL and supported connection path exist, WP-20 is source-prepared but not connected.
