import crypto from 'node:crypto';
import type { TaskState } from './types.js';

export class TaskStore {
  private tasks = new Map<string, TaskState>();

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
      evidenceRefs: [],
      uncertainties: []
    };
    this.tasks.set(task.taskId, task);
    return structuredClone(task);
  }

  get(taskId: string): TaskState {
    const task = this.tasks.get(taskId);
    if (!task) throw new Error(`TASK_NOT_FOUND:${taskId}`);
    return structuredClone(task);
  }

  bindIdentity(taskId: string, identityId: string): TaskState {
    const task = this.tasks.get(taskId);
    if (!task) throw new Error(`TASK_NOT_FOUND:${taskId}`);
    task.browserIdentity = identityId;
    task.revision += 1;
    task.updatedAt = new Date().toISOString();
    return structuredClone(task);
  }

  addEvidence(taskId: string, evidenceRef: string): void {
    const task = this.tasks.get(taskId);
    if (!task) throw new Error(`TASK_NOT_FOUND:${taskId}`);
    task.evidenceRefs.push(evidenceRef);
    task.updatedAt = new Date().toISOString();
  }
}
