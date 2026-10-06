# ADR-0001 — Custom MCP over Playwright Library

Status: ACCEPTED
Date: 2026-10-06

## Decision

Build our own MCP server and operator runtime. Use Playwright library as the browser execution kernel.

Do not make the official Playwright MCP the central runtime dependency.

## Why

The product needs ownership of:
- task/goal state;
- action-intent binding;
- persistent identity isolation;
- verification semantics;
- recovery/replanning;
- prompt-injection boundaries;
- audit provenance;
- architecture ledger;
- ChatGPT-specific semantic tool surface.

Directly exposing raw browser primitives would move too much orchestration burden into the model and would weaken consistency.

## Consequences

The runtime must maintain clean boundaries between MCP schema, operator state, policy, browser kernel, verification and persistence.

## Re-plan trigger

Re-open this ADR only if direct Playwright-library embedding becomes infeasible or a host requirement materially mandates another boundary.
