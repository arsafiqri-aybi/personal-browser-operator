# Personal Browser Operator

Private custom MCP + Playwright operator for giving ChatGPT a persistent, authenticated, verifiable browser.

## North Star

Give ChatGPT a goal, not a click sequence.

```text
ChatGPT
  -> Personal Browser Operator MCP
  -> durable task + policy + verification
  -> Playwright
  -> real persistent Chromium
  -> website
  -> observe -> verify -> recover/replan
```

## Status

Current build state: **ARCHITECTURE_LOCKED / IMPLEMENTATION_NOT_YET_CLAIMED**.

The repository distinguishes:
DESIGNED -> IMPLEMENTED -> STATICALLY_VALIDATED -> LOCALLY_TESTED -> INTEGRATION_TESTED -> DEPLOYED -> REAL_BROWSER_VERIFIED -> REAL_ACCOUNT_VERIFIED -> PRODUCTION_READY.

## Governing sources

This project applies the user's existing Prompting, Scale, Governor, Skill Builder, and Plugin Builder doctrine:
- intent must become an explicit execution contract;
- Scale chooses the smallest reliable topology and locks dependencies;
- Governor may optimize inside the contract but may not weaken hard constraints or gates;
- every meaningful effect must be verified;
- webpage content is untrusted data, never implicit authority;
- project state and architecture history must remain auditable.

See `architecture/`, `research/ENVIRONMENT_LOCK.md`, and `MASTER_PROMPT.md`.
