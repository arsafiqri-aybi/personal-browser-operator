import assert from 'node:assert/strict';

const issuerRaw = process.env.PBO_OAUTH_ISSUER;
assert.ok(issuerRaw, 'PBO_OAUTH_ISSUER is required');

const issuer = new URL(issuerRaw);
assert.equal(issuer.protocol, 'https:', 'OAuth issuer must use HTTPS');
const issuerNormalized = issuer.toString().replace(/\/$/, '');

const discoveryCandidates = process.env.PBO_OAUTH_DISCOVERY_URL
  ? [process.env.PBO_OAUTH_DISCOVERY_URL]
  : [
      issuerNormalized + '/.well-known/oauth-authorization-server',
      issuerNormalized + '/.well-known/openid-configuration'
    ];

async function fetchJson(url) {
  const response = await fetch(url, { redirect: 'error' });
  if (!response.ok) throw new Error('HTTP ' + response.status + ' for ' + url);
  return { url, json: await response.json() };
}

let discovered = null;
const discoveryErrors = [];
for (const candidate of discoveryCandidates) {
  try {
    discovered = await fetchJson(candidate);
    break;
  } catch (error) {
    discoveryErrors.push(String(error));
  }
}
assert.ok(discovered, 'OAuth discovery failed: ' + discoveryErrors.join(' | '));

const metadata = discovered.json;
assert.equal(String(metadata.issuer || '').replace(/\/$/, ''), issuerNormalized, 'discovery issuer mismatch');

function httpsEndpoint(name) {
  const value = metadata[name];
  assert.ok(typeof value === 'string' && value.length > 0, name + ' is required');
  const parsed = new URL(value);
  assert.equal(parsed.protocol, 'https:', name + ' must use HTTPS');
  return parsed.toString();
}

const authorizationEndpoint = httpsEndpoint('authorization_endpoint');
const tokenEndpoint = httpsEndpoint('token_endpoint');

const responseTypes = Array.isArray(metadata.response_types_supported) ? metadata.response_types_supported : [];
assert.ok(responseTypes.includes('code'), 'authorization code response type is required');

const grants = Array.isArray(metadata.grant_types_supported) ? metadata.grant_types_supported : [];
assert.ok(grants.includes('authorization_code'), 'authorization_code grant is required');
assert.ok(grants.includes('refresh_token'), 'refresh_token grant is required for durable ChatGPT connection');

const pkce = Array.isArray(metadata.code_challenge_methods_supported) ? metadata.code_challenge_methods_supported : [];
assert.ok(pkce.includes('S256'), 'PKCE S256 is required');

const scopes = Array.isArray(metadata.scopes_supported) ? metadata.scopes_supported : [];
assert.ok(scopes.includes('offline_access'), 'offline_access must be advertised for refresh-token durability');

const jwksRaw = process.env.PBO_OAUTH_JWKS_URI || metadata.jwks_uri;
assert.ok(jwksRaw, 'JWKS URI is required via PBO_OAUTH_JWKS_URI or discovery metadata');
const jwksUrl = new URL(jwksRaw);
assert.equal(jwksUrl.protocol, 'https:', 'JWKS URI must use HTTPS');
const jwksResponse = await fetch(jwksUrl, { redirect: 'error' });
assert.equal(jwksResponse.status, 200, 'JWKS endpoint must return HTTP 200');
const jwks = await jwksResponse.json();
assert.ok(Array.isArray(jwks.keys) && jwks.keys.length > 0, 'JWKS must contain at least one key');

const requiredScope = process.env.PBO_OAUTH_SCOPE || 'pbo:mcp';
const registrationEndpoint = typeof metadata.registration_endpoint === 'string' ? metadata.registration_endpoint : null;
if (registrationEndpoint) {
  const parsed = new URL(registrationEndpoint);
  assert.equal(parsed.protocol, 'https:', 'registration_endpoint must use HTTPS');
}

const customScopeAdvertised = scopes.includes(requiredScope);
const scopeProof = customScopeAdvertised
  ? 'DISCOVERY_ADVERTISED'
  : 'REQUIRES_AUTHORIZED_TOKEN_PILOT';

console.log(JSON.stringify({
  ok: true,
  issuer: issuerNormalized,
  discoveryUrl: discovered.url,
  authorizationEndpoint,
  tokenEndpoint,
  jwksUri: jwksUrl.toString(),
  capabilities: {
    authorizationCode: true,
    refreshToken: true,
    pkceS256: true,
    offlineAccess: true,
    dynamicRegistrationEndpoint: registrationEndpoint,
    requiredScope,
    requiredScopeProof: scopeProof
  },
  nextProof: customScopeAdvertised
    ? 'Issue a user token for the exact PBO resource and verify aud/scope end-to-end.'
    : 'Provider discovery does not prove the custom PBO scope; issue a real authorized token before selecting this provider.'
}, null, 2));
