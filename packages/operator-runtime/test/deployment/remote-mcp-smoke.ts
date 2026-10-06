import assert from 'node:assert/strict';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';

const baseUrl = process.env.PBO_REMOTE_URL || 'http://127.0.0.1:18080';
const token = process.env.PBO_MCP_TOKEN;
if (!token) throw new Error('PBO_MCP_TOKEN is required');

function textPayload(result: any): any {
  const block = result.content?.find((x: any) => x.type === 'text');
  if (!block || typeof block.text !== 'string') throw new Error('MCP_TEXT_RESULT_REQUIRED');
  return JSON.parse(block.text);
}

const transport = new StreamableHTTPClientTransport(
  new URL('/mcp', baseUrl),
  {
    requestInit: {
      headers: {
        Authorization: `Bearer ${token}`
      }
    }
  }
);
const client = new Client({ name: 'pbo-container-smoke', version: '1.0.0' });

await client.connect(transport);

try {
  const existingTaskId = process.env.PBO_TEST_TASK_ID;
  if (existingTaskId) {
    const state = textPayload(await client.callTool({
      name: 'browser_task_state',
      arguments: { taskId: existingTaskId }
    }));
    assert.equal(state.taskId, existingTaskId);
    assert.equal(state.goal, 'Container persistence smoke task');
    console.log(`PBO_PERSISTENCE_OK=${existingTaskId}`);
  } else {
    const tools = await client.listTools();
    const names = new Set(tools.tools.map(tool => tool.name));
    for (const required of [
      'browser_task_start',
      'browser_session_open',
      'browser_navigate',
      'browser_observe',
      'browser_verify'
    ]) assert.ok(names.has(required), required);

    const task = textPayload(await client.callTool({
      name: 'browser_task_start',
      arguments: { goal: 'Container persistence smoke task' }
    }));
    assert.match(task.taskId, /^TASK-/);

    const plannedSubgoal = 'Open and verify the public controlled smoke target';
    textPayload(await client.callTool({
      name: 'browser_plan_next',
      arguments: {
        taskId: task.taskId,
        subgoal: plannedSubgoal,
        decisionSummary: 'Navigate to the controlled public page, observe it, and verify its expected state.'
      }
    }));

    textPayload(await client.callTool({
      name: 'browser_session_open',
      arguments: {
        taskId: task.taskId,
        identityId: 'ci-container'
      }
    }));

    const actionId = 'ACT-container-example';
    const nav = textPayload(await client.callTool({
      name: 'browser_navigate',
      arguments: {
        actionId,
        taskId: task.taskId,
        identityId: 'ci-container',
        subgoal: plannedSubgoal,
        intent: 'Open the public controlled smoke target',
        url: 'https://example.com/',
        riskClass: 'R1'
      }
    }));
    assert.equal(nav.status, 'EXECUTED_UNVERIFIED');

    const observation = textPayload(await client.callTool({
      name: 'browser_observe',
      arguments: {
        taskId: task.taskId,
        identityId: 'ci-container'
      }
    }));
    assert.equal(observation.title, 'Example Domain');
    assert.equal(observation.trust, 'UNTRUSTED_WEB_DATA');
    assert.equal(observation.authority, 'NONE');
    console.log('PBO_OBSERVATION=' + JSON.stringify({ url: observation.url, title: observation.title, ariaSnapshot: observation.ariaSnapshot }));

    const verified = textPayload(await client.callTool({
      name: 'browser_verify',
      arguments: {
        taskId: task.taskId,
        identityId: 'ci-container',
        actionId,
        expected: {
          titleIncludes: 'Example Domain',
          textVisible: 'documentation examples'
        }
      }
    }));
    console.log('PBO_VERIFICATION=' + JSON.stringify(verified));
    assert.equal(verified.verification.status, 'PASS');
    assert.equal(verified.effect.status, 'VERIFIED_PASS');

    console.log(`PBO_TASK_ID=${task.taskId}`);
  }
} finally {
  await client.close();
}
