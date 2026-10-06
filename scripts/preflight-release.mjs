import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const publicBaseRaw = process.env.PBO_PUBLIC_BASE_URL;
assert.ok(publicBaseRaw, 'PBO_PUBLIC_BASE_URL is required');
assert.ok(process.env.PBO_OAUTH_ISSUER, 'PBO_OAUTH_ISSUER is required');

const publicBase = new URL(publicBaseRaw);
assert.equal(publicBase.protocol, 'https:', 'public base URL must use HTTPS');
assert.equal(publicBase.pathname, '/', 'public base URL must be a clean origin');
assert.equal(publicBase.search, '', 'public base URL must not contain a query');
assert.equal(publicBase.hash, '', 'public base URL must not contain a fragment');

const mcpUrl = new URL('/mcp', publicBase).toString();
const expectedAudience = process.env.PBO_OAUTH_AUDIENCE || mcpUrl;
assert.equal(expectedAudience, mcpUrl, 'PBO_OAUTH_AUDIENCE must equal the exact public /mcp resource');

const outputDir = path.resolve(process.env.PBO_PLUGIN_OUTPUT || 'dist/personal-browser-operator');

function run(label, script, extraEnv = {}) {
  const result = spawnSync(process.execPath, [script], {
    cwd: process.cwd(),
    env: { ...process.env, ...extraEnv },
    encoding: 'utf8'
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  assert.equal(result.status, 0, label + ' failed');
}

run('public host verification', 'scripts/verify-public-host.mjs');
run('OAuth provider preflight', 'scripts/verify-oauth-provider.mjs');
run('ChatGPT plugin render', 'scripts/render-chatgpt-plugin.mjs', {
  PBO_MCP_URL: mcpUrl,
  PBO_PLUGIN_OUTPUT: outputDir
});

const mcpPath = path.join(outputDir, 'mcp.json');
const pluginPath = path.join(outputDir, 'plugin.json');
const skillPath = path.join(outputDir, 'skills', 'browser-operator', 'SKILL.md');
for (const file of [mcpPath, pluginPath, skillPath]) {
  assert.ok(fs.existsSync(file), 'rendered plugin artifact missing: ' + file);
}

const mcpText = fs.readFileSync(mcpPath, 'utf8');
const mcp = JSON.parse(mcpText);
const server = mcp.mcpServers?.['personal-browser-operator'];
assert.ok(server, 'rendered MCP server definition missing');
assert.equal(server.type, 'streamable-http');
assert.equal(server.url, mcpUrl);

const combined = [mcpText, fs.readFileSync(pluginPath, 'utf8'), fs.readFileSync(skillPath, 'utf8')].join('\n');
assert.ok(!/Authorization\s*:\s*Bearer\s+\S+/i.test(combined), 'plugin artifact must not embed a bearer credential');
assert.ok(!/PBO_MCP_TOKEN\s*=\s*[^<\s]/.test(combined), 'plugin artifact must not embed an MCP token value');

console.log(JSON.stringify({
  ok: true,
  releaseTruth: 'PUBLIC_HOST_AND_OAUTH_DISCOVERY_PREFLIGHT_VERIFIED',
  publicBaseUrl: publicBase.toString(),
  mcpUrl,
  oauthIssuer: process.env.PBO_OAUTH_ISSUER,
  requiredScope: process.env.PBO_OAUTH_SCOPE || 'pbo:mcp',
  pluginOutput: outputDir,
  nextRequiredGate: 'AUTHORIZED_USER_TOKEN_AND_CHATGPT_MCP_PILOT'
}, null, 2));
