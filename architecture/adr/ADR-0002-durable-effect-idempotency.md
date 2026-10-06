# ADR-0002 — Durable Effect Idempotency

Status: ACCEPTED
Date: 2026-10-06

## Decision

Every browser mutation must carry a caller-stable `actionId` and create a durable effect record before the side effect begins.

Reusing the same `actionId` for the same task/identity/intent/operation suppresses duplicate execution and returns the prior effect state.

Reusing the same `actionId` for a different semantic action is an `ACTION_ID_COLLISION`.

## Why

Browser mutations can outlive transport certainty. A click or submit may succeed even when the client sees a timeout or connection loss. Blind retry can therefore duplicate posts, messages, purchases, form submissions, or settings changes.

## Effect states

- `EXECUTING`
- `EXECUTED_UNVERIFIED`
- `VERIFIED_PASS`
- `VERIFIED_FAIL`
- `FAILED_SAFE`
- `UNKNOWN_EFFECT`

`UNKNOWN_EFFECT` must be reconciled from fresh observation and verification before retry.

## Protected invariants

INV-004, INV-006, INV-007, INV-009, INV-012, INV-016.

## Re-plan trigger

Re-open if the execution kernel changes to a platform with stronger native transaction/idempotency semantics that can supersede this journal without weakening guarantees.
