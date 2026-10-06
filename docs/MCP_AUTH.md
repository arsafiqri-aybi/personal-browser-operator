# MCP Authentication

Personal Browser Operator supports two explicit MCP authentication modes.

## 1. Static bearer — bootstrap and CI

```text
PBO_AUTH_MODE=static-bearer
PBO_MCP_TOKEN=<secret>
```

This is the already-verified mode used by CI and controlled operational bootstrap. The secret is injected by the host and never committed.

## 2. OAuth JWT resource server — production ChatGPT path

```text
PBO_AUTH_MODE=oauth-jwt
PBO_PUBLIC_BASE_URL=https://browser.example.com
PBO_OAUTH_ISSUER=https://identity.example.com
PBO_OAUTH_JWKS_URI=https://identity.example.com/.well-known/jwks.json
PBO_OAUTH_AUDIENCE=https://browser.example.com/mcp
PBO_OAUTH_SCOPE=pbo:mcp
```

In this mode Personal Browser Operator is only the OAuth **resource server**. A dedicated external OAuth 2.1 / OpenID Connect provider remains responsible for user sign-in, authorization, client registration, refresh tokens, and consent.

The public MCP origin exposes RFC 9728 Protected Resource Metadata at:

```text
/.well-known/oauth-protected-resource/mcp
```

The metadata advertises the external authorization server and required scope. It contains no credential.

## Token verification

Before an OAuth-mode request reaches MCP tools, the runtime verifies:

- JWT signature through the configured JWKS;
- exact issuer;
- exact audience;
- expiration;
- subject;
- required `pbo:mcp` scope (or configured replacement).

Missing or invalid tokens receive a Bearer challenge containing the protected-resource metadata URL. Valid tokens without the required scope fail closed.

## Browser credentials are separate

OAuth here protects **access to the browser operator**. It does not replace login to websites inside Chromium.

Website passwords, OTPs, passkeys, and CAPTCHAs continue to use protected same-browser human takeover. They must not be transmitted as MCP tool arguments.

## Deployment rule

Do not embed a long-lived MCP bearer token into `plugin.json`, `mcp.json`, URLs, Git, or ChatGPT-visible instructions.

For a production ChatGPT connection, prefer OAuth resource-server mode once the chosen external identity provider has been configured and verified.
