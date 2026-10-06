import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { createMcpHandler } from '@modelcontextprotocol/server';

test('MCP contract exposes task, effect and verification tools', async () => {
  process.env.PBO_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'pbo-mcp-'));

  const { createOperatorServer } = await import('../../src/factory.js');
  const handler = createMcpHandler(createOperatorServer);

  const transport = new StreamableHTTPClientTransport(
    new URL('http://test.local/mcp'),
    { fetch: (url, init) => handler.fetch(new Request(url, init)) }
  );

  const client = new Client({ name: 'pbo-contract-test', version: '1.0.0' });
  await client.connect(transport);

  const list = await client.listTools();
  const names = new Set(list.tools.map(tool => tool.name));
  for (const required of [
    'browser_task_start',
    'browser_task_state',
    'browser_plan_next',
    'browser_subgoal_update',
    'browser_observe',
    'browser_navigate',
    'browser_interact',
    'browser_verify',
    'browser_effect_state',
    'browser_task_complete'
  ]) assert.ok(names.has(required), required);

  const started = await client.callTool({
    name: 'browser_task_start',
    arguments: { goal: 'Contract-test goal' }
  });
  const firstText = started.content.find(block => block.type === 'text');
  assert.ok(firstText && firstText.type === 'text');
  const task = JSON.parse(firstText.text) as { taskId: string; status: string };
  assert.match(task.taskId, /^TASK-/);
  assert.equal(task.status, 'ACTIVE');

  const planned = await client.callTool({
    name: 'browser_plan_next',
    arguments: {
      taskId: task.taskId,
      subgoal: 'Inspect current page state',
      decisionSummary: 'Need a grounded state before choosing a browser action.'
    }
  });
  const plannedText = planned.content.find(block => block.type === 'text');
  assert.ok(plannedText && plannedText.type === 'text');
  const plannedPayload = JSON.parse(plannedText.text) as { task: { currentSubgoal: string | null } };
  assert.equal(plannedPayload.task.currentSubgoal, 'Inspect current page state');

  const resolved = await client.callTool({
    name: 'browser_subgoal_update',
    arguments: {
      taskId: task.taskId,
      outcome: 'COMPLETE',
      evidenceRef: 'OBS-contract-plan'
    }
  });
  const resolvedText = resolved.content.find(block => block.type === 'text');
  assert.ok(resolvedText && resolvedText.type === 'text');
  const resolvedPayload = JSON.parse(resolvedText.text) as { currentSubgoal: string | null; completedSubgoals: string[] };
  assert.equal(resolvedPayload.currentSubgoal, null);
  assert.ok(resolvedPayload.completedSubgoals.includes('Inspect current page state'));

  const stalePlanAction = await client.callTool({
    name: 'browser_navigate',
    arguments: {
      actionId: 'ACT-contract-stale-plan',
      taskId: task.taskId,
      identityId: 'identity-not-open',
      subgoal: 'Inspect current page state',
      intent: 'Attempt action after the planned subgoal has already been resolved',
      url: 'https://example.com/',
      riskClass: 'R1'
    }
  });
  assert.equal(stalePlanAction.isError, true);
  const staleText = stalePlanAction.content.find(block => block.type === 'text');
  assert.ok(staleText && staleText.type === 'text');
  assert.match(staleText.text, /ACTIVE_SUBGOAL_REQUIRED/);

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
