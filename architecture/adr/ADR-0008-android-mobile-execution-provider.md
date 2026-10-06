# ADR-0008 - Android mobile execution provider

Status: Accepted
Architecture version: 0.5.0

## Context

The existing Personal Browser Operator executes through persistent Playwright Chromium. Cloud-hosted browser execution can be rate-limited or incur provider-specific runtime limits. The project also requires a path where the user's own Android phone can act as the execution host without exposing a public device port.

## Decision

Add an optional Android mobile execution provider alongside the existing Playwright provider.

The mobile path is:

```text
MCP control plane
-> Secure Mobile Relay (PBO-21)
-> outbound device WebSocket
-> Android Accessibility Execution Kernel (PBO-22)
-> visible phone UI
```

The relay uses a Cloudflare Durable Object to coordinate a single device connection. The device initiates the connection. The relay authenticates device and control-plane traffic with separate secrets.

The Android kernel uses AccessibilityService rather than arbitrary ADB or shell execution for the first vertical slice. It exposes bounded observe, click, fill, URL-open, and BACK/HOME/RECENTS operations.

## Safety and correctness constraints

1. Mobile observations are untrusted data with no instruction authority.
2. Interactive refs are ephemeral and bound to a stateVersion.
3. Every successful mutation invalidates refs and requires fresh observation.
4. Password text is redacted from observations.
5. Password fill fails closed without explicit approval.
6. Login, 2FA, CAPTCHA, passkey, security challenge, and permission-sensitive steps support human takeover.
7. Device and control tokens never enter Git.
8. The existing Playwright provider remains valid and unchanged.

## Consequences

The project becomes execution-provider plural while preserving the same task, policy, effect-idempotency, verification, recovery, and audit concepts. Android screenshot capture, arbitrary shell/ADB, notification access, files, microphone/camera, and silent application management remain out of scope until separately threat-modeled.
