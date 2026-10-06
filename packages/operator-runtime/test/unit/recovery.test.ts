import assert from 'node:assert/strict';
import test from 'node:test';
import { recoveryDecision } from '../../src/recovery.js';

test('mutating timeout requires re-observation and verification before retry', () => {
  const decision = recoveryDecision('TimeoutError: click timed out', 'click');
  assert.equal(decision.category, 'TIMEOUT');
  assert.equal(decision.mustReobserve, true);
  assert.equal(decision.mustVerifyBeforeRetry, true);
  assert.equal(decision.safeToBlindRetry, false);
});

test('stale state requires a fresh observation', () => {
  const decision = recoveryDecision('STALE_STATE', 'click');
  assert.equal(decision.category, 'STALE_STATE');
  assert.match(decision.suggestedNextStep, /fresh observation/i);
});

test('human challenge routes to takeover', () => {
  const decision = recoveryDecision('PASSKEY_CHALLENGE_REQUIRED', 'click');
  assert.equal(decision.category, 'HUMAN_CHALLENGE');
  assert.match(decision.suggestedNextStep, /human takeover/i);
});
