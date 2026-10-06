import fs from 'node:fs';
import path from 'node:path';

const sourceDir = path.resolve('integrations/chatgpt/personal-browser-operator');
const outputDir = path.resolve(process.env.PBO_PLUGIN_OUTPUT || 'dist/personal-browser-operator');
const rawUrl = process.env.PBO_MCP_URL;

if (!rawUrl) {
  throw new Error('PBO_MCP_URL is required');
}

const url = new URL(rawUrl);
if (url.protocol !== 'https:') {
  throw new Error('PBO_MCP_URL must use HTTPS');
}
if (url.pathname !== '/mcp') {
  throw new Error('PBO_MCP_URL must point to the public /mcp endpoint');
}

const host = url.hostname.toLowerCase();
if (
  host === 'localhost' ||
  host === '127.0.0.1' ||
  host === '::1' ||
  host.endsWith('.local') ||
  /^10\./.test(host) ||
  /^192\.168\./.test(host) ||
  /^172\.(1[6-9]|2\d|3[01])\./.test(host)
) {
  throw new Error('PBO_MCP_URL must be a public HTTPS origin');
}

fs.rmSync(outputDir, { recursive: true, force: true });
fs.mkdirSync(path.join(outputDir, 'skills', 'browser-operator'), { recursive: true });

fs.copyFileSync(
  path.join(sourceDir, 'plugin.json'),
  path.join(outputDir, 'plugin.json')
);
fs.copyFileSync(
  path.join(sourceDir, 'skills', 'browser-operator', 'SKILL.md'),
  path.join(outputDir, 'skills', 'browser-operator', 'SKILL.md')
);

const template = fs.readFileSync(path.join(sourceDir, 'mcp.json.template'), 'utf8');
const mcp = template.replace('__PBO_MCP_URL__', url.toString());
if (mcp.includes('__PBO_MCP_URL__')) {
  throw new Error('MCP URL template replacement failed');
}
fs.writeFileSync(path.join(outputDir, 'mcp.json'), mcp, 'utf8');

console.log(JSON.stringify({
  ok: true,
  source: sourceDir,
  output: outputDir,
  mcpUrl: url.toString()
}, null, 2));
