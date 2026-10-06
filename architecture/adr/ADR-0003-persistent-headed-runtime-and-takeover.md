# ADR-0003 — Persistent Headed Runtime and Same-Browser Takeover

Status: ACCEPTED
Date: 2026-10-06

## Decision

Production browser execution runs on a persistent host capable of long-lived Playwright Chromium, durable filesystem state, and a headed X11 display.

The same Chromium process controlled by Playwright is exposed to the user through a protected noVNC path for login, 2FA, passkey, CAPTCHA, security challenge, or other explicit human takeover.

Remote MCP and operator-console transports use the same runtime state and must not duplicate browser sessions.

## Why

The project requires persistent authenticated sessions and user takeover of the exact browser state AI is operating. Ephemeral browser copies or separate login sessions would break state continuity and increase credential risk.

## Security boundary

- MCP, console, and noVNC are host-loopback bound by default.
- Public ingress must be through authenticated TLS reverse proxy/tunnel.
- VNC is password protected.
- MCP and console require separate secrets when exposed beyond loopback.
- Browser profiles remain on the runtime host and never enter Git.
- Protected authentication steps occur directly inside Chromium, not as MCP arguments.

## Runtime pin

Initial reproducible runtime pins Playwright to `1.63.0` and base image `mcr.microsoft.com/playwright:v1.63.0-noble`.

## Protected invariants

INV-003, INV-008, INV-009, INV-014, INV-015.

## Re-plan trigger

Re-open if deployment moves to a runtime that provides equivalent persistent headed-browser and takeover semantics without weakening identity isolation or user-control guarantees.
