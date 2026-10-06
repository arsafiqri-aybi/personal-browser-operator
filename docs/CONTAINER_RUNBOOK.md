# Container Runbook

## Build

```bash
docker compose build
```

The container pins the browser base image to:

```text
mcr.microsoft.com/playwright:v1.63.0-noble
```

matching the project's Playwright package major/minor.

## Secrets

Create a local `.env` that is not committed:

```bash
PBO_MCP_TOKEN=<long-random-token>
PBO_CONSOLE_TOKEN=<different-long-random-token>
PBO_VNC_PASSWORD=<strong-vnc-password>
PBO_ALLOWED_HOSTS=browser.example.com
PBO_NOVNC_PUBLIC_URL=https://browser.example.com/novnc/vnc.html?autoconnect=true&resize=scale
```

## Start

```bash
docker compose up -d
docker compose ps
```

## Local checks

```bash
curl http://127.0.0.1:8787/health
curl -H "Authorization: Bearer $PBO_CONSOLE_TOKEN" http://127.0.0.1:8790/api/tasks
```

Then open:

```text
http://127.0.0.1:8790/console?token=<PBO_CONSOLE_TOKEN>
```

and authenticate noVNC using `PBO_VNC_PASSWORD`.

## Security boundary

The Compose ports are bound to host loopback only. A remote tunnel/reverse proxy should be the only public ingress and must provide TLS plus access control.

Persistent browser/account state lives only in the `pbo-data` volume.
