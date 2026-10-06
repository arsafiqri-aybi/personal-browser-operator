# Railway Deployment — Personal Browser Operator

This is a provider-specific runbook for the provider-neutral PBO container architecture.

## Current Railway contract

Railway's legacy Config as Code files (`railway.json` and `railway.toml`) are deprecated for new services. Do **not** introduce either file into this repository.

Use the current Railway CLI / Infrastructure as Code workflow. When a live Railway project exists, `railway config init` can create the current `.railway/railway.ts` representation from Railway's supported schema. Do not hand-author a guessed IaC schema.

The PBO service requires:

- repository-root `Dockerfile`;
- one public HTTP service whose port comes from Railway's injected `PORT`;
- healthcheck path `/health`;
- one persistent volume mounted at `/data`;
- one generated HTTPS domain;
- production auth mode `oauth-jwt`;
- externally managed OAuth/OIDC authorization server;
- separate console and VNC secrets;
- no public exposure of the internal MCP, console, x11vnc, or websockify ports.

## Provisioning sequence

After Railway is authenticated and this repository is available to it:

```bash
railway init
railway add --repo arsafiqri-aybi/personal-browser-operator
railway volume add --mount-path /data
railway domain
railway config init
railway config pull
railway config plan
```

Do not run `railway config apply` until the plan has been reviewed.

Railway Volumes are mounted as root. Set `RAILWAY_RUN_UID=0`. This does **not** make the browser workload permanently root: PBO starts only its volume bootstrap as root, fixes `/data` ownership, then launches Node, Chromium, Xvfb, Fluxbox, x11vnc, websockify, and nginx as `pwuser`. CI verifies that behavior.

## Variables

Start from `deploy/railway.env.example`. Production must use:

```text
PBO_AUTH_MODE=oauth-jwt
PBO_PUBLIC_BASE_URL=https://<generated-or-custom-domain>
PBO_OAUTH_ISSUER=https://<issuer>
PBO_OAUTH_JWKS_URI=https://<issuer-jwks>
PBO_OAUTH_AUDIENCE=https://<generated-or-custom-domain>/mcp
PBO_OAUTH_SCOPE=pbo:mcp
PBO_CONSOLE_TOKEN=<secret>
PBO_VNC_PASSWORD=<secret>
PBO_AUTO_RISK=R2
PBO_ALLOW_PRIVATE_NETWORKS=false
RAILWAY_RUN_UID=0
```

Do not commit real values. Put them in Railway Variables / the external identity provider.

`PBO_MCP_TOKEN` remains only for the already-tested `static-bearer` CI/bootstrap mode. It is not the target ChatGPT production path.

## Railway healthcheck

Configure the service healthcheck path as `/health`. PBO already listens through the single nginx gateway on Railway's injected `PORT`.

Railway healthchecks may use the Host `healthcheck.railway.app`. PBO's public nginx gateway forwards health internally to the loopback MCP health endpoint rather than exposing the raw MCP listener.

A service with a persistent Railway Volume can experience a short restart/deploy interruption because the volume cannot be mounted by two active replicas at once. Do not claim zero-downtime browser-session failover for this single-volume v1 design.

## OAuth / ChatGPT requirements

PBO is an OAuth **resource server**, not the authorization server.

The external OAuth/OIDC provider must supply a standards-based authorization flow and access tokens accepted by PBO's JWT verification contract. For a durable ChatGPT connection, the provider should issue refresh tokens. For OpenID Connect, current ChatGPT guidance is to request and advertise `offline_access` (or the provider-equivalent refresh capability) through discovery metadata.

Required PBO checks:

- issuer exactly matches `PBO_OAUTH_ISSUER`;
- JWT signature verifies through `PBO_OAUTH_JWKS_URI`;
- audience matches `PBO_OAUTH_AUDIENCE`;
- token contains `exp` and `sub`;
- token includes `PBO_OAUTH_SCOPE` (default `pbo:mcp`).

Website passwords, OTPs, passkeys, CAPTCHA responses, cookies, and website session secrets must **not** be sent as MCP tool arguments. Those remain in the same Chromium session and use human takeover when necessary.

## Public verification

After deployment and OAuth variables are configured:

```bash
PBO_PUBLIC_BASE_URL=https://<domain> npm run verify:public-host
```

This checks HTTPS, health, auth mode, unauthenticated MCP denial, Bearer challenge, OAuth protected-resource metadata, console denial without auth, and the noVNC shell route.

A later authenticated deployment test must additionally prove:

1. MCP initialize/list-tools/call-tool through the public domain;
2. real Chromium navigation;
3. postcondition verification and effect reconciliation;
4. same-browser noVNC takeover;
5. persistent task/profile state across a Railway restart;
6. ChatGPT tool scan and invocation.

## Release truth

Passing local/CI container tests is not `DEPLOYED`.

Passing `verify:public-host` is not `REAL_ACCOUNT_VERIFIED`.

The release truth may advance only with evidence for each gate.
