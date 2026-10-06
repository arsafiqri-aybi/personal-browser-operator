import type { TaskStore } from './state.js';

export class TakeoverManager {
  constructor(private tasks: TaskStore) {}

  request(taskId: string, reason: string): { status: 'WAITING_FOR_USER'; reason: string } {
    this.tasks.setStatus(taskId, 'WAITING_FOR_USER');
    this.tasks.addUncertainty(taskId, `human_takeover:${reason}`);
    return { status: 'WAITING_FOR_USER', reason };
  }

  resume(taskId: string): { status: 'ACTIVE'; requiresFreshObservation: true } {
    this.tasks.setStatus(taskId, 'ACTIVE');
    return { status: 'ACTIVE', requiresFreshObservation: true };
  }
}
