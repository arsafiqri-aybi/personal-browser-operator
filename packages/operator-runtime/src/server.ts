import { McpServer } from '@modelcontextprotocol/server';
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import * as z from 'zod/v4';
import { BrowserManager } from './browser.js';
import { PolicyEngine } from './policy.js';
import { TaskStore } from './state.js';
import { verify } from './verifier.js';

const tasks = new TaskStore();
const browsers = new BrowserManager();
const policy = new PolicyEngine();

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

function createServer(): McpServer {
  const server = new McpServer({
    name: 'personal-browser-operator',
    version: '0.1.0'
  });

  server.registerTool(
    'browser_task_start',
    {
      description: 'Start a durable browser task from a high-level user goal. This does not perform browser side effects.',
      inputSchema: z.object({
        goal: z.string().min(1),
        deliverable: z.string().optional()
      })
    },
    async ({ goal, deliverable }) => {
      try {
        return result(tasks.start(goal, deliverable));
      } catch (e) {
        return error(e);
      }
    }
  );

  server.registerTool(
    'browser_task_state',
    {
      description: 'Read the authoritative current state of an existing browser task.',
      inputSchema: z.object({
        taskId: z.string().min(1)
      })
    },
    async ({ taskId }) => {
      try {
        return result(tasks.get(taskId));
      } catch (e) {
        return error(e);
      }
    }
  );

  server.registerTool(
    'browser_session_open',
    {
      description: 'Open or reuse an isolated persistent Chromium identity for an existing task. Credentials are never accepted as tool arguments.',
      inputSchema: z.object({
        taskId: z.string().min(1),
        identityId: z.string().regex(/^[A-Za-z0-9._-]+$/)
      })
    },
    async ({ taskId, identityId }) => {
      try {
        tasks.get(taskId);
        const opened = await browsers.open(identityId);
        const task = tasks.bindIdentity(taskId, identityId);
        return result({ opened, task });
      } catch (e) {
        return error(e);
      }
    }
  );

  server.registerTool(
    'browser_observe',
    {
      description: 'Observe the current browser page and return a versioned accessibility snapshot plus semantic interactive references. Read-only.',
      inputSchema: z.object({
        taskId: z.string().min(1),
        identityId: z.string().min(1)
      })
    },
    async ({ taskId, identityId }) => {
      try {
        tasks.get(taskId);
        const observation = await browsers.observe(identityId);
        tasks.addEvidence(taskId, observation.observationId);
        return result(observation);
      } catch (e) {
        return error(e);
      }
    }
  );

  server.registerTool(
    'browser_navigate',
    {
      description: 'Navigate the task-bound browser to a public HTTP(S) URL. Private-network destinations are denied by default.',
      inputSchema: z.object({
        taskId: z.string().min(1),
        identityId: z.string().min(1),
        intent: z.string().min(1),
        url: z.string().url(),
        riskClass: z.enum(['R0','R1','R2','R3','R4','R5']).default('R1'),
        approved: z.boolean().optional()
      })
    },
    async ({ taskId, identityId, intent, url, riskClass, approved }) => {
      try {
        tasks.get(taskId);
        const auth = policy.authorize({ taskId, intent, riskClass, approved });
        if (!auth.allowed) return result({ status: 'DENIED', authorization: auth });
        const navigation = await browsers.navigate(identityId, url);
        return result({ status: 'EXECUTED', authorization: auth, navigation, verificationRequired: true });
      } catch (e) {
        return error(e);
      }
    }
  );

  server.registerTool(
    'browser_interact',
    {
      description: 'Perform one bounded semantic interaction against a reference from the latest observation. Rejects stale references and requires task-intent binding.',
      inputSchema: z.object({
        taskId: z.string().min(1),
        identityId: z.string().min(1),
        intent: z.string().min(1),
        stateVersion: z.string().min(1),
        ref: z.string().min(1),
        operation: z.enum(['click','fill','press','select','hover']),
        value: z.string().optional(),
        riskClass: z.enum(['R0','R1','R2','R3','R4','R5']).default('R2'),
        approved: z.boolean().optional()
      })
    },
    async ({ taskId, identityId, intent, stateVersion, ref, operation, value, riskClass, approved }) => {
      try {
        tasks.get(taskId);
        const auth = policy.authorize({ taskId, intent, riskClass, approved });
        if (!auth.allowed) return result({ status: 'DENIED', authorization: auth });
        const action = await browsers.interact(identityId, stateVersion, ref, operation, value);
        return result({ status: 'EXECUTED', authorization: auth, action, verificationRequired: true });
      } catch (e) {
        return error(e);
      }
    }
  );

  server.registerTool(
    'browser_verify',
    {
      description: 'Verify observable postconditions after an action. This is the required evidence path before a consequential effect can be treated as successful.',
      inputSchema: z.object({
        taskId: z.string().min(1),
        identityId: z.string().min(1),
        expected: z.object({
          urlIncludes: z.string().optional(),
          titleIncludes: z.string().optional(),
          textVisible: z.string().optional()
        })
      })
    },
    async ({ taskId, identityId, expected }) => {
      try {
        tasks.get(taskId);
        const verification = await verify(browsers, taskId, identityId, expected);
        tasks.addEvidence(taskId, verification.verificationId);
        return result(verification);
      } catch (e) {
        return error(e);
      }
    }
  );

  server.registerTool(
    'browser_stop',
    {
      description: 'Close an active browser identity session. This does not delete its persistent authenticated profile.',
      inputSchema: z.object({
        taskId: z.string().min(1),
        identityId: z.string().min(1)
      })
    },
    async ({ taskId, identityId }) => {
      try {
        tasks.get(taskId);
        await browsers.close(identityId);
        return result({ status: 'CLOSED', identityId });
      } catch (e) {
        return error(e);
      }
    }
  );

  return server;
}

await serveStdio(createServer);
