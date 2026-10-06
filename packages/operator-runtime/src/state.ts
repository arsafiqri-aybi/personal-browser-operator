import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { TaskState, TaskStatus } from './types.js';

function dataRoot(): string {
  return process.env.PBO_DATA_DIR || path.resolve('runtime-data');
}

function taskDir(): string {
  return path.join(dataRoot(), 'state', 'tasks');
}

function safeTaskId(taskId: string): string {
  if (!/^TASK-[A-Za-z0-9_-]+$/.test(taskId)) throw new Error('INVALID_TASK_ID');
  return taskId;
}

export class TaskStore {
  private tasks = new Map<string, TaskState>();

  constructor() {
    fs.mkdirSync(taskDir(), { recursive: true, mode: 0o700 });
    this.loadPersisted();
  }

  private file(taskId: string): string {
    return path.join(taskDir(), safeTaskId(taskId) + '.json');
  }

  private loadPersisted(): void {
    for (const name of fs.readdirSync(taskDir())) {
      if (!name.endsWith('.json')) continue;
      try {
        const parsed = JSON.parse(fs.readFileSync(path.join(taskDir(), name), 'utf8')) as TaskState;
        safeTaskId(parsed.taskId);
        this.tasks.set(parsed.taskId, parsed);
      } catch {
        // Corrupt files are deliberately not promoted into authoritative state.
      }
    }
  }

  private persist(task: TaskState): void {
    const target = this.file(task.taskId);
    const temp = target + '.' + crypto.randomUUID() + '.tmp';
    fs.writeFileSync(temp, JSON.stringify(task, null, 2), { encoding: 'utf8', mode: 0o600 });
    fs.renameSync(temp, target);
  }

  private mutate(taskId: string, fn: (task: TaskState) => void): TaskState {
    const task = this.tasks.get(safeTaskId(taskId));
    if (!task) throw new Error(`TASK_NOT_FOUND:${taskId}`);
    fn(task);
    task.revision += 1;
    task.updatedAt = new Date().toISOString();
    this.persist(task);
    return structuredClone(task);
  }

  start(goal: string, deliverable?: string): TaskState {
    const now = new Date().toISOString();
    const task: TaskState = {
      taskId: `TASK-${crypto.randomUUID()}`,
      revision: 1,
      goal,
      deliverable: deliverable ?? null,
      status: 'ACTIVE',
      createdAt: now,
      updatedAt: now,
      browserIdentity: null,
      currentSubgoal: null,
      completedSubgoals: [],
      blockedSubgoals: [],
      evidenceRefs: [],
      uncertainties: [],
      completionVerificationId: null
    };
    this.tasks.set(task.taskId, task);
    this.persist(task);
    return structuredClone(task);
  }

  get(taskId: string): TaskState {
    const task = this.tasks.get(safeTaskId(taskId));
    if (!task) throw new Error(`TASK_NOT_FOUND:${taskId}`);
    return structuredClone(task);
  }

  bindIdentity(taskId: string, identityId: string): TaskState {
    return this.mutate(taskId, task => {
      task.browserIdentity = identityId;
    });
  }

  setStatus(taskId: string, status: TaskStatus): TaskState {
    return this.mutate(taskId, task => {
      task.status = status;
    });
  }

  setSubgoal(taskId: string, subgoal: string | null): TaskState {
    return this.mutate(taskId, task => {
      task.currentSubgoal = subgoal;
    });
  }

  planNextSubgoal(taskId: string, subgoalRaw: string): TaskState {
    const subgoal = subgoalRaw.trim();
    if (!subgoal) throw new Error('SUBGOAL_REQUIRED');
    return this.mutate(taskId, task => {
      if (task.status === 'COMPLETE' || task.status === 'FAILED') {
        throw new Error('TASK_NOT_ACTIVE');
      }
      task.currentSubgoal = subgoal;
      if (task.status === 'BLOCKED') task.status = 'ACTIVE';
    });
  }

  resolveSubgoal(
    taskId: string,
    outcome: 'COMPLETE' | 'BLOCKED',
    subgoalRaw?: string,
    evidenceRef?: string
  ): TaskState {
    return this.mutate(taskId, task => {
      const subgoal = (subgoalRaw ?? task.currentSubgoal ?? '').trim();
      if (!subgoal) throw new Error('ACTIVE_SUBGOAL_REQUIRED');

      if (outcome === 'COMPLETE') {
        if (!task.completedSubgoals.includes(subgoal)) task.completedSubgoals.push(subgoal);
        task.blockedSubgoals = task.blockedSubgoals.filter(item => item !== subgoal);
      } else {
        if (!task.blockedSubgoals.includes(subgoal)) task.blockedSubgoals.push(subgoal);
      }

      if (evidenceRef && !task.evidenceRefs.includes(evidenceRef)) {
        task.evidenceRefs.push(evidenceRef);
      }

      if (task.currentSubgoal === subgoal) task.currentSubgoal = null;
    });
  }

  addEvidence(taskId: string, evidenceRef: string): TaskState {
    return this.mutate(taskId, task => {
      if (!task.evidenceRefs.includes(evidenceRef)) task.evidenceRefs.push(evidenceRef);
    });
  }

  addUncertainty(taskId: string, uncertainty: string): TaskState {
    return this.mutate(taskId, task => {
      if (!task.uncertainties.includes(uncertainty)) task.uncertainties.push(uncertainty);
    });
  }

  complete(taskId: string, verification: { verificationId: string; status: 'PASS' | 'FAIL' | 'UNCERTAIN' }): TaskState {
    if (verification.status !== 'PASS') {
      throw new Error('COMPLETION_REQUIRES_PASS_VERIFICATION');
    }
    return this.mutate(taskId, task => {
      task.status = 'COMPLETE';
      task.completionVerificationId = verification.verificationId;
      if (!task.evidenceRefs.includes(verification.verificationId)) {
        task.evidenceRefs.push(verification.verificationId);
      }
    });
  }
}
