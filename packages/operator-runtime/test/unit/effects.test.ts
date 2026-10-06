import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { duplicateEffectResponse, EffectStore } from '../../src/effects.js';

test('same actionId suppresses duplicate side effect', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pbo-effect-'));
  process.env.PBO_DATA_DIR = root;
  const effects = new EffectStore();

  const input = {
    actionId: 'ACT-fixed',
    taskId: 'TASK-one',
    identityId: 'identity-one',
    intent: 'submit approved form',
    operation: 'click'
  };

  const first = effects.begin(input);
  assert.equal(first.duplicate, false);
  effects.executed(input.actionId);

  const second = effects.begin(input);
  assert.equal(second.duplicate, true);
  const suppressed = duplicateEffectResponse(second.record);
  assert.equal(suppressed.status, 'DUPLICATE_ACTION_SUPPRESSED');
  assert.equal(suppressed.requiresReconciliation, true);

  fs.rmSync(root, { recursive: true, force: true });
});

test('reusing actionId for different intent is rejected', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pbo-effect-collision-'));
  process.env.PBO_DATA_DIR = root;
  const effects = new EffectStore();

  effects.begin({
    actionId: 'ACT-collision',
    taskId: 'TASK-one',
    identityId: 'identity-one',
    intent: 'first intent',
    operation: 'click'
  });

  assert.throws(() => effects.begin({
    actionId: 'ACT-collision',
    taskId: 'TASK-one',
    identityId: 'identity-one',
    intent: 'different intent',
    operation: 'click'
  }), /ACTION_ID_COLLISION/);

  fs.rmSync(root, { recursive: true, force: true });
});

test('verified effect becomes safe reconciliation evidence', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pbo-effect-verified-'));
  process.env.PBO_DATA_DIR = root;
  const effects = new EffectStore();

  effects.begin({
    actionId: 'ACT-verified',
    taskId: 'TASK-one',
    identityId: 'identity-one',
    intent: 'save setting',
    operation: 'click'
  });
  effects.executed('ACT-verified');
  effects.verified('ACT-verified', 'VERIFY-1', true);

  const duplicate = effects.begin({
    actionId: 'ACT-verified',
    taskId: 'TASK-one',
    identityId: 'identity-one',
    intent: 'save setting',
    operation: 'click'
  });

  assert.equal(duplicate.record.status, 'VERIFIED_PASS');
  assert.equal(duplicateEffectResponse(duplicate.record).requiresReconciliation, false);

  fs.rmSync(root, { recursive: true, force: true });
});
