# OAuth Provider Gate

## Objective

Choose an external OAuth/OIDC authorization server for the public Personal Browser Operator without weakening the existing resource, audience, scope, PKCE, refresh-token, or user-consent boundaries.

The architecture remains **provider-neutral**. A provider becomes selected only after live issuer evidence passes this gate.

## Non-negotiable production contract

The provider must support:

- HTTPS authorization-server discovery;
- Authorization Code flow;
- PKCE `S256`;
- renewable sessions through Refresh Token grant;
- `offline_access` or an equivalent standards-compatible refresh capability;
- public-key JWT verification through HTTPS JWKS;
- MCP client registration compatible with current ChatGPT behavior, preferably CIMD with DCR fallback where useful;
- RFC 8707 `resource` behavior that yields an access token whose audience is the PBO MCP resource;
- least-privilege authorization that preserves the PBO scope boundary rather than silently replacing it with a broad identity-only scope.

Current PBO target values:

```text
resource / audience = https://<pbo-origin>/mcp
required scope      = pbo:mcp
```

## Candidate A — Auth0

Current status: **preferred first live candidate; not yet selected**.

Why it currently fits best:

- Auth for MCP is generally available;
- supports Client ID Metadata Document (CIMD);
- Resource Parameter Compatibility Profile allows MCP `resource` to map to the API audience;
- Auth0 APIs support custom API scopes, so `pbo:mcp` can remain a real authorization boundary;
- Authorization Code + PKCE and Refresh Tokens with `offline_access` are supported.

Required configuration before a live PBO test:

1. Create/register a custom API whose identifier is the exact public PBO MCP resource URL.
2. Define custom API scope `pbo:mcp`.
3. Enable Allow Offline Access for that API.
4. Enable Resource Parameter Compatibility Profile.
5. Enable/configure Auth for MCP / CIMD for the ChatGPT client path.
6. Confirm the resulting user access token has:
   - `iss` = configured Auth0 issuer;
   - `aud` = exact `https://<pbo-origin>/mcp`;
   - `sub` present;
   - `exp` present;
   - `scope` or equivalent includes `pbo:mcp`.

Do not mark Auth0 selected until an actual ChatGPT-compatible authorization produces that token contract.

## Candidate B — WorkOS AuthKit

Current status: **strong fallback; custom-scope proof required**.

Strengths:

- purpose-built MCP authorization guidance;
- CIMD support with DCR fallback;
- PKCE S256;
- Authorization Code and Refresh Token grants;
- `offline_access`;
- Resource Indicators map directly to access-token `aud` and can use the exact PBO MCP URL.

Known gate:

WorkOS documents that CIMD/DCR clients receive standard OIDC scopes by default. Additional permission scopes for dynamically registered clients require an environment-wide default configuration through WorkOS support. Therefore PBO must not silently replace `pbo:mcp` with `openid` merely to pass authentication.

WorkOS becomes eligible when a live environment proves either:

- `pbo:mcp` is granted to the ChatGPT CIMD/DCR client, or
- a formally reviewed architecture migration defines an equally narrow replacement authorization signal and updates the architecture ledger/invariants accordingly.

## Automated preflight

Run after an issuer exists:

```bash
PBO_OAUTH_ISSUER=https://<issuer> \
PBO_OAUTH_JWKS_URI=https://<issuer-jwks> \
PBO_OAUTH_SCOPE=pbo:mcp \
npm run verify:oauth-provider
```

The preflight proves discovery, HTTPS endpoints, Authorization Code, Refresh Token grant, PKCE S256, `offline_access`, and JWKS availability.

Discovery alone cannot prove the provider will actually grant a custom API scope or mint the exact resource audience. The final provider-selection gate therefore requires an **authorized token pilot** and PBO's own JWT verifier.

## Selection rule

Provider selection is evidence-driven:

```text
DISCOVERY PASS
→ JWKS PASS
→ CIMD/DCR COMPATIBLE
→ AUTHORIZED USER TOKEN
→ exact aud = PBO /mcp
→ required scope present
→ refresh-token renewal works
→ ChatGPT MCP tool discovery works
→ PROVIDER_SELECTED
```

No earlier stage may be reported as OAuth-connected.
