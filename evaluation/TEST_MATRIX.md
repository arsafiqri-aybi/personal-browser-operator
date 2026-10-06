# Test Matrix

| Evidence class | Command | Browser required | Purpose |
| --- | --- | --- | --- |
| architecture | `npm run validate:architecture` | no | Genesis hash, ledger head, invariants, dependency DAG |
| type system | `npm run typecheck` | no | TypeScript/API-shape compatibility after dependencies install |
| deterministic unit | `npm run test:unit` | no | policy, recovery, trust marking, persistence, audit, network guard |
| MCP contract | `npm run test:contract` | no browser launch | protocol negotiation, tool discovery, tool call/state roundtrip |
| real browser | `npm run test:browser` | yes | persistent Chromium, observe/ref/interact/stale-state/verification |
| adversarial | future WP-18 suite | yes/no | prompt injection, SSRF, duplicate side effects, identity confusion |
| real account | WP-21 | yes | user-approved authenticated workflow |

A release claim must identify which evidence classes actually ran. Static/source review cannot substitute for real-browser or real-account evidence.
