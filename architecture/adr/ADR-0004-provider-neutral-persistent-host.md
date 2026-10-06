# ADR-0004 — Provider-Neutral Persistent Host with Single HTTPS Ingress

Status: ACCEPTED
Date: 2026-10-06

## Decision

Deploy the Personal Browser Operator on a persistent container host with a durable `/data` mount and one stable HTTPS origin.

Inside the container, MCP, operator console, and noVNC remain loopback-only services. A local reverse proxy exposes only these explicit routes:

- `/mcp` → MCP runtime
- `/console` and `/api/*` → operator console
- `/novnc/*` → same-browser noVNC takeover
- `/health` → readiness

The provider is not part of the core architecture. Railway is the first preferred deployment target because it can build the repository Dockerfile, provide a stable HTTPS service domain, and attach a persistent volume. A VM plus Cloudflare Tunnel remains a compatible alternative.

## Account-specific deployment finding

Cloudflare Containers were evaluated first. The current Cloudflare account does not have Containers entitlement because that deployment path requires the Workers Paid plan. The account also currently has no Cloudflare zone for a stable named Tunnel hostname.

This is an infrastructure constraint, not a reason to weaken the Personal Browser Operator architecture.

## Why

The operator requires:
- long-lived Chromium processes;
- durable authenticated browser profiles;
- a persistent filesystem;
- stable HTTPS reachability from an MCP client;
- same-browser human takeover;
- provider-independent rollback/migration.

One externally exposed origin is simpler to secure and avoids separately publishing raw MCP, console, VNC, or websockify ports.

## Security boundary

- browser process, MCP, console, x11vnc, and websockify do not bind publicly;
- only the reverse proxy binds the public service port;
- MCP still requires its bearer/auth layer;
- console still requires its own token;
- VNC still requires its own password;
- `/data` is the only persistent runtime mount;
- secrets are injected by the host secret/variable system and never committed.

## Protected invariants

INV-003, INV-008, INV-009, INV-014, INV-015.

## Re-plan trigger

Re-open if the selected provider cannot supply a durable filesystem, stable HTTPS endpoint, sufficient memory/CPU for Chromium, or WebSocket support for noVNC.
