import crypto from 'node:crypto';
import type { RecoveryCategory, RecoveryDecision } from './types.js';

function classify(message: string): RecoveryCategory {
  const m = message.toUpperCase();
  if (m.includes('TARGET_NOT_FOUND')) return 'TARGET_NOT_FOUND';
  if (m.includes('STALE_STATE')) return 'STALE_STATE';
  if (m.includes('AMBIGUOUS')) return 'AMBIGUOUS_STATE';
  if (m.includes('AUTH') || m.includes('LOGIN')) return 'AUTH_REQUIRED';
  if (m.includes('CAPTCHA') || m.includes('PASSKEY') || m.includes('CHALLENGE')) return 'HUMAN_CHALLENGE';
  if (m.includes('TIMEOUT')) return 'TIMEOUT';
  if (m.includes('NETWORK') || m.includes('ECONN')) return 'NETWORK_FAILURE';
  if (m.includes('RATE') && m.includes('LIMIT')) return 'RATE_LIMITED';
  if (m.includes('POLICY') || m.includes('DENIED') || m.includes('APPROVAL_REQUIRED')) return 'POLICY_DENIED';
  if (m.includes('VERIFY') || m.includes('VERIFICATION')) return 'VERIFICATION_FAILED';
  if (m.includes('DIALOG')) return 'UNEXPECTED_DIALOG';
  return 'UNKNOWN_FAILURE';
}

export function recoveryDecision(errorMessage: string, operation?: string): RecoveryDecision {
  const category = classify(errorMessage);
  const potentiallyMutating = operation !== undefined && !['observe', 'hover'].includes(operation);
  let suggestedNextStep = 'Re-observe current state and re-plan from evidence.';

  if (category === 'AUTH_REQUIRED' || category === 'HUMAN_CHALLENGE') {
    suggestedNextStep = 'Pause automation and request protected human takeover.';
  } else if (category === 'POLICY_DENIED') {
    suggestedNextStep = 'Do not retry. Obtain required approval or change the requested action.';
  } else if (category === 'STALE_STATE' || category === 'TARGET_NOT_FOUND' || category === 'AMBIGUOUS_STATE') {
    suggestedNextStep = 'Create a fresh observation and ground a new target reference before any action.';
  } else if (potentiallyMutating && ['TIMEOUT', 'NETWORK_FAILURE', 'UNKNOWN_FAILURE'].includes(category)) {
    suggestedNextStep = 'Re-observe and verify whether the side effect already happened before considering retry.';
  }

  return {
    recoveryId: `RECOVERY-${crypto.randomUUID()}`,
    category,
    mustReobserve: category !== 'POLICY_DENIED',
    mustVerifyBeforeRetry: potentiallyMutating,
    safeToBlindRetry: false,
    suggestedNextStep,
    createdAt: new Date().toISOString()
  };
}
