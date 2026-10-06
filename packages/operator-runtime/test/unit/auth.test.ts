import assert from 'node:assert/strict';
import http from 'node:http';
import test from 'node:test';
import {
  SignJWT,
  exportJWK,
  generateKeyPair
} from 'jose';
import {
  OAuthAccessError,
  OAuthJwtVerifier,
  bearerChallenge,
  constantTimeEqualSecret,
  oauthConfigFromEnv,
  protectedResourceMetadata,
  resourceMetadataUrl,
  type OAuthJwtConfig
} from '../../src/auth.js';

test('static bearer comparison is constant-time compatible and exact', () => {
  assert.equal(constantTimeEqualSecret('secret-a', 'secret-a'), true);
  assert.equal(constantTimeEqualSecret('secret-a', 'secret-b'), false);
  assert.equal(constantTimeEqualSecret('', 'secret-a'), false);
});

test('oauth env config creates RFC 9728 resource metadata without secrets', () => {
  const config = oauthConfigFromEnv({
    PBO_PUBLIC_BASE_URL: 'https://browser.example.test',
    PBO_OAUTH_ISSUER: 'https://identity.example.test',
    PBO_OAUTH_JWKS_URI: 'https://identity.example.test/.well-known/jwks.json',
    PBO_OAUTH_SCOPE: 'pbo:mcp'
  });

  assert.equal(config.resourceUrl.toString(), 'https://browser.example.test/mcp');
  assert.equal(
    resourceMetadataUrl(config).toString(),
    'https://browser.example.test/.well-known/oauth-protected-resource/mcp'
  );

  const metadata = protectedResourceMetadata(config);
  assert.deepEqual(metadata.authorization_servers, ['https://identity.example.test']);
  assert.deepEqual(metadata.scopes_supported, ['pbo:mcp']);
  assert.equal(metadata.resource, 'https://browser.example.test/mcp');

  const challenge = bearerChallenge(config);
  assert.match(challenge, /resource_metadata=/);
  assert.match(challenge, /scope="pbo:mcp"/);
  assert.ok(!challenge.includes('secret'));
});

test('oauth config rejects insecure production URLs', () => {
  assert.throws(
    () => oauthConfigFromEnv({
      PBO_PUBLIC_BASE_URL: 'http://browser.example.test',
      PBO_OAUTH_ISSUER: 'https://identity.example.test',
      PBO_OAUTH_JWKS_URI: 'https://identity.example.test/jwks'
    }),
    /must use HTTPS/
  );
});

test('oauth verifier enforces JWT signature issuer audience expiration and scope', async () => {
  const { publicKey, privateKey } = await generateKeyPair('RS256');
  const jwk = await exportJWK(publicKey);
  jwk.kid = 'pbo-test-key';
  jwk.alg = 'RS256';
  jwk.use = 'sig';

  const jwksServer = http.createServer((_req, res) => {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ keys: [jwk] }));
  });

  await new Promise<void>(resolve => jwksServer.listen(0, '127.0.0.1', resolve));
  const address = jwksServer.address();
  assert.ok(address && typeof address === 'object');

  const config: OAuthJwtConfig = {
    publicBaseUrl: new URL('https://browser.example.test/'),
    resourceUrl: new URL('https://browser.example.test/mcp'),
    issuer: 'https://identity.example.test',
    audience: 'https://browser.example.test/mcp',
    jwksUri: new URL(`http://127.0.0.1:${address.port}/jwks`),
    requiredScope: 'pbo:mcp'
  };

  const verifier = new OAuthJwtVerifier(config);

  const sign = (scope: string) =>
    new SignJWT({ scope, azp: 'chatgpt-test-client' })
      .setProtectedHeader({ alg: 'RS256', kid: 'pbo-test-key' })
      .setIssuer(config.issuer)
      .setAudience(config.audience)
      .setSubject('user-test')
      .setIssuedAt()
      .setExpirationTime('5m')
      .sign(privateKey);

  try {
    const good = await verifier.verify(await sign('openid pbo:mcp'));
    assert.equal(good.subject, 'user-test');
    assert.equal(good.clientId, 'chatgpt-test-client');
    assert.ok(good.scopes.includes('pbo:mcp'));
    assert.ok(good.expiresAt > Math.floor(Date.now() / 1000));

    await assert.rejects(
      () => verifier.verify(sign('openid').then(x => x)),
      (error: unknown) =>
        error instanceof OAuthAccessError &&
        error.code === 'insufficient_scope' &&
        error.status === 403
    );

    const wrongAudience = await new SignJWT({ scope: 'pbo:mcp' })
      .setProtectedHeader({ alg: 'RS256', kid: 'pbo-test-key' })
      .setIssuer(config.issuer)
      .setAudience('https://wrong.example.test/mcp')
      .setSubject('user-test')
      .setIssuedAt()
      .setExpirationTime('5m')
      .sign(privateKey);

    await assert.rejects(
      () => verifier.verify(wrongAudience),
      (error: unknown) =>
        error instanceof OAuthAccessError &&
        error.code === 'invalid_token' &&
        error.status === 401
    );
  } finally {
    await new Promise<void>(resolve => jwksServer.close(() => resolve()));
  }
});
