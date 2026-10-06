# Deployment v1

## Selected shape

The core runtime is provider-neutral:

```text
stable HTTPS origin
        |
        v
single reverse proxy port
   |       |       |
 /mcp   /console  /novnc
   |       |       |
 MCP     state     same Chromium display
         /audit
        |
 persistent /data
```

Only the gateway binds the host/platform public port. MCP, console, VNC, and websockify remain internal loopback services.

## Initial hosted target

Railway is the preferred first hosted target once the Railway connection is available.

Why it fits:
- deploys the repository Dockerfile;
- provides a stable HTTPS `*.railway.app` domain;
- supports persistent volumes across restarts/deploys;
- supports target/public ports and WebSocket-capable HTTP services;
- keeps secrets in service variables rather than Git.

Required service configuration:
- source: this GitHub repository
- Dockerfile: repository root `Dockerfile`
- persistent volume mount: `/data`
- public target port: injected `PORT`
- healthcheck: `/health`
- variables/secrets:
  - `PBO_MCP_TOKEN`
  - `PBO_CONSOLE_TOKEN`
  - `PBO_VNC_PASSWORD`
  - `PBO_AUTO_RISK=R2`
  - `PBO_ALLOW_PRIVATE_NETWORKS=false`

## Cloudflare evaluation

Cloudflare Containers were evaluated first because the current platform supports custom images and recently added filesystem snapshot/restore for durable-object scheduled Containers.

The current Cloudflare account does not have Containers entitlement without upgrading to Workers Paid. It also currently has no zone for a stable named Tunnel hostname.

Therefore Cloudflare is not used as the v1 execution host. A future VM/local host can still place Cloudflare Tunnel in front without changing the browser runtime.

## Non-negotiable deployment checks

A hosted deployment does not become `DEPLOYED` merely because the provider reports a successful build. It must pass:
- `/health` over the public HTTPS origin;
- authenticated MCP initialize/list-tools/call-tool roundtrip;
- persistent `/data` survives restart/redeploy;
- real Chromium opens through the deployed runtime;
- noVNC displays the same Chromium controlled by Playwright;
- takeover/resume produces a fresh observation;
- raw internal ports are not publicly reachable.
