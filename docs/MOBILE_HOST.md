# Mobile Host — Android execution provider

## Goal

Use a user's own Android phone as the execution host instead of paying for or rate-limiting a cloud browser.

```text
ChatGPT
  -> Personal Mobile Operator MCP
  -> authenticated control token
  -> Cloudflare relay Worker
  -> Durable Object WebSocket
  -> Android AccessibilityService
  -> visible phone UI / Chrome / native apps
```

The phone initiates the WebSocket. No inbound port, public IP, VPN, or direct device exposure is required.

## Security model

- The relay has two independent secrets:
  - `DEVICE_TOKEN`: Android -> relay.
  - `CONTROL_TOKEN`: MCP/runtime -> relay.
- Set `DEVICE_ID` on the Worker to allow only one device when possible.
- Password nodes are redacted from observations.
- Filling a password node requires `approved=true`; otherwise the Android agent returns `SENSITIVE_INPUT_REQUIRES_APPROVAL`.
- Refs are ephemeral and bound to `stateVersion`. Every mutation invalidates them.
- Login, 2FA, CAPTCHA, passkeys, and security challenges should use `mobile_takeover`.
- Do not put device tokens, control tokens, cookies, passwords, or account credentials in Git.

## 1. Deploy relay

From `mobile/relay`:

```bash
npm install
npx wrangler secret put DEVICE_TOKEN
npx wrangler secret put CONTROL_TOKEN
npx wrangler secret put DEVICE_ID
npm run deploy
```

`DEVICE_ID` is optional, but recommended for a single-phone installation.

## 2. Build Android agent

Open `mobile/android-agent` in Android Studio, build/install it on the phone, then:

1. Open **PBO Mobile Agent**.
2. Enter the Worker URL.
3. Enter the same Device ID used by the MCP calls.
4. Enter `DEVICE_TOKEN`.
5. Save.
6. Open Accessibility Settings.
7. Enable **Personal Browser Operator Mobile Agent**.

The app does not need the Cloudflare control token.

## 3. Start Mobile MCP

Set:

```bash
PBO_MOBILE_RELAY_URL=https://<worker>.workers.dev
PBO_MOBILE_CONTROL_TOKEN=<CONTROL_TOKEN>
PBO_MOBILE_MCP_TOKEN=<MCP bearer token>
PBO_MOBILE_HOST=0.0.0.0
PBO_MOBILE_PORT=8790
PBO_ALLOWED_HOSTS=<your-mobile-mcp-host>
```

Then:

```bash
npm install
npm -w @pbo/operator-runtime run start:mobile:http
```

The remote MCP endpoint is:

```text
https://<your-runtime-host>/mcp
```

## Initial tool surface

- `mobile_task_start`
- `mobile_device_status`
- `mobile_observe`
- `mobile_open_url`
- `mobile_interact` — click/fill
- `mobile_global_action` — BACK/HOME/RECENTS
- `mobile_verify`
- `mobile_takeover`
- `mobile_resume`
- `mobile_task_complete`
- `mobile_audit_tail`

## Deliberate v0.1 limitations

This first slice does not attempt screenshots, arbitrary shell/ADB execution, notification reading, file extraction, microphone/camera access, silent app installation, or security-challenge bypass.

Those capabilities require separate permission models and threat-model review before they are added.
