import assert from 'node:assert/strict';
import test from 'node:test';
import { PolicyEngine } from '../../src/policy.js';

test('policy allows only configured automatic risk ceiling unless approved', () => {
  process.env.PBO_AUTO_RISK = 'R2';
  const policy = new PolicyEngine();

  assert.equal(policy.authorize({
    taskId: 'TASK-test',
    intent: 'read page',
    riskClass: 'R2'
  }).allowed, true);

  assert.equal(policy.authorize({
    taskId: 'TASK-test',
    intent: 'publish post',
    riskClass: 'R3'
  }).allowed, false);

  assert.equal(policy.authorize({
    taskId: 'TASK-test',
    intent: 'publish approved post',
    riskClass: 'R3',
    approved: true
  }).allowed, true);
});

test('policy rejects missing task-intent binding', () => {
  const policy = new PolicyEngine();
  const result = policy.authorize({
    taskId: '',
    intent: '',
    riskClass: 'R0'
  });
  assert.equal(result.allowed, false);
  assert.equal(result.reason, 'ACTION_INTENT_BINDING_REQUIRED');
});
