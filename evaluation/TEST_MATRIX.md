# Test Matrix

| Evidence class | Command | Browser / Docker required | Purpose |
| --- | --- | --- | --- |
| architecture | `npm run validate:architecture` | no | Genesis hash, full ledger chain, ledger-head artifact hashes, invariants, dependency DAG |
| type system | `npm run typecheck` | no | TypeScript/API-shape compatibility |
| deterministic unit | `npm run test:unit` | no | policy, recovery, trust marking, persistence, audit, network guard, effect idempotency |
| MCP contract | `npm run test:contract` | no browser launch | protocol negotiation, tool discovery, tool-call/state roundtrip |
| real browser | workspace `test:browser` | Playwright Chromium | persistent Chromium, observe/ref/interact/stale-state/verification |
| final container | `npm run test:container` | Docker + outbound Internet | final image build, single gateway, remote MCP auth, real Chromium in container, non-root process proof, volume persistence across restart |
| combined browser gate | `npm run test:browser` | Chromium + Docker | real browser kernel followed by final container deployment smoke |
| adversarial | future expanded WP-18 suite | yes/no | prompt injection, SSRF, duplicate side effects, identity confusion |
| real account | WP-21 | yes | user-approved authenticated workflow |

A release claim must identify which evidence classes actually ran. Static/source review cannot substitute for container, real-browser, or real-account evidence.
