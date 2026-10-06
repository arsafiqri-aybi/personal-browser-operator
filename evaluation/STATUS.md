# Build Status

## Evidence states

- WP-00 Research & Environment Lock — PASS
- WP-01 Architecture Genesis — PASS; Genesis and ledger SHA-256 recomputed and matched `ARCHITECTURE.lock`
- WP-02 Execution Contracts & Schemas — IMPLEMENTED, full schema validation pending
- WP-03 Repository & Build Foundation — IMPLEMENTED, dependency-backed typecheck pending
- WP-04 Playwright Browser Kernel — INITIAL VERTICAL SLICE IMPLEMENTED, real browser execution pending
- WP-05 Persistent Identity & Session Vault — PARTIAL
- WP-06 Observation & Grounding Engine — INITIAL VERTICAL SLICE IMPLEMENTED
- WP-07 MCP Gateway — STDIO + REMOTE STREAMABLE HTTP SOURCES IMPLEMENTED from one shared server factory; runtime smoke test pending
- WP-08 Durable Task State — DURABLE ATOMIC JSON SLICE IMPLEMENTED
- WP-09 Policy Engine — INITIAL RISK GATE IMPLEMENTED
- WP-10 Execution Orchestrator — PARTIAL
- WP-11 Verification Engine — DURABLE VERIFICATION EVIDENCE SLICE IMPLEMENTED
- WP-12 Recovery & Replanning Engine — SAFE-RETRY POLICY SLICE IMPLEMENTED
- WP-13 Instruction Firewall & Security — trust marking + injection signals + DNS/private-network request guard + remote bearer/Host gate IMPLEMENTED; adversarial proof pending
- WP-14 Human Takeover — STATE MACHINE SLICE IMPLEMENTED
- WP-15 Audit & Provenance — HASH-CHAINED RUNTIME AUDIT SLICE IMPLEMENTED
- WP-16 Live Browser Console — NOT STARTED
- WP-17 Runtime Persistence & Recovery — PARTIAL
- WP-18 Evaluation System — test plans present; executable suite incomplete
- WP-19 Deployment & Secure Remote Access — HOST CONTRACT DESIGNED; no deployment evidence yet
- WP-20+ — NOT COMPLETE

## Verified findings

- VFY-001 stale state cannot be reused after navigation or interaction.
- VFY-002 ambiguous semantic targets fail closed.
- VFY-003 architecture genesis SHA-256 matches lock.
- VFY-004 ledger head SHA-256 matches lock.
- VFY-005 task completion requires persisted PASS verification for the same task.
- VFY-006 recovery never marks blind retry safe.
- VFY-007 browser network guard resolves hostnames and blocks private/loopback/link-local destinations by default.
- VFY-008 request interception applies network guard to redirects and subresources.
- VFY-009 MCP SDK current v2 HTTP path uses `createMcpHandler`; Node runtime adapts via `toNodeHandler`.
- VFY-010 MCP server and Node adapter versions are pinned to current compatible releases: server 2.3.0, node 2.1.1.
- VFY-011 local and remote transports use the same `createOperatorServer` factory.
- VFY-012 non-loopback HTTP binding without token is designed to fail at startup.
- VFY-013 current sandbox lacks Playwright/MCP npm packages; dependency-backed runtime execution remains NOT_RUN.

No REAL_BROWSER_VERIFIED or PRODUCTION_READY claim is made.
