# ADR-0006 — Root Bootstrap, Non-Root Browser Workload

Status: ACCEPTED
Date: 2026-10-06

## Decision

The deployment container may start its supervisor/bootstrap shell as root only to prepare host-mounted runtime storage and temporary directories.

After bootstrap, all long-running application processes execute as `pwuser`:

- Xvfb
- Fluxbox
- x11vnc
- websockify/noVNC
- MCP Node runtime
- operator console
- nginx gateway
- Chromium launched by Playwright

The persistent `/data` mount is ownership-adjusted at startup so authenticated browser profiles remain writable by `pwuser`.

## Why

Some container platforms mount persistent volumes as root even when the image normally uses a non-root user. Running the entire browser workload as root would weaken Chromium isolation. Refusing root-mounted volumes would break durable browser profiles.

A narrow privileged bootstrap followed by non-root exec preserves both persistence and the non-root browser security boundary.

## Constraints

- bootstrap must not handle user web content;
- secrets remain environment-only;
- Chromium must never intentionally launch as root;
- public services remain behind the single gateway;
- startup fails if privilege drop cannot be performed.

## Re-plan trigger

Re-open if the host supports explicit volume ownership/UID mapping that removes the need for privileged bootstrap.
