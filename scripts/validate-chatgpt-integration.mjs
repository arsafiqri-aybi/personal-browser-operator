import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = path.resolve('integrations/chatgpt/personal-browser-operator');
const pluginPath = path.join(root, 'plugin.json');
const templatePath = path.join(root, 'mcp.json.template');
const skillPath = path.join(root, 'skills', 'browser-operator', 'SKILL.md');

for (const file of [pluginPath, templatePath, skillPath]) {
  assert.ok(fs.existsSync(file), `missing integration source: ${file}`);
}

const plugin = JSON.parse(fs.readFileSync(pluginPath, 'utf8'));
assert.equal(plugin.$schema, 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json');
assert.equal(plugin.name, 'personal-browser-operator');
assert.match(plugin.version, /^\d+\.\d+\.\d+$/);
assert.ok(typeof plugin.description === 'string' && plugin.description.length > 20);

const iface = plugin.extensions?.['com.openai']?.interface;
assert.ok(iface, 'OpenAI interface metadata required');
assert.equal(iface.displayName, 'Personal Browser Operator');
assert.ok(
  typeof iface.shortDescription === 'string' &&
  iface.shortDescription.length > 0 &&
  iface.shortDescription.length <= 30,
  'shortDescription must be 1-30 characters'
);
assert.ok(
  Array.isArray(iface.defaultPrompt) &&
  iface.defaultPrompt.length >= 1 &&
  iface.defaultPrompt.length <= 3 &&
  iface.defaultPrompt.every(x => typeof x === 'string' && x.trim().length > 0),
  'defaultPrompt must contain 1-3 non-empty strings'
);

const template = fs.readFileSync(templatePath, 'utf8');
assert.equal((template.match(/__PBO_MCP_URL__/g) || []).length, 1);
const renderedTemplate = JSON.parse(
  template.replace('__PBO_MCP_URL__', 'https://browser.example.invalid/mcp')
);
const server = renderedTemplate.mcpServers?.['personal-browser-operator'];
assert.ok(server, 'personal-browser-operator MCP server required');
assert.equal(server.type, 'streamable-http');
assert.equal(server.url, 'https://browser.example.invalid/mcp');

const skill = fs.readFileSync(skillPath, 'utf8');
assert.match(skill, /^---\nname: browser-operator\n/m);
for (const required of [
  'browser_task_start',
  'browser_task_state',
  'browser_session_open',
  'browser_observe',
  'browser_navigate',
  'browser_interact',
  'browser_verify',
  'browser_effect_state',
  'browser_recover',
  'browser_takeover',
  'browser_resume',
  'browser_task_complete'
]) {
  assert.ok(skill.includes(`\`${required}\``), `skill missing tool guidance: ${required}`);
}
assert.ok(skill.includes('UNTRUSTED_WEB_DATA'));
assert.ok(skill.includes('UNKNOWN_EFFECT'));
assert.ok(skill.includes('fresh \`browser_observe\`'));

for (const [label, content] of [
  ['plugin.json', fs.readFileSync(pluginPath, 'utf8')],
  ['mcp.json.template', template],
  ['SKILL.md', skill]
]) {
  assert.ok(!/Authorization\s*:\s*Bearer\s+\S+/i.test(content), `${label} must not contain bearer credentials`);
  assert.ok(!/PBO_MCP_TOKEN\s*=\s*[^<\s]/.test(content), `${label} must not contain an MCP token value`);
}

const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pbo-chatgpt-plugin-'));
try {
  const render = spawnSync(
    process.execPath,
    ['scripts/render-chatgpt-plugin.mjs'],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        PBO_MCP_URL: 'https://browser.example.invalid/mcp',
        PBO_PLUGIN_OUTPUT: outDir
      },
      encoding: 'utf8'
    }
  );
  assert.equal(render.status, 0, render.stderr || render.stdout);

  const renderedMcp = JSON.parse(fs.readFileSync(path.join(outDir, 'mcp.json'), 'utf8'));
  assert.equal(
    renderedMcp.mcpServers['personal-browser-operator'].url,
    'https://browser.example.invalid/mcp'
  );
  assert.ok(fs.existsSync(path.join(outDir, 'plugin.json')));
  assert.ok(fs.existsSync(path.join(outDir, 'skills', 'browser-operator', 'SKILL.md')));

  const insecure = spawnSync(
    process.execPath,
    ['scripts/render-chatgpt-plugin.mjs'],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        PBO_MCP_URL: 'http://127.0.0.1:8787/mcp',
        PBO_PLUGIN_OUTPUT: outDir
      },
      encoding: 'utf8'
    }
  );
  assert.notEqual(insecure.status, 0, 'renderer must reject non-HTTPS/private MCP URL');
} finally {
  fs.rmSync(outDir, { recursive: true, force: true });
}

console.log(JSON.stringify({
  ok: true,
  plugin: plugin.name,
  version: plugin.version,
  shortDescriptionLength: iface.shortDescription.length,
  renderer: 'verified'
}, null, 2));
