# Live Takeover Console

## Purpose

Human takeover must operate the exact same Chromium session/profile the AI is using.

The runtime therefore launches headed Chromium on an X11 virtual display. That display is exposed through x11vnc -> websockify -> noVNC.

```text
AI / Playwright
      |
      v
same Chromium window
      |
      v
Xvfb display :99
      |
      +--> noVNC live viewport --> user
```

No browser copy, screenshot replay, or second login session is created.

## Runtime endpoints

Default host-only bindings from Docker Compose:

- MCP: `127.0.0.1:8787/mcp`
- operator console: `127.0.0.1:8790/console`
- noVNC: `127.0.0.1:6080/vnc.html`

They are intentionally not published on all interfaces by Compose.

For remote access, put an authenticated HTTPS reverse proxy / Cloudflare Tunnel / equivalent in front. Do not publish 6080 directly to the public Internet.

## Required secrets

- `PBO_MCP_TOKEN`
- `PBO_CONSOLE_TOKEN`
- `PBO_VNC_PASSWORD`

Store these in the deployment secret manager or local `.env` excluded from Git.

## Flow

1. AI detects auth/CAPTCHA/passkey/security challenge.
2. MCP `browser_takeover` moves task to `WAITING_FOR_USER`.
3. User opens the operator console and noVNC.
4. User completes the protected step directly in Chromium.
5. User returns control.
6. MCP `browser_resume` changes task to `ACTIVE`.
7. AI MUST call `browser_observe` before any ref-bound interaction.
8. AI verifies the resulting authenticated/state transition.

The user never needs to send a password, OTP, passkey or session cookie through MCP tool arguments.
