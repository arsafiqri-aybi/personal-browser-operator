# ADR-0007 — Standard OAuth Resource Server for ChatGPT MCP

Status: ACCEPTED
Date: 2026-10-06

## Decision

Personal Browser Operator keeps the already-verified static bearer mode for local operations, CI, and controlled bootstrap, and adds a standards-based OAuth resource-server mode for production ChatGPT MCP connections.

In OAuth mode:

- the browser operator is an OAuth resource server, not an authorization server;
- a dedicated external OAuth 2.1 / OpenID Connect issuer performs user authorization;
- the MCP gateway publishes RFC 9728 Protected Resource Metadata at `/.well-known/oauth-protected-resource/mcp`;
- the metadata advertises the external authorization server and required MCP scope;
- access tokens are verified locally as signed JWTs using the issuer's JWKS;
- issuer, audience, expiration, signature, and required scope are verified before MCP dispatch;
- missing/invalid tokens fail with a standards-compatible Bearer challenge;
- insufficient scope fails closed;
- static bearer remains available only as an explicit bootstrap/operations mode and is not embedded into Git or plugin source.

## Why

The private browser MCP can operate persistent sessions authenticated to many websites. Its public MCP endpoint therefore needs a connection mechanism that is discoverable by standards-compliant MCP clients without embedding a long-lived bearer secret into a personal plugin package or URL.

The MCP 2026-07-28 authorization model treats the MCP server as an OAuth resource server and recommends a dedicated authorization server for new deployments. This preserves separation between browser authority and identity-provider responsibilities.

## Public route change

The single public origin gains one standards-defined metadata route:

- `/.well-known/oauth-protected-resource/mcp`

This route exposes authorization metadata only. It does not expose browser state, credentials, task state, console state, VNC, or MCP tools.

## Configuration contract

OAuth production mode requires:

- `PBO_AUTH_MODE=oauth-jwt`
- `PBO_PUBLIC_BASE_URL`
- `PBO_OAUTH_ISSUER`
- `PBO_OAUTH_JWKS_URI`
- optional `PBO_OAUTH_AUDIENCE` (defaults to the public `/mcp` URL)
- optional `PBO_OAUTH_SCOPE` (defaults to `pbo:mcp`)

Static bootstrap mode uses `PBO_AUTH_MODE=static-bearer` and `PBO_MCP_TOKEN`.

## Security boundary

- access tokens are accepted only from the Authorization header;
- tokens are never accepted from query parameters;
- JWT signature, issuer, audience, expiration, and scope are mandatory;
- authorization metadata never contains secrets;
- browser/webpage content cannot affect OAuth configuration or token verification;
- the authorization server remains external to the browser runtime;
- existing Host validation and single-ingress routing remain in force.

## Protected invariants

INV-003, INV-004, INV-009, INV-013, INV-014.

## Re-plan trigger

Re-open if the ChatGPT/MCP host requires a materially different standards-compliant authorization profile, the selected identity provider cannot issue refreshable OAuth/OIDC access, or JWT validation cannot meet the deployment's least-privilege requirements.
