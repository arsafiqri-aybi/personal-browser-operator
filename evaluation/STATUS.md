# Build Status

## Highest proven release-truth state

**REAL_BROWSER_VERIFIED**

The tested vertical slice has passed architecture validation, strict TypeScript, deterministic unit tests, MCP contract tests, Chromium installation, real Playwright browser execution, and a full local-container deployment-artifact smoke test.

The container test additionally proves authenticated remote MCP through the single gateway, non-root Node/Chromium execution, a durable browser profile under `/data`, successful postcondition verification/effect reconciliation, and task persistence across container restart.

It does not yet mean publicly deployed, real-account verified, or production-ready.

## Architecture lock

Architecture version: **0.3.1**  
Ledger head: **ARCH-0004**  
Ledger head SHA-256: `f78739f7796b207afcafee3c2bacf91869b728f6e846e869dd7942d34a2bae46`

Deployment v1 remains locked as:

- provider-neutral persistent container host;
- durable `/data`;
- headed Playwright Chromium;
- one public HTTPS gateway port;
- internal MCP/console/x11vnc/websockify loopback-only;
- explicit gateway routes for MCP, console/API, noVNC, and health;
- root-only volume bootstrap followed by non-root `pwuser` workload.

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

## Deployment status

The deployment artifact is now **container-runtime verified but externally undeployed**.

Cloudflare Containers were evaluated earlier but are unavailable on the current account without Workers Paid. The architecture is intentionally provider-neutral; the next host only needs to support the locked persistent-container contract.

## Current critical path

1. provision a persistent external execution host;
2. deploy the verified Dockerfile;
3. mount a persistent volume at `/data`;
4. configure MCP, console, and VNC secrets;
5. expose only the single HTTPS gateway;
6. verify public `/health`;
7. execute the same remote MCP smoke through the public HTTPS origin;
8. prove same-browser live noVNC takeover;
9. render the already-verified ChatGPT plugin source with the verified public `/mcp` URL;
10. create/connect the private plugin and smoke-test tool discovery from ChatGPT;
11. user-controlled authenticated login bootstrap;
12. controlled real-account pilot.

No `DEPLOYED`, `REAL_ACCOUNT_VERIFIED`, or `PRODUCTION_READY` claim is made.
