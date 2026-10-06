# ADR-0009 - Android package allowlist hardening

Status: Accepted
Architecture version: 0.5.1

## Context

An Android AccessibilityService can inspect the active window of applications for which accessibility content is exposed. A personal device contains unrelated private applications, so a general-purpose accessibility operator must not treat all active packages as eligible targets.

## Decision

The Android execution kernel uses an explicit package allowlist.

The first-use default is:

```text
com.android.chrome
com.instagram.android
com.vivo.browser
```

The user may edit the allowlist in the PBO Mobile Agent configuration screen.

The execution kernel fails closed when:

- the allowlist is empty;
- the active package is not allowlisted.

Both observation and ref-bound interaction enforce the package allowlist. Human takeover remains the path for protected or out-of-scope applications.

## Consequences

The mobile provider has a narrower device privacy boundary. Merely enabling the AccessibilityService does not authorize the operator to inspect every application on the phone. Package access is explicit configuration and is independent of relay authentication, risk authorization, stale-ref protection, and sensitive-input approval.
