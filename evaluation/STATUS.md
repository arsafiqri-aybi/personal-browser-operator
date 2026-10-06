# Build Status

## Evidence states

- WP-00 Research & Environment Lock — PASS
- WP-01 Architecture Genesis — PASS; Genesis and ledger SHA-256 recomputed and matched `ARCHITECTURE.lock`
- WP-02 Execution Contracts & Schemas — IMPLEMENTED, full schema validation pending
- WP-03 Repository & Build Foundation — IMPLEMENTED, dependency-backed typecheck pending
- WP-04 Playwright Browser Kernel — INITIAL VERTICAL SLICE IMPLEMENTED; executable browser smoke test defined
- WP-05 Persistent Identity & Session Vault — PARTIAL
- WP-06 Observation & Grounding Engine — INITIAL VERTICAL SLICE IMPLEMENTED
- WP-07 MCP Gateway — STDIO + REMOTE STREAMABLE HTTP from one server factory; contract test defined
- WP-08 Durable Task State — DURABLE ATOMIC JSON SLICE IMPLEMENTED
- WP-09 Policy Engine — INITIAL RISK GATE IMPLEMENTED
- WP-10 Execution Orchestrator — PARTIAL; mutations now carry durable action/effect idempotency records
- WP-11 Verification Engine — DURABLE VERIFICATION EVIDENCE; can reconcile specific actionId effects
- WP-12 Recovery & Replanning Engine — SAFE-RETRY POLICY + duplicate-effect suppression IMPLEMENTED
- WP-13 Instruction Firewall & Security — trust marking + injection signals + DNS/private-network guard + remote bearer/Host gate IMPLEMENTED; adversarial proof pending
- WP-14 Human Takeover — STATE MACHINE SLICE IMPLEMENTED
- WP-15 Audit & Provenance — HASH-CHAINED RUNTIME AUDIT SLICE IMPLEMENTED
- WP-16 Live Browser Console — NOT STARTED
- WP-17 Runtime Persistence & Recovery — PARTIAL; task, verification, effect, audit persistence present
- WP-18 Evaluation System — unit/contract/browser test harness defined
- WP-19 Deployment & Secure Remote Access — HOST CONTRACT DESIGNED; no deployment evidence yet
- WP-20+ — NOT COMPLETE

## New consistency fix

- VFY-014 runtime is now aligned with the Action Contract requirement for stable `action_id`.
- VFY-015 duplicate calls carrying the same actionId are suppressed rather than blindly re-executed.
- VFY-016 reuse of one actionId for different task/identity/intent/operation is rejected as `ACTION_ID_COLLISION`.
- VFY-017 failed mutations that might already have produced an effect are persisted as `UNKNOWN_EFFECT`; recovery requires reconciliation before retry.
- VFY-018 verification can bind back to the effect and promote it to `VERIFIED_PASS` or `VERIFIED_FAIL`.

No REAL_BROWSER_VERIFIED or PRODUCTION_READY claim is made.
