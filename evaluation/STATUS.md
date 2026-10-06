# Build Status

## Evidence states

- WP-00 Research & Environment Lock — PASS
- WP-01 Architecture Genesis — PASS
- WP-02 Execution Contracts & Schemas — IMPLEMENTED, full schema validation pending
- WP-03 Repository & Build Foundation — IMPLEMENTED, dependency-backed typecheck pending
- WP-04 Playwright Browser Kernel — INITIAL VERTICAL SLICE IMPLEMENTED
- WP-05 Persistent Identity & Session Vault — PARTIAL
- WP-06 Observation & Grounding Engine — INITIAL VERTICAL SLICE IMPLEMENTED
- WP-07 MCP Gateway — STDIO + REMOTE STREAMABLE HTTP from one server factory
- WP-08 Durable Task State — DURABLE ATOMIC JSON SLICE IMPLEMENTED
- WP-09 Policy Engine — INITIAL RISK GATE IMPLEMENTED
- WP-10 Execution Orchestrator — PARTIAL; durable action/effect idempotency present
- WP-11 Verification Engine — DURABLE VERIFICATION EVIDENCE
- WP-12 Recovery & Replanning Engine — SAFE-RETRY + duplicate-effect suppression
- WP-13 Instruction Firewall & Security — trust/network/remote-auth boundaries implemented; adversarial proof pending
- WP-14 Human Takeover — STATE MACHINE + same-browser noVNC runtime path DESIGNED/IMPLEMENTED
- WP-15 Audit & Provenance — HASH-CHAINED RUNTIME AUDIT
- WP-16 Live Browser Console — INITIAL IMPLEMENTATION: task state + audit dashboard + noVNC viewport
- WP-17 Runtime Persistence & Recovery — PARTIAL
- WP-18 Evaluation System — unit/contract/browser test harness defined
- WP-19 Deployment & Secure Remote Access — REPRODUCIBLE CONTAINER HOST IMPLEMENTED; live deployment not yet verified
- WP-20+ — NOT COMPLETE

## New evidence/implementation

- VFY-019 Docker runtime is pinned to Playwright image `v1.63.0-noble`.
- VFY-020 Chromium runs headed on the same virtual display exposed to the human through noVNC.
- VFY-021 VNC server is loopback-only inside the container; websockify is the browser-view bridge.
- VFY-022 Docker Compose publishes MCP, console and noVNC on host loopback only by default.
- VFY-023 container startup fails unless MCP token, console token and VNC password are supplied.
- VFY-024 production runtime uses compiled JavaScript rather than tsx for MCP/console processes.
- VFY-025 live console reads durable task and audit state without duplicating browser/session state.

These are source-level implementation claims. Container build/run and real browser evidence are still NOT_RUN from this chat environment.

No REAL_BROWSER_VERIFIED or PRODUCTION_READY claim is made.
