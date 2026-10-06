# Runtime Host Contract

## Requirement

The operator needs a host that can run:
- Node.js 20+;
- Playwright Chromium and its OS dependencies;
- a persistent filesystem for browser profiles and task/audit state;
- long-lived browser processes;
- outbound public web access;
- an HTTPS reverse proxy or secure tunnel for remote MCP use.

A purely ephemeral serverless worker is not the primary browser execution host for this architecture.

## Transport

Local development:

```text
MCP client -> stdio -> operator runtime
```

Remote:

```text
ChatGPT / MCP client
  -> HTTPS edge / reverse proxy
  -> bearer/OAuth authorization layer
  -> /mcp
  -> createMcpHandler(createOperatorServer)
  -> shared durable operator services
  -> Playwright Chromium
```

Both transports instantiate MCP protocol servers from the exact same factory so the semantic tool surface cannot drift.

## Current authentication

The initial private remote transport supports a bearer token.

This is an implementation bootstrap, not the final production identity architecture. For broader distribution or host requirements, replace/augment it with a dedicated OAuth provider without moving authorization into webpage content or browser profiles.

The MCP SDK handler itself does not validate bearer tokens; the runtime must validate authentication before handing the request to MCP.

## Remote startup rule

Binding to anything other than loopback without `PBO_MCP_TOKEN` fails at process startup.

## Reverse proxy rule

When placed behind a tunnel/proxy:
- TLS terminates at the edge or proxy;
- the public MCP hostname must be included in `PBO_ALLOWED_HOSTS`;
- secrets are injected as environment/secret-manager values;
- browser profile data stays on the execution host;
- health endpoint reveals no account/session information.
