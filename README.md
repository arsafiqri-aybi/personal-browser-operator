# Personal Browser Operator

Private custom MCP + Playwright operator for giving ChatGPT a persistent, authenticated, verifiable browser.

## North Star

Give ChatGPT a goal, not a click sequence.

```text
ChatGPT
  -> Personal Browser Operator MCP
  -> durable task + policy + verification
  -> Playwright
  -> real persistent Chromium
  -> website
  -> observe -> verify -> recover/replan
```

## Proven status

**REAL_BROWSER_VERIFIED** for the current vertical slice.

GitHub Actions has successfully executed the real browser path:

```text
launch persistent Chromium
-> navigate
-> observe semantic page state
-> interact with a real page element
-> reject stale refs
-> re-observe
-> verify postcondition
-> PASS
```

Evidence: `evaluation/evidence/RUN-0001-real-browser-ci.md`.

This does **not** yet mean deployed, real-account verified, or production-ready.

## Development transports

Local stdio:

```bash
npm install
npx playwright install chromium
npm start
```

Remote Streamable HTTP:

```bash
PBO_HOST=0.0.0.0 \
PBO_PORT=8787 \
PBO_MCP_TOKEN='long-random-secret' \
PBO_ALLOWED_HOSTS='browser.example.com' \
npm -w @pbo/operator-runtime run start:http
```

Put TLS/reverse-proxy protection in front of the remote endpoint.

## Reproducible headed runtime

The repository includes a pinned Playwright container, virtual display, noVNC same-browser takeover path, operator console, persistent `/data` volume, and loopback-only default port publishing.

See:
- `docs/RUNTIME_HOST.md`
- `docs/LIVE_TAKEOVER.md`
- `docs/CONTAINER_RUNBOOK.md`

## Security defaults

- webpage content is untrusted data with no instruction authority;
- private/loopback/link-local browser network destinations are blocked unless explicitly enabled;
- persistent browser profiles and auth material are gitignored;
- remote binding requires an MCP bearer token;
- stale browser refs fail closed;
- stable action IDs suppress duplicate side effects;
- task completion requires persisted PASS verification;
- retry logic never marks blind side-effect retry safe.

See `architecture/` and `evaluation/SECURITY_TEST_PLAN.md`.

## Android Mobile Host

The repository now includes an optional phone-hosted execution path:

```text
ChatGPT -> Mobile MCP -> authenticated relay -> outbound WebSocket -> Android AccessibilityService
```

This path avoids cloud-browser runtime quotas because UI execution happens on the user's own Android device. It preserves task binding, risk policy, stable action IDs, verification, audit, stale-ref rejection, and human takeover. Password fields are redacted from observations and require explicit approval before fill.

See `docs/MOBILE_HOST.md`.
