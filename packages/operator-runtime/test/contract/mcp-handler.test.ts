import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { createMcpHandler } from '@modelcontextprotocol/server';

test('MCP contract exposes task tools and persists task state', async () => {
  process.env.PBO_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'pbo-mcp-'));

  const { createOperatorServer } = await import('../../src/factory.js');
  const handler = createMcpHandler(createOperatorServer);

  const transport = new StreamableHTTPClientTransport(
    new URL('http://test.local/mcp'),
    {
      fetch: (url, init) => handler.fetch(new Request(url, init))
    }
  );

  const client = new Client({ name: 'pbo-contract-test', version: '1.0.0' });
  await client.connect(transport);

  const list = await client.listTools();
  const names = new Set(list.tools.map(tool => tool.name));
  assert.ok(names.has('browser_task_start'));
  assert.ok(names.has('browser_task_state'));
  assert.ok(names.has('browser_observe'));
  assert.ok(names.has('browser_verify'));
  assert.ok(names.has('browser_task_complete'));

  const started = await client.callTool({
    name: 'browser_task_start',
    arguments: { goal: 'Contract-test goal' }
  });
  const firstText = started.content.find(block => block.type === 'text');
  assert.ok(firstText && firstText.type === 'text');
  const task = JSON.parse(firstText.text) as { taskId: string; status: string };
  assert.match(task.taskId, /^TASK-/);
  assert.equal(task.status, 'ACTIVE');

  const state = await client.callTool({
    name: 'browser_task_state',
    arguments: { taskId: task.taskId }
  });
  const stateText = state.content.find(block => block.type === 'text');
  assert.ok(stateText && stateText.type === 'text');
  const restored = JSON.parse(stateText.text) as { taskId: string; goal: string };
  assert.equal(restored.taskId, task.taskId);
  assert.equal(restored.goal, 'Contract-test goal');

  await client.close();
  await handler.close();
  fs.rmSync(process.env.PBO_DATA_DIR, { recursive: true, force: true });
});
