import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { AuditLedger } from '../../src/audit.js';
import { TaskStore } from '../../src/state.js';

test('task state persists atomically and reloads', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pbo-state-'));
  process.env.PBO_DATA_DIR = root;

  const first = new TaskStore();
  const created = first.start('Open a page and verify it');
  first.bindIdentity(created.taskId, 'identity-a');
  first.addEvidence(created.taskId, 'OBS-1');

  const second = new TaskStore();
  const restored = second.get(created.taskId);

  assert.equal(restored.goal, created.goal);
  assert.equal(restored.browserIdentity, 'identity-a');
  assert.ok(restored.evidenceRefs.includes('OBS-1'));

  fs.rmSync(root, { recursive: true, force: true });
});

test('task completion refuses failed or uncertain verification', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pbo-complete-'));
  process.env.PBO_DATA_DIR = root;
  const store = new TaskStore();
  const task = store.start('Do a verified thing');

  assert.throws(
    () => store.complete(task.taskId, { verificationId: 'VERIFY-fail', status: 'FAIL' }),
    /COMPLETION_REQUIRES_PASS_VERIFICATION/
  );

  const completed = store.complete(task.taskId, { verificationId: 'VERIFY-pass', status: 'PASS' });
  assert.equal(completed.status, 'COMPLETE');
  assert.equal(completed.completionVerificationId, 'VERIFY-pass');

  fs.rmSync(root, { recursive: true, force: true });
});

test('audit entries form a hash chain', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pbo-audit-'));
  process.env.PBO_DATA_DIR = root;
  const audit = new AuditLedger();

  const a = audit.append({ eventType: 'A', taskId: 'TASK-test', summary: 'first' });
  const b = audit.append({ eventType: 'B', taskId: 'TASK-test', summary: 'second' });

  assert.equal(a.previousHash, null);
  assert.equal(b.previousHash, a.eventHash);
  assert.notEqual(a.eventHash, b.eventHash);

  fs.rmSync(root, { recursive: true, force: true });
});


test('planner subgoal lifecycle persists big-picture progress without hidden reasoning', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pbo-plan-'));
  process.env.PBO_DATA_DIR = root;

  const store = new TaskStore();
  const task = store.start('Research a product and submit the verified result');

  const planned = store.planNextSubgoal(task.taskId, 'Collect authoritative product facts');
  assert.equal(planned.currentSubgoal, 'Collect authoritative product facts');

  const completed = store.resolveSubgoal(
    task.taskId,
    'COMPLETE',
    undefined,
    'OBS-authoritative-facts'
  );
  assert.equal(completed.currentSubgoal, null);
  assert.ok(completed.completedSubgoals.includes('Collect authoritative product facts'));
  assert.ok(completed.evidenceRefs.includes('OBS-authoritative-facts'));

  store.planNextSubgoal(task.taskId, 'Submit result');
  const blocked = store.resolveSubgoal(task.taskId, 'BLOCKED', undefined);
  assert.equal(blocked.currentSubgoal, null);
  assert.ok(blocked.blockedSubgoals.includes('Submit result'));

  const restored = new TaskStore().get(task.taskId);
  assert.ok(restored.completedSubgoals.includes('Collect authoritative product facts'));
  assert.ok(restored.blockedSubgoals.includes('Submit result'));

  fs.rmSync(root, { recursive: true, force: true });
});
