# Build Status

## Highest proven release-truth state

**REAL_BROWSER_VERIFIED**

The tested vertical slice has passed architecture validation, strict TypeScript, unit tests, MCP contract tests, Chromium installation, and a real Playwright browser smoke test.

It does not yet mean deployed, real-account verified, or production-ready.

## Deployment architecture

Architecture version: **0.3.0**
Ledger head: **ARCH-0002**

Deployment v1 is now locked as:
- provider-neutral persistent container host;
- durable `/data`;
- headed Playwright Chromium;
- one public HTTPS gateway port;
- internal MCP/console/x11vnc/websockify loopback-only;
- explicit routes for MCP, console/API, noVNC, and health.

Cloudflare Containers were evaluated but are unavailable on the current account without Workers Paid. No Cloudflare zone is currently available for a stable named Tunnel hostname.

Railway is the preferred first external host once connected because its current platform supports Dockerfile builds, stable HTTPS service domains, persistent volumes, and public target ports.

## Proven CI evidence

GitHub Actions run `37410557580`, job `112097804980`, commit `8f7bd4f657de10d48b450f1be0181d85a178532a` — PASS.

Evidence: `evaluation/evidence/RUN-0001-real-browser-ci.md`.

## Current critical path

1. deploy current Dockerfile to a persistent host
2. mount persistent volume at `/data`
3. configure runtime secrets
4. expose only the single gateway port
5. verify public `/health`
6. remote MCP smoke test
7. same-browser live takeover verification
8. ChatGPT surface integration
9. user-controlled authenticated login bootstrap
10. controlled real-account pilot

No `DEPLOYED`, `REAL_ACCOUNT_VERIFIED`, or `PRODUCTION_READY` claim is made.
