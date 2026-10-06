# Build Status

## Highest proven release-truth state

**REAL_BROWSER_VERIFIED**

The tested vertical slice has passed architecture validation, strict TypeScript, deterministic unit tests, MCP contract tests, Chromium installation, real Playwright browser execution, and a full local-container deployment-artifact smoke test.

The container test additionally proves authenticated remote MCP through the single gateway, non-root Node/Chromium execution, a durable browser profile under `/data`, successful postcondition verification/effect reconciliation, and task persistence across container restart.

Architecture v0.5.1 also adds and verifies a standards-based OAuth JWT resource-server mode for the future production ChatGPT connection while preserving the already-proven static-bearer mode for CI/bootstrap.

It does not yet mean publicly deployed, OAuth-connected to a real issuer, real-account verified, or production-ready.

## Architecture lock

Architecture version: **0.5.1**  
Ledger head: **ARCH-0007**  
Ledger head SHA-256: `cfa6276bf5a4de7b0a6dc3ce01fea110447ce1dc1e20acf6a15ddc750979b09a`

Deployment/auth v1 is locked as:

- provider-neutral persistent container host;
- durable `/data`;
- headed Playwright Chromium;
- one public HTTPS gateway port;
- internal MCP/console/x11vnc/websockify loopback-only;
- explicit gateway routes for MCP, OAuth protected-resource metadata, console/API, noVNC, and health;
- root-only volume bootstrap followed by non-root `pwuser` workload;
- static bearer for bootstrap/CI;
- OAuth resource-server mode for production ChatGPT connection;
- external authorization server; PBO does not mint user OAuth tokens.

## Proven CI evidence

### RUN-0001 — real browser

GitHub Actions run `37410557580`, job `112097804980`, commit `8f7bd4f657de10d48b450f1be0181d85a178532a` — **PASS**.

Evidence: `evaluation/evidence/RUN-0001-real-browser-ci.md`.

### RUN-0002 — container runtime + remote MCP + persistence

GitHub Actions run `37417134854`, job `112118124749`, commit `618e6215770c5925e976e7b75cd8918f0bb76753` — **PASS**.

The run proved real browser execution plus Docker build, authenticated remote MCP, semantic observation, verification/effect reconciliation, non-root Node/Chromium ownership, persistent profile storage, and durable task state across container restart.

Evidence: `evaluation/evidence/RUN-0002-container-runtime-ci.md`.

### RUN-0003 — ChatGPT integration source

GitHub Actions run `37417847128`, job `112120345288`, commit `52706256ee6ab4e3216f3d74323cc56e896f3329` — **PASS**.

The run proved the canonical private-plugin manifest/template/skill renderer is deterministically valid and preserved all real-browser/container regressions. This is source verification only; no plugin connection is claimed.

Evidence: `evaluation/evidence/RUN-0003-chatgpt-integration-source-ci.md`.

### RUN-0004 — OAuth resource-server regression

GitHub Actions run `37418734195`, job `112123103743`, commit `b2126a0d04510393abc00ab80b29b45269e5e87d` — **PASS**.

The run proved architecture v0.4.0 / ARCH-0005, OAuth protected-resource metadata generation, JWT signature/JWKS verification, exact issuer/audience/expiration/subject checks, required-scope enforcement, static-bearer compatibility, and the complete existing real-browser/container regression.

Evidence: `evaluation/evidence/RUN-0004-oauth-resource-server-ci.md`.

### RUN-0005 — current-head container regression

GitHub Actions run `37421450416`, job `112131485834`, commit `69b3d805b44b318d96036c7ccdd63b2bb7ea10eb` — **PASS**.

This run re-proved the current HEAD after the v0.5.x mobile-provider additions: architecture/typecheck/tests, real Playwright browser execution, Docker build, authenticated remote MCP navigation and verification, non-root Node/Chromium ownership, persistent browser profile storage, durable task state across container restart, and deterministic Xvfb bootstrap.

Evidence: `evaluation/evidence/RUN-0005-container-regression-ci.md`.

## Deployment status

The deployment artifact is **container-runtime verified but externally undeployed**.

The OAuth resource-server implementation is **deterministically verified but not connected to a real external issuer**.

## Current critical path

1. provision a persistent external execution host;
2. deploy the verified Dockerfile and mount persistent `/data`;
3. provision/configure an external OAuth/OIDC authorization server;
4. configure `PBO_PUBLIC_BASE_URL`, issuer, JWKS, audience, and scope;
5. expose only the single HTTPS gateway;
6. verify public `/health` and protected-resource metadata;
7. execute remote MCP OAuth smoke through the public HTTPS origin;
8. prove same-browser live noVNC takeover;
9. render the verified ChatGPT plugin source with the public `/mcp` URL;
10. create/connect the private plugin and smoke-test tool discovery from ChatGPT;
11. user-controlled authenticated website login bootstrap;
12. controlled real-account pilot.

No `DEPLOYED`, `OAUTH_CONNECTED`, `REAL_ACCOUNT_VERIFIED`, or `PRODUCTION_READY` claim is made.
