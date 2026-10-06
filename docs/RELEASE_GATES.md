# Release Gates

PBO uses monotonic evidence states. A later label must never be claimed from source code or build success alone.

## Gate sequence

```text
DESIGNED
→ IMPLEMENTED
→ STATICALLY_VALIDATED
→ LOCALLY_TESTED
→ INTEGRATION_TESTED
→ REAL_BROWSER_VERIFIED
→ PUBLIC_HOST_PREFLIGHT_VERIFIED
→ OAUTH_TOKEN_VERIFIED
→ CHATGPT_SURFACE_VERIFIED
→ REAL_ACCOUNT_VERIFIED
→ RELEASE_HARDENED
→ PRODUCTION_READY
```

Current highest proven state remains **REAL_BROWSER_VERIFIED** until a real public deployment passes the public-host checks.

## Public host preflight

Once a real deployment and issuer exist, run:

```bash
PBO_PUBLIC_BASE_URL=https://<pbo-domain> \
PBO_OAUTH_ISSUER=https://<issuer> \
PBO_OAUTH_JWKS_URI=https://<jwks> \
PBO_OAUTH_AUDIENCE=https://<pbo-domain>/mcp \
PBO_OAUTH_SCOPE=pbo:mcp \
npm run preflight:release
```

This gate verifies the public HTTPS surface, OAuth discovery/JWKS baseline, exact MCP resource audience configuration, and a credential-free private-plugin render.

It does **not** prove that a user token can actually be issued with the required audience/scope. That requires the next gate.

## Authorized token gate

A real user authorization must produce an access token that PBO accepts with all of:

- valid issuer signature through configured JWKS;
- exact issuer;
- exact audience equal to public `/mcp`;
- expiration;
- subject;
- required scope `pbo:mcp`;
- successful refresh-token renewal without a new interactive login.

Do not log raw access or refresh tokens as evidence.

## ChatGPT surface gate

After OAuth token verification:

1. render the private plugin using the stable public `/mcp` URL;
2. create/connect the private personal plugin;
3. verify ChatGPT discovers PBO tools;
4. invoke a harmless browser task through ChatGPT;
5. verify observation, action effect, and postcondition through the remote runtime;
6. verify protected human takeover uses the same Chromium session.

Only then may WP-20 advance to a connected state.

## Real-account gate

The first authenticated website pilot must use an account the user owns and a reversible low-risk task. Login secrets stay inside the live Chromium takeover surface and never enter MCP arguments or evidence logs.
