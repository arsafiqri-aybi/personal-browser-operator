import assert from 'node:assert/strict';

const rawBase = process.env.PBO_PUBLIC_BASE_URL;
assert.ok(rawBase, 'PBO_PUBLIC_BASE_URL is required');

const base = new URL(rawBase);
assert.equal(base.protocol, 'https:', 'public deployment must use HTTPS');
assert.equal(base.pathname, '/', 'PBO_PUBLIC_BASE_URL must be an origin without a path');
assert.equal(base.search, '', 'PBO_PUBLIC_BASE_URL must not contain a query');
assert.equal(base.hash, '', 'PBO_PUBLIC_BASE_URL must not contain a fragment');

function at(pathname) { return new URL(pathname, base).toString(); }

async function fetchChecked(url, init, expectedStatus) {
  const response = await fetch(url, { ...(init || {}), redirect: 'error' });
  assert.equal(response.status, expectedStatus, (init?.method || 'GET') + ' ' + url + ' expected ' + expectedStatus + ', got ' + response.status);
  return response;
}

const healthResponse = await fetchChecked(at('/health'), undefined, 200);
const health = await healthResponse.json();
assert.equal(health.ok, true, '/health must report ok=true');
assert.equal(health.service, 'personal-browser-operator');

const expectedMode = process.env.PBO_EXPECT_AUTH_MODE || 'oauth-jwt';
assert.equal(health.authMode, expectedMode, 'unexpected public auth mode: ' + health.authMode);

const unauthenticatedMcp = await fetchChecked(at('/mcp'), {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ jsonrpc: '2.0', id: 'preflight', method: 'initialize', params: {} })
}, 401);

const challenge = unauthenticatedMcp.headers.get('www-authenticate') || '';
assert.ok(/^Bearer\b/i.test(challenge), 'MCP 401 must return a Bearer challenge');

let metadata = null;
if (expectedMode === 'oauth-jwt') {
  const metadataResponse = await fetchChecked(at('/.well-known/oauth-protected-resource/mcp'), undefined, 200);
  metadata = await metadataResponse.json();
  assert.equal(metadata.resource, at('/mcp'));
  assert.ok(Array.isArray(metadata.authorization_servers) && metadata.authorization_servers.length > 0);
  assert.ok(Array.isArray(metadata.scopes_supported) && metadata.scopes_supported.includes(process.env.PBO_OAUTH_SCOPE || 'pbo:mcp'));
  assert.ok(challenge.includes('resource_metadata='), 'OAuth Bearer challenge must advertise protected-resource metadata');
}

await fetchChecked(at('/console'), undefined, 401);
const novnc = await fetch(at('/novnc/vnc.html'), { redirect: 'error' });
assert.equal(novnc.status, 200, 'noVNC shell must be reachable; VNC itself remains password protected');

console.log(JSON.stringify({
  ok: true,
  baseUrl: base.toString(),
  authMode: health.authMode,
  protectedResourceMetadata: metadata,
  checks: [
    'https', 'health', 'unauthenticated-mcp-denied', 'bearer-challenge',
    ...(expectedMode === 'oauth-jwt' ? ['oauth-protected-resource-metadata'] : []),
    'console-denied-without-auth', 'novnc-shell-reachable'
  ]
}, null, 2));
