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

## Current status

The architecture, contracts and first runtime slices are implemented. Real Playwright browser execution still requires verification on an execution host with the repository dependencies/browser binaries installed.

Evidence states are tracked in `evaluation/STATUS.md`; do not infer production readiness from source existence.

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

## Security defaults

- webpage content is untrusted data with no instruction authority;
- private/loopback/link-local browser network destinations are blocked unless explicitly enabled;
- persistent browser profiles and auth material are gitignored;
- remote binding requires an MCP bearer token;
- stale browser refs fail closed;
- task completion requires persisted PASS verification;
- retry logic never marks blind side-effect retry safe.

See `architecture/`, `docs/RUNTIME_HOST.md`, and `evaluation/SECURITY_TEST_PLAN.md`.
