# RUN-0004 — OAuth Resource Server + Full Regression CI

## Evidence class

Standards-based MCP OAuth resource-server implementation plus full real-browser/container regression.

## GitHub Actions

- Workflow run: `37418734195`
- Job: `112123103743`
- Commit under test: `b2126a0d04510393abc00ab80b29b45269e5e87d`
- Conclusion: **PASS**
- Date: 2026-10-06

## Architecture proven

- architecture version: `0.4.0`
- ledger head: `ARCH-0005`
- ledger head hash: `cfa6276bf5a4de7b0a6dc3ce01fea110447ce1dc1e20acf6a15ddc750979b09a`
- protected invariants: 16
- architecture modules: 20

## OAuth properties proven

Deterministic tests proved:

- static bearer exact/constant-time comparison remains valid;
- OAuth production configuration requires HTTPS;
- RFC 9728 protected-resource metadata is generated without secrets;
- protected-resource metadata route resolves to `/.well-known/oauth-protected-resource/mcp`;
- Bearer challenge advertises resource metadata and required scope;
- RSA-signed JWT validation through JWKS succeeds;
- exact issuer is enforced;
- exact audience is enforced;
- expiration and subject claims are required;
- required `pbo:mcp` scope is enforced;
- insufficient scope fails closed;
- wrong audience is rejected as invalid token.

## Regression preservation

The same run also passed:

- architecture validation;
- ChatGPT integration-source validator;
- strict TypeScript;
- all unit tests;
- MCP contract tests;
- Playwright Chromium installation;
- real browser smoke;
- full container gateway/remote-MCP/persistence smoke in the previously verified static-bearer bootstrap mode.

## Not proven

This evidence does not prove:

- a live external OAuth issuer;
- public HTTPS deployment;
- a completed browser-operator OAuth login from ChatGPT;
- live same-browser takeover;
- real-account website workflows.

The release-truth ceiling remains `REAL_BROWSER_VERIFIED`.
