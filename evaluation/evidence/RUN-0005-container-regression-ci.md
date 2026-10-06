# RUN-0005 — Current-head container regression CI

Date: 2026-10-06

## GitHub Actions

- Workflow: Verify Personal Browser Operator
- Run: 37421450416
- Job: 112131485834
- Commit: 69b3d805b44b318d96036c7ccdd63b2bb7ea10eb
- Conclusion: PASS

## Proven gates

The run completed all workflow steps successfully:

- architecture validation and deterministic verification;
- strict TypeScript and deterministic tests;
- Playwright Chromium installation;
- real Playwright browser observe/interact/re-observe/verify smoke;
- Docker image build;
- single-gateway container startup;
- authenticated remote MCP execution;
- public navigation to the controlled smoke target;
- semantic observation with untrusted-web-data authority boundary;
- postcondition verification PASS;
- durable effect reconciliation to VERIFIED_PASS;
- Node and Chromium execution as pwuser rather than root;
- browser profile existence before restart;
- container restart health;
- durable task recovery after restart;
- browser profile existence after restart.

## Runtime evidence

Observed verification:
- titleIncludes: Example Domain — PASS
- textVisible: documentation examples — PASS
- effect status: VERIFIED_PASS

Observed container checkpoints:
- PBO_PROCESS_OWNERSHIP_OK=PASS
- PBO_PROFILE_PRESENT_BEFORE_RESTART=PASS
- PBO_FIRST_CONTAINER_STOPPED=PASS
- PBO_RESTART_HEALTH_OK=PASS
- PBO_PERSISTENCE_OK=<task-id>
- PBO_PROFILE_PRESENT_AFTER_RESTART=PASS
- PBO_CONTAINER_SMOKE=PASS

## Reliability correction validated by this run

The headed runtime now waits for Xvfb readiness using xdpyinfo before starting Fluxbox and x11vnc, removing the X-display bootstrap race that caused prior intermittent container startup failures.

## Release truth

This evidence supports REAL_BROWSER_VERIFIED and a container-runtime-verified deployment artifact. It does **not** claim external deployment, live OAuth issuer integration, same-browser human takeover over a public HTTPS origin, real-account verification, or production readiness.
