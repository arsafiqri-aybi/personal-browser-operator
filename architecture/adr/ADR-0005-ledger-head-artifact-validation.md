# ADR-0005 — Validate the Full Ledger Chain and Only the Current Head Artifacts

Status: ACCEPTED
Date: 2026-10-06

## Decision

Architecture validation has two distinct integrity duties:

1. Recompute and verify the hash plus `previous_entry_hash` linkage of **every** ledger entry.
2. Recompute raw artifact hashes only for the **current ledger head**.

Historical entries retain the artifact hashes that were authoritative at their point in the chain. They are not compared against the newest contents at the same repository paths.

Git history plus the immutable hash chain provides the historical content trail.

## Why

A legitimate architecture revision may change an artifact such as `Dockerfile` or `architecture.yaml`. Comparing every historical entry's artifact hash to the newest file would make governed evolution impossible and would incorrectly treat a valid new version as tampering.

The chain itself protects historical entry contents. The head artifact check protects the current release state.

## Protected property

A historical ledger entry cannot be silently edited because its own entry hash and every descendant `previous_entry_hash` would cease to validate.

The current architecture cannot drift silently because the ledger head's artifact hashes are checked against the current files.

## Re-plan trigger

If the project later adds a content-addressed historical artifact store, validation may additionally verify archived artifact bytes for every entry.
