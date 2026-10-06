import { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import { AuditLedger } from './audit.js';
import { duplicateEffectResponse, EffectStore } from './effects.js';
import { MobileRelayClient, verifyMobileObservation } from './mobile.js';
import { PolicyEngine } from './policy.js';
import { recoveryDecision } from './recovery.js';
import { TaskStore } from './state.js';
import { TakeoverManager } from './takeover.js';
import { VerificationStore } from './verifier.js';

const tasks = new TaskStore();
const policy = new PolicyEngine();
const audit = new AuditLedger();
const effects = new EffectStore();
const verifications = new VerificationStore();
const takeover = new TakeoverManager(tasks);
const mobile = new MobileRelayClient();

function result(value: unknown) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }]
  };
}

function error(err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  return {
    content: [{ type: 'text' as const, text: JSON.stringify({ error: message }) }],
    isError: true
  };
}

function mobileIdentity(deviceId: string): string {
  return `mobile:${deviceId}`;
}

function safelyFailedCategory(category: string): boolean {
  return ['TARGET_NOT_FOUND', 'STALE_STATE', 'AMBIGUOUS_STATE', 'POLICY_DENIED'].includes(category);
}

export function createMobileOperatorServer(): McpServer {
  const server = new McpServer({
    name: 'personal-mobile-operator',
    version: '0.1.0',
    description: 'Private task-aware Android device operator using an authenticated relay and AccessibilityService execution host.'
  });

  server.registerTool(
    'mobile_task_start',
    {
      description: 'Start a durable mobile-device task from the user high-level goal.',
      inputSchema: z.object({
        goal: z.string().min(1),
        deliverable: z.string().optional()
      })
    },
    async ({ goal, deliverable }) => {
      try {
        const task = tasks.start(goal, deliverable);
        audit.append({ eventType: 'TASK_STARTED', taskId: task.taskId, summary: 'User mobile task created.' });
        return result(task);
      } catch (e) {
        return error(e);
      }
    }
  );

  server.registerTool(
    'mobile_device_status',
    {
      description: 'Check whether the configured Android device host is connected to the relay.',
      inputSchema: z.object({
        taskId: z.string().min(1),
        deviceId: z.string().regex(/^[A-Za-z0-9._-]{1,80}$/)
      })
    },
    async ({ taskId, deviceId }) => {
      try {
        tasks.get(taskId);
        return result(await mobile.status(deviceId));
      } catch (e) {
        return error(e);
      }
    }
  );

  server.registerTool(
    'mobile_observe',
    {
      description: 'Read the active Android accessibility tree as explicitly untrusted device data and issue ephemeral refs.',
      inputSchema: z.object({
        taskId: z.string().min(1),
        deviceId: z.string().regex(/^[A-Za-z0-9._-]{1,80}$/)
      })
    },
    async ({ taskId, deviceId }) => {
      try {
        tasks.get(taskId);
        const observation = await mobile.observe(deviceId);
        tasks.addEvidence(taskId, observation.observationId);
        audit.append({
          eventType: 'MOBILE_OBSERVED',
          taskId,
          identityId: mobileIdentity(deviceId),
          summary: `Android observation captured from ${observation.packageName}.`,
          evidenceRefs: [observation.observationId]
        });
        return result(observation);
      } catch (e) {
        return error(e);
      }
    }
  );

  server.registerTool(
    'mobile_open_url',
    {
      description: 'Open an http/https URL on the Android host under a stable actionId. Requires post-action observation and verification.',
      inputSchema: z.object({
        actionId: z.string().regex(/^ACT-[A-Za-z0-9_-]+$/),
        taskId: z.string().min(1),
        deviceId: z.string().regex(/^[A-Za-z0-9._-]{1,80}$/),
        intent: z.string().min(1),
        url: z.string().url(),
        riskClass: z.enum(['R0','R1','R2','R3','R4','R5']).default('R1'),
        approved: z.boolean().optional()
      })
    },
    async ({ actionId, taskId, deviceId, intent, url, riskClass, approved }) => {
      try {
        tasks.get(taskId);
        const authorization = policy.authorize({ taskId, intent, riskClass, approved });
        if (!authorization.allowed) return result({ status: 'DENIED', authorization });

        const identityId = mobileIdentity(deviceId);
        const begun = effects.begin({ actionId, taskId, identityId, intent, operation: 'mobile_open_url' });
        if (begun.duplicate) return result(duplicateEffectResponse(begun.record));

        try {
          const action = await mobile.openUrl(deviceId, url, approved);
          const effect = effects.executed(actionId);
          audit.append({ eventType: 'MOBILE_URL_OPENED', taskId, identityId, summary: `URL opened for ${actionId}.` });
          return result({ status: 'EXECUTED_UNVERIFIED', authorization, action, effect, verificationRequired: true });
        } catch (e) {
          const message = e instanceof Error ? e.message : String(e);
          const recovery = recoveryDecision(message, 'mobile_open_url');
          const effect = effects.failed(actionId, message, !safelyFailedCategory(recovery.category));
          return result({ status: effect.status, error: message, effect, recovery });
        }
      } catch (e) {
        return error(e);
      }
    }
  );

  server.registerTool(
    'mobile_interact',
    {
      description: 'Perform one ref-bound click or fill from a fresh Android observation. Password fields fail closed unless approved=true.',
      inputSchema: z.object({
        actionId: z.string().regex(/^ACT-[A-Za-z0-9_-]+$/),
        taskId: z.string().min(1),
        deviceId: z.string().regex(/^[A-Za-z0-9._-]{1,80}$/),
        intent: z.string().min(1),
        stateVersion: z.string().min(1),
        ref: z.string().min(1),
        operation: z.enum(['click','fill']),
        value: z.string().optional(),
        riskClass: z.enum(['R0','R1','R2','R3','R4','R5']).default('R2'),
        approved: z.boolean().optional()
      })
    },
    async ({ actionId, taskId, deviceId, intent, stateVersion, ref, operation, value, riskClass, approved }) => {
      try {
        tasks.get(taskId);
        const authorization = policy.authorize({ taskId, intent, riskClass, approved });
        if (!authorization.allowed) return result({ status: 'DENIED', authorization });

        const identityId = mobileIdentity(deviceId);
        const begun = effects.begin({ actionId, taskId, identityId, intent, operation: `mobile_${operation}` });
        if (begun.duplicate) return result(duplicateEffectResponse(begun.record));

        try {
          const action = await mobile.interact(deviceId, stateVersion, ref, operation, value, approved);
          const effect = effects.executed(actionId);
          audit.append({ eventType: 'MOBILE_INTERACTION_EXECUTED', taskId, identityId, summary: `${operation} executed for ${actionId}.` });
          return result({ status: 'EXECUTED_UNVERIFIED', authorization, action, effect, verificationRequired: true });
        } catch (e) {
          const message = e instanceof Error ? e.message : String(e);
          const recovery = recoveryDecision(message, `mobile_${operation}`);
          const effect = effects.failed(actionId, message, !safelyFailedCategory(recovery.category));
          return result({ status: effect.status, error: message, effect, recovery });
        }
      } catch (e) {
        return error(e);
      }
    }
  );

  server.registerTool(
    'mobile_global_action',
    {
      description: 'Perform Android BACK, HOME, or RECENTS under a stable actionId.',
      inputSchema: z.object({
        actionId: z.string().regex(/^ACT-[A-Za-z0-9_-]+$/),
        taskId: z.string().min(1),
        deviceId: z.string().regex(/^[A-Za-z0-9._-]{1,80}$/),
        intent: z.string().min(1),
        action: z.enum(['BACK','HOME','RECENTS']),
        riskClass: z.enum(['R0','R1','R2','R3','R4','R5']).default('R1'),
        approved: z.boolean().optional()
      })
    },
    async ({ actionId, taskId, deviceId, intent, action, riskClass, approved }) => {
      try {
        tasks.get(taskId);
        const authorization = policy.authorize({ taskId, intent, riskClass, approved });
        if (!authorization.allowed) return result({ status: 'DENIED', authorization });

        const identityId = mobileIdentity(deviceId);
        const begun = effects.begin({ actionId, taskId, identityId, intent, operation: `mobile_global_${action.toLowerCase()}` });
        if (begun.duplicate) return result(duplicateEffectResponse(begun.record));

        try {
          const executed = await mobile.globalAction(deviceId, action, approved);
          const effect = effects.executed(actionId);
          return result({ status: 'EXECUTED_UNVERIFIED', authorization, action: executed, effect, verificationRequired: true });
        } catch (e) {
          const message = e instanceof Error ? e.message : String(e);
          const recovery = recoveryDecision(message, 'mobile_global_action');
          const effect = effects.failed(actionId, message, !safelyFailedCategory(recovery.category));
          return result({ status: effect.status, error: message, effect, recovery });
        }
      } catch (e) {
        return error(e);
      }
    }
  );

  server.registerTool(
    'mobile_verify',
    {
      description: 'Capture a fresh mobile observation and verify package/window/text postconditions. Reconciles an action when actionId is supplied.',
      inputSchema: z.object({
        taskId: z.string().min(1),
        deviceId: z.string().regex(/^[A-Za-z0-9._-]{1,80}$/),
        actionId: z.string().regex(/^ACT-[A-Za-z0-9_-]+$/).optional(),
        expected: z.object({
          packageName: z.string().optional(),
          windowClassIncludes: z.string().optional(),
          textIncludes: z.string().optional()
        })
      })
    },
    async ({ taskId, deviceId, actionId, expected }) => {
      try {
        tasks.get(taskId);
        const observation = await mobile.observe(deviceId);
        const verification = verifyMobileObservation(taskId, observation, expected);
        verifications.save(verification);
        tasks.addEvidence(taskId, observation.observationId);
        tasks.addEvidence(taskId, verification.verificationId);

        let effect = null;
        if (actionId) {
          const existing = effects.get(actionId);
          if (!existing) throw new Error('EFFECT_NOT_FOUND');
          if (existing.taskId !== taskId || existing.identityId !== mobileIdentity(deviceId)) {
            throw new Error('EFFECT_SCOPE_MISMATCH');
          }
          effect = effects.verified(actionId, verification.verificationId, verification.status === 'PASS');
        }

        audit.append({
          eventType: 'MOBILE_VERIFIED',
          taskId,
          identityId: mobileIdentity(deviceId),
          summary: `Mobile verification result: ${verification.status}.`,
          evidenceRefs: [observation.observationId, verification.verificationId]
        });

        return result({ observation, verification, effect });
      } catch (e) {
        return error(e);
      }
    }
  );

  server.registerTool(
    'mobile_takeover',
    {
      description: 'Pause automation while the user completes login, 2FA, CAPTCHA, passkey, permission prompt, or another protected step directly on the phone.',
      inputSchema: z.object({
        taskId: z.string().min(1),
        deviceId: z.string().regex(/^[A-Za-z0-9._-]{1,80}$/),
        reason: z.string().min(1)
      })
    },
    async ({ taskId, deviceId, reason }) => {
      try {
        await mobile.status(deviceId);
        const state = takeover.request(taskId, reason);
        audit.append({ eventType: 'MOBILE_HUMAN_TAKEOVER_REQUESTED', taskId, identityId: mobileIdentity(deviceId), summary: reason.slice(0, 300) });
        return result(state);
      } catch (e) {
        return error(e);
      }
    }
  );

  server.registerTool(
    'mobile_resume',
    {
      description: 'Resume after direct user control. Caller must obtain a fresh mobile_observe before another ref-bound action.',
      inputSchema: z.object({
        taskId: z.string().min(1),
        deviceId: z.string().regex(/^[A-Za-z0-9._-]{1,80}$/)
      })
    },
    async ({ taskId, deviceId }) => {
      try {
        await mobile.status(deviceId);
        const state = takeover.resume(taskId);
        return result({ state, requiresFreshObservation: true });
      } catch (e) {
        return error(e);
      }
    }
  );

  server.registerTool(
    'mobile_task_complete',
    {
      description: 'Mark a mobile task COMPLETE only from a persisted PASS verification for the same task.',
      inputSchema: z.object({
        taskId: z.string().min(1),
        verificationId: z.string().min(1)
      })
    },
    async ({ taskId, verificationId }) => {
      try {
        const verification = verifications.get(verificationId);
        if (verification.taskId !== taskId) throw new Error('VERIFICATION_TASK_MISMATCH');
        const task = tasks.complete(taskId, verification);
        audit.append({ eventType: 'TASK_COMPLETED', taskId, summary: 'Mobile task completed from PASS verification.', evidenceRefs: [verificationId] });
        return result(task);
      } catch (e) {
        return error(e);
      }
    }
  );

  server.registerTool(
    'mobile_audit_tail',
    {
      description: 'Read recent privacy-minimized audit events for the mobile task.',
      inputSchema: z.object({
        taskId: z.string().min(1),
        limit: z.number().int().min(1).max(200).default(50)
      })
    },
    async ({ taskId, limit }) => {
      try {
        tasks.get(taskId);
        return result(audit.tail(taskId, limit));
      } catch (e) {
        return error(e);
      }
    }
  );

  return server;
}
