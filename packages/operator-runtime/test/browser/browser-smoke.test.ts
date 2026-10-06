import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { BrowserManager } from '../../src/browser.js';
import { verify } from '../../src/verifier.js';

test('real Playwright browser can observe, interact, re-observe and verify', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pbo-browser-'));
  process.env.PBO_DATA_DIR = root;
  process.env.PBO_ALLOW_PRIVATE_NETWORKS = 'true';
  process.env.PBO_HEADLESS = 'true';

  const site = http.createServer((_req, res) => {
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end(`<!doctype html>
      <html>
        <head><title>PBO Fixture</title></head>
        <body>
          <div style="display:none">Done</div>
          <button id="go" onclick="document.getElementById('result').textContent='Done'">Run action</button>
          <div id="result">Pending</div>
        </body>
      </html>`);
  });

  await new Promise<void>(resolve => site.listen(0, '127.0.0.1', resolve));
  const address = site.address();
  assert.ok(address && typeof address === 'object');

  const browsers = new BrowserManager();
  try {
    await browsers.open('browser-smoke');
    await browsers.navigate('browser-smoke', `http://127.0.0.1:${address.port}/`);

    const before = await browsers.observe('browser-smoke');
    const button = before.interactiveElements.find(x => x.role === 'button' && x.name === 'Run action');
    assert.ok(button);

    await browsers.interact(
      'browser-smoke',
      before.stateVersion,
      button.ref,
      'click'
    );

    await assert.rejects(
      () => browsers.interact('browser-smoke', before.stateVersion, button.ref, 'click'),
      /STALE_STATE/
    );

    const after = await browsers.observe('browser-smoke');
    assert.notEqual(after.stateVersion, before.stateVersion);

    const checked = await verify(
      browsers,
      'TASK-browser-smoke',
      'browser-smoke',
      { textVisible: 'Done', titleIncludes: 'PBO Fixture' }
    );
    assert.equal(checked.status, 'PASS');
    const visibleCheck = checked.checks.find(x => x.kind === 'textVisible');
    assert.equal(visibleCheck?.pass, true);
  } finally {
    await browsers.close('browser-smoke').catch(() => undefined);
    await new Promise<void>(resolve => site.close(() => resolve()));
    fs.rmSync(root, { recursive: true, force: true });
    process.env.PBO_ALLOW_PRIVATE_NETWORKS = 'false';
  }
});
