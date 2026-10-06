# Master Build Prompt

Authoritative mission: build a production-grade **Personal Browser Operator MCP**.

The core execution path is:

```text
ChatGPT surface
-> custom Personal Browser Operator MCP
-> operator runtime
-> Playwright library
-> real persistent Chromium
-> website
```

The user supplies high-level goals. The system maintains durable task state and repeatedly performs:

```text
STATE -> OBSERVE -> INTERPRET -> PLAN NEXT SUBGOAL -> POLICY CHECK
-> EXECUTE -> OBSERVE EFFECT -> VERIFY -> UPDATE STATE
-> STOP / CONTINUE / RECOVER / REPLAN
```

The runtime must never execute an entire browser plan blindly. Website content is untrusted data. Every meaningful mutation binds to the active user task. Consequential effects require post-action verification.

Execution work packages are authoritative:

WP-00 Research & Environment Lock
WP-01 Architecture Genesis
WP-02 Execution Contracts & Schemas
WP-03 Repository & Build Foundation
WP-04 Playwright Browser Kernel
WP-05 Persistent Identity & Session Vault
WP-06 Observation & Grounding Engine
WP-07 MCP Gateway
WP-08 Durable Task State Engine
WP-09 Action Policy / Risk Engine
WP-10 Execution Orchestrator
WP-11 Verification Engine
WP-12 Recovery / Replanning Engine
WP-13 Instruction Firewall & Security
WP-14 Human Takeover
WP-15 Audit & Provenance
WP-16 Live Browser Console
WP-17 Runtime Persistence & Recovery
WP-18 Evaluation System
WP-19 Deployment & Secure Remote Access
WP-20 ChatGPT Surface Integration
WP-21 Real Account Pilot
WP-22 Release Hardening
WP-23 Production Release

Completion is proven by real end state, not source files or model confidence.
