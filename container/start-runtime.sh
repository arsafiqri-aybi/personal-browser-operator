#!/usr/bin/env bash
set -euo pipefail

: "${PBO_DATA_DIR:=/data}"
: "${PBO_HOST:=127.0.0.1}"
: "${PBO_PORT:=8787}"
: "${PBO_CONSOLE_HOST:=127.0.0.1}"
: "${PBO_CONSOLE_PORT:=8790}"
: "${PBO_HEADLESS:=false}"
: "${PBO_AUTH_MODE:=static-bearer}"
PBO_PUBLIC_PORT="${PORT:-${PBO_PUBLIC_PORT:-8080}}"
: "${DISPLAY:=:99}"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Container bootstrap must start as root so persistent volume ownership can be prepared." >&2
  exit 1
fi

case "$PBO_AUTH_MODE" in
  static-bearer)
    if [[ -z "${PBO_MCP_TOKEN:-}" ]]; then
      echo "PBO_MCP_TOKEN is required in static-bearer mode" >&2
      exit 1
    fi
    ;;
  oauth-jwt)
    for name in PBO_PUBLIC_BASE_URL PBO_OAUTH_ISSUER PBO_OAUTH_JWKS_URI; do
      if [[ -z "${!name:-}" ]]; then
        echo "$name is required in oauth-jwt mode" >&2
        exit 1
      fi
    done
    ;;
  loopback-none)
    echo "loopback-none is not permitted in the public container runtime" >&2
    exit 1
    ;;
  *)
    echo "Unsupported PBO_AUTH_MODE: $PBO_AUTH_MODE" >&2
    exit 1
    ;;
esac

if [[ -z "${PBO_CONSOLE_TOKEN:-}" ]]; then
  echo "PBO_CONSOLE_TOKEN is required in container runtime" >&2
  exit 1
fi
if [[ -z "${PBO_VNC_PASSWORD:-}" ]]; then
  echo "PBO_VNC_PASSWORD is required in container runtime" >&2
  exit 1
fi

mkdir -p \
  "$PBO_DATA_DIR" \
  "$PBO_DATA_DIR/vnc" \
  /tmp/nginx-client-body \
  /tmp/nginx-proxy \
  /tmp/nginx-fastcgi \
  /tmp/nginx-uwsgi \
  /tmp/nginx-scgi
chown pwuser:pwuser \
  "$PBO_DATA_DIR" \
  "$PBO_DATA_DIR/vnc" \
  /tmp/nginx-client-body \
  /tmp/nginx-proxy \
  /tmp/nginx-fastcgi \
  /tmp/nginx-uwsgi \
  /tmp/nginx-scgi
chmod 700 "$PBO_DATA_DIR" "$PBO_DATA_DIR/vnc"

export DISPLAY PBO_DATA_DIR PBO_HOST PBO_PORT PBO_CONSOLE_HOST PBO_CONSOLE_PORT PBO_HEADLESS PBO_PUBLIC_PORT PBO_AUTH_MODE
export PBO_NOVNC_PUBLIC_URL="${PBO_NOVNC_PUBLIC_URL:-/novnc/vnc.html?autoconnect=true&resize=scale}"
export HOME=/home/pwuser

gosu pwuser x11vnc -storepasswd "$PBO_VNC_PASSWORD" "$PBO_DATA_DIR/vnc/passwd" >/dev/null
chmod 600 "$PBO_DATA_DIR/vnc/passwd"

gosu pwuser Xvfb "$DISPLAY" -screen 0 1440x960x24 -ac +extension RANDR >/tmp/xvfb.log 2>&1 &
XVFB_PID=$!

gosu pwuser fluxbox -display "$DISPLAY" >/tmp/fluxbox.log 2>&1 &
FLUXBOX_PID=$!

gosu pwuser x11vnc \
  -display "$DISPLAY" \
  -rfbauth "$PBO_DATA_DIR/vnc/passwd" \
  -rfbport 5900 \
  -localhost \
  -forever \
  -shared \
  -noxdamage \
  >/tmp/x11vnc.log 2>&1 &
VNC_PID=$!

gosu pwuser websockify \
  --web=/usr/share/novnc \
  127.0.0.1:6080 \
  127.0.0.1:5900 \
  >/tmp/novnc.log 2>&1 &
NOVNC_PID=$!

gosu pwuser node /app/packages/operator-runtime/dist/http.js &
MCP_PID=$!

gosu pwuser node /app/packages/operator-runtime/dist/console.js &
CONSOLE_PID=$!

envsubst '${PBO_PUBLIC_PORT}' \
  < /app/container/nginx.conf.template \
  > /tmp/nginx.conf
chown pwuser:pwuser /tmp/nginx.conf

gosu pwuser nginx -c /tmp/nginx.conf -g 'daemon off;' &
NGINX_PID=$!

cleanup() {
  kill "$NGINX_PID" "$CONSOLE_PID" "$MCP_PID" "$NOVNC_PID" "$VNC_PID" "$FLUXBOX_PID" "$XVFB_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

wait -n "$NGINX_PID" "$MCP_PID" "$CONSOLE_PID" "$NOVNC_PID" "$VNC_PID" "$FLUXBOX_PID" "$XVFB_PID"
echo "A runtime process exited; shutting down container." >&2
exit 1
