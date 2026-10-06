import assert from 'node:assert/strict';
import test from 'node:test';
import { assertPublicHttpUrl, clearNetworkGuardCache } from '../../src/network-guard.js';

test('network guard blocks loopback and private literal addresses', async () => {
  process.env.PBO_ALLOW_PRIVATE_NETWORKS = 'false';
  clearNetworkGuardCache();

  await assert.rejects(() => assertPublicHttpUrl('http://127.0.0.1/'), /PRIVATE_NETWORK_NAVIGATION_DENIED/);
  await assert.rejects(() => assertPublicHttpUrl('http://10.0.0.1/'), /PRIVATE_NETWORK_NAVIGATION_DENIED/);
  await assert.rejects(() => assertPublicHttpUrl('http://192.168.1.1/'), /PRIVATE_NETWORK_NAVIGATION_DENIED/);
  await assert.rejects(() => assertPublicHttpUrl('http://[::1]/'), /PRIVATE_NETWORK_NAVIGATION_DENIED/);
});

test('network guard allows explicit private-network opt in', async () => {
  process.env.PBO_ALLOW_PRIVATE_NETWORKS = 'true';
  const url = await assertPublicHttpUrl('http://127.0.0.1:1234/test');
  assert.equal(url.hostname, '127.0.0.1');
  process.env.PBO_ALLOW_PRIVATE_NETWORKS = 'false';
});
