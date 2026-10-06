import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

function read(file) {
  assert.ok(fs.existsSync(file), 'missing deployment artifact: ' + file);
  return fs.readFileSync(file, 'utf8');
}

function requires(text, needle, label) {
  assert.ok(text.includes(needle), label + ' missing required contract: ' + needle);
}

for (const deprecated of ['railway.json', 'railway.toml']) {
  assert.ok(!fs.existsSync(deprecated), deprecated + ' is deprecated for new Railway services; use current Infrastructure as Code or CLI provisioning');
}

const docker = read('Dockerfile');
const start = read('container/start-runtime.sh');
const nginx = read('container/nginx.conf.template');
const envExample = read('deploy/railway.env.example');
const railwayDoc = read('docs/RAILWAY_DEPLOYMENT.md');

requires(docker, 'FROM mcr.microsoft.com/playwright:v1.63.0-noble', 'Dockerfile');
requires(docker, 'ENV PBO_DATA_DIR=/data', 'Dockerfile');
requires(docker, 'EXPOSE 8080', 'Dockerfile');
requires(docker, 'USER root', 'Dockerfile');

requires(start, 'PBO_PUBLIC_PORT="${PORT:-${PBO_PUBLIC_PORT:-8080}}"', 'runtime');
requires(start, 'gosu pwuser xdpyinfo -display "$DISPLAY"', 'runtime');
requires(start, 'gosu pwuser node /app/packages/operator-runtime/dist/http.js', 'runtime');
requires(start, 'gosu pwuser node /app/packages/operator-runtime/dist/console.js', 'runtime');
requires(start, 'PBO_AUTH_MODE', 'runtime');

for (const route of [
  'location = /health',
  'location = /.well-known/oauth-protected-resource/mcp',
  'location /mcp',
  'location /console',
  'location /novnc/'
]) {
  requires(nginx, route, 'nginx gateway');
}

for (const variable of [
  'PBO_AUTH_MODE=oauth-jwt',
  'PBO_PUBLIC_BASE_URL=',
  'PBO_OAUTH_ISSUER=',
  'PBO_OAUTH_JWKS_URI=',
  'PBO_OAUTH_AUDIENCE=',
  'PBO_OAUTH_SCOPE=pbo:mcp',
  'PBO_CONSOLE_TOKEN=',
  'PBO_VNC_PASSWORD=',
  'PBO_ALLOW_PRIVATE_NETWORKS=false',
  'RAILWAY_RUN_UID=0'
]) {
  requires(envExample, variable, 'Railway environment template');
}

requires(railwayDoc, 'railway volume add --mount-path /data', 'Railway runbook');
requires(railwayDoc, 'railway domain', 'Railway runbook');
requires(railwayDoc, '/health', 'Railway runbook');
requires(railwayDoc, 'railway config init', 'Railway runbook');
requires(railwayDoc, 'railway.json', 'Railway deprecation warning');
requires(railwayDoc, 'offline_access', 'ChatGPT OAuth contract');

for (const artifact of [
  'scripts/verify-oauth-provider.mjs',
  'scripts/preflight-release.mjs',
  'docs/OAUTH_PROVIDER_GATE.md',
  'docs/RELEASE_GATES.md',
  'deploy/oauth.auth0.env.example',
  'deploy/oauth.workos.env.example'
]) {
  assert.ok(fs.existsSync(artifact), 'missing OAuth/release artifact: ' + artifact);
}
for (const script of [
  'scripts/verify-public-host.mjs',
  'scripts/verify-oauth-provider.mjs',
  'scripts/preflight-release.mjs',
  'scripts/render-chatgpt-plugin.mjs'
]) {
  const checked = spawnSync(process.execPath, ['--check', script], { encoding: 'utf8' });
  assert.equal(checked.status, 0, 'syntax-check failed for ' + script + ': ' + (checked.stderr || checked.stdout));
}
console.log(JSON.stringify({
  ok: true,
  provider: 'railway-ready-provider-neutral-runtime',
  persistentMount: '/data',
  publicPort: 'PORT -> 8080 gateway',
  productionAuth: 'oauth-jwt',
  deprecatedConfigAbsent: true
}, null, 2));
