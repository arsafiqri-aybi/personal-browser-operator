# RUN-0002 — Container Runtime + Remote MCP + Persistence CI

## Evidence class

Container deployment artifact, authenticated remote MCP, real browser execution, non-root workload, and restart persistence.

## GitHub Actions

- Workflow run: `37417134854`
- Job: `112118124749`
- Commit under test: `618e6215770c5925e976e7b75cd8918f0bb76753`
- Conclusion: **PASS**
- Date: 2026-10-06

## Gates proven

The same CI run passed all of the following:

1. architecture ledger/invariant/DAG validation;
2. strict TypeScript validation;
3. deterministic unit tests;
4. MCP contract tests;
5. matching Playwright Chromium installation;
6. real Playwright browser smoke test;
7. pinned Docker image build;
8. single-gateway container startup;
9. unauthenticated MCP and console access denied;
10. noVNC asset reachable through the gateway;
11. authenticated remote MCP connection;
12. durable task creation and browser session creation;
13. public browser navigation to `https://example.com/`;
14. semantic observation returned as untrusted web data;
15. postcondition verification PASS;
16. durable mutation effect reconciled to `VERIFIED_PASS`;
17. Node MCP runtime executed as non-root UID `1001`;
18. Chromium executed as the same non-root UID `1001`;
19. Chromium persistent profile used `/data/profiles/ci-container`;
20. task state survived container stop/start against the same persistent Docker volume.

## Runtime evidence

Observed page:

- URL: `https://example.com/`
- title: `Example Domain`
- semantic observation contained visible documentation-example text;
- trust boundary remained `UNTRUSTED_WEB_DATA`.

Verification:

- verification ID: `VERIFY-6a08b189-8477-4100-ba8d-97b2ba4aeb96`
- task ID: `TASK-25a1c928-d40f-43f3-ad43-7dd833387ef3`
- title check: PASS
- visible-text check: PASS
- action ID: `ACT-container-example`
- effect status: `VERIFIED_PASS`

Process evidence:

```text
UID 1001 ... node /app/packages/operator-runtime/dist/http.js
UID 1001 ... chrome ... --user-data-dir=/data/profiles/ci-container
```

Restart evidence:

```text
PBO_PERSISTENCE_OK=TASK-25a1c928-d40f-43f3-ad43-7dd833387ef3
PBO_CONTAINER_SMOKE=PASS
```

## What this does NOT prove

This run does **not** prove:

- public-Internet deployment on a persistent external host;
- production TLS/hostname ingress;
- manual same-browser noVNC takeover;
- ChatGPT surface integration;
- user-account authentication durability on a real service;
- a consequential real-account workflow;
- production readiness.

The release-truth ceiling therefore remains `REAL_BROWSER_VERIFIED` until the next applicable release gate is satisfied.
