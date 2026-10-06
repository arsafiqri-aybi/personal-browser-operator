#!/usr/bin/env bash
set -euo pipefail

IMAGE="pbo-ci:${GITHUB_SHA:-local}"
NAME="pbo-ci-runtime"
VOLUME="pbo-ci-data-${GITHUB_RUN_ID:-local}-${RANDOM}"
PUBLIC_PORT="${PBO_CI_PUBLIC_PORT:-18080}"
MCP_TOKEN="ci-mcp-token-${RANDOM}-${RANDOM}"
CONSOLE_TOKEN="ci-console-token-${RANDOM}-${RANDOM}"
VNC_PASSWORD="ci-vnc-${RANDOM}"

cleanup() {
  docker rm -f "$NAME" >/dev/null 2>&1 || true
  docker volume rm "$VOLUME" >/dev/null 2>&1 || true
}
trap cleanup EXIT

docker build -t "$IMAGE" .
docker volume create "$VOLUME" >/dev/null

start_container() {
  docker rm -f "$NAME" >/dev/null 2>&1 || true
  docker run -d \
    --name "$NAME" \
    --shm-size=1g \
    -p "127.0.0.1:${PUBLIC_PORT}:8080" \
    -v "$VOLUME:/data" \
    -e PORT=8080 \
    -e PBO_MCP_TOKEN="$MCP_TOKEN" \
    -e PBO_CONSOLE_TOKEN="$CONSOLE_TOKEN" \
    -e PBO_VNC_PASSWORD="$VNC_PASSWORD" \
    -e PBO_AUTO_RISK=R2 \
    -e PBO_ALLOW_PRIVATE_NETWORKS=false \
    "$IMAGE" >/dev/null
}

wait_health() {
  for _ in $(seq 1 90); do
    if curl -fsS "http://127.0.0.1:${PUBLIC_PORT}/health" >/dev/null 2>&1; then
      return 0
    fi
    if ! docker inspect -f '{{.State.Running}}' "$NAME" 2>/dev/null | grep -q true; then
      docker logs "$NAME" || true
      return 1
    fi
    sleep 1
  done
  docker logs "$NAME" || true
  echo "container health timeout" >&2
  return 1
}

start_container
wait_health

test "$(curl -sS -o /dev/null -w '%{http_code}' -X POST "http://127.0.0.1:${PUBLIC_PORT}/mcp")" = "401"
test "$(curl -sS -o /dev/null -w '%{http_code}' "http://127.0.0.1:${PUBLIC_PORT}/console")" = "401"
curl -fsS "http://127.0.0.1:${PUBLIC_PORT}/novnc/vnc.html" >/dev/null

set +e
REMOTE_OUTPUT="$(
  PBO_REMOTE_URL="http://127.0.0.1:${PUBLIC_PORT}" \
  PBO_MCP_TOKEN="$MCP_TOKEN" \
  npm -w @pbo/operator-runtime run --silent test:remote-container 2>&1
)"
REMOTE_STATUS=$?
set -e
echo "$REMOTE_OUTPUT"
if [ "$REMOTE_STATUS" -ne 0 ]; then
  echo "remote MCP smoke failed with status $REMOTE_STATUS" >&2
  docker logs "$NAME" || true
  exit "$REMOTE_STATUS"
fi
TASK_ID="$(printf '%s\n' "$REMOTE_OUTPUT" | sed -n 's/^PBO_TASK_ID=//p' | tail -n 1)"
test -n "$TASK_ID"

PWUSER_UID="$(docker exec "$NAME" id -u pwuser)"
docker top "$NAME" -eo uid,pid,comm,args > /tmp/pbo-container-top.txt
cat /tmp/pbo-container-top.txt

awk -v uid="$PWUSER_UID" '
  NR > 1 && $1 == uid && $3 == "node" { found=1 }
  END { exit found ? 0 : 1 }
' /tmp/pbo-container-top.txt

awk -v uid="$PWUSER_UID" '
  NR > 1 && $1 == uid && ($3 ~ /chrome|chromium/ || $0 ~ /(chrome|chromium)/) { found=1 }
  END { exit found ? 0 : 1 }
' /tmp/pbo-container-top.txt

docker exec "$NAME" test -d /data/profiles/ci-container
docker rm -f "$NAME" >/dev/null

start_container
wait_health

PBO_REMOTE_URL="http://127.0.0.1:${PUBLIC_PORT}" \
PBO_MCP_TOKEN="$MCP_TOKEN" \
PBO_TEST_TASK_ID="$TASK_ID" \
npm -w @pbo/operator-runtime run --silent test:remote-container

docker exec "$NAME" test -d /data/profiles/ci-container

echo "PBO_CONTAINER_SMOKE=PASS"
