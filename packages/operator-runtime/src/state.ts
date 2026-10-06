import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { AcceptanceCriterionEvidence, RiskClass, TaskState, TaskStatus } from './types.js';

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

function cleanList(values: string[]): string[] {
  return [...new Set(values.map(value => value.trim()).filter(Boolean))];
}

function normalizeDomain(value: string): string {
  const domain = value.trim().toLowerCase().replace(/\.$/, '');
  if (!/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)(?:\.(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?))*$/.test(domain)) {
    throw new Error('INVALID_ALLOWED_DOMAIN');
  }
  return domain;
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
        const raw = JSON.parse(fs.readFileSync(path.join(taskDir(), name), 'utf8')) as Partial<TaskState>;
        if (!raw.taskId) throw new Error('INVALID_PERSISTED_TASK');
        safeTaskId(raw.taskId);
        const parsed = {
          ...raw,
          protectedConstraints: cleanList(raw.protectedConstraints ?? []),
          allowedDomains: (raw.allowedDomains ?? []).map(normalizeDomain),
          riskProfile: raw.riskProfile ?? 'R2',
          acceptanceCriteria: cleanList(raw.acceptanceCriteria ?? []),
          acceptanceEvidence: (raw.acceptanceEvidence ?? []).map(entry => ({
            criterion: String(entry.criterion).trim(),
            evidenceRefs: cleanList(entry.evidenceRefs ?? [])
          })).filter(entry => entry.criterion.length > 0)
        } as TaskState;
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

  start(
    goal: string,
    deliverable?: string,
    protectedConstraints: string[] = [],
    allowedDomains: string[] = [],
    riskProfile: RiskClass = 'R2',
    acceptanceCriteria: string[] = []
  ): TaskState {
    const now = new Date().toISOString();
    const task: TaskState = {
      taskId: `TASK-${crypto.randomUUID()}`,
      revision: 1,
      goal,
      deliverable: deliverable ?? null,
      protectedConstraints: cleanList(protectedConstraints),
      allowedDomains: cleanList(allowedDomains).map(normalizeDomain),
      riskProfile,
      acceptanceCriteria: cleanList(acceptanceCriteria),
      acceptanceEvidence: [],
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
      if (task.browserIdentity !== null && task.browserIdentity !== identityId) {
        throw new Error('TASK_IDENTITY_REBIND_DENIED');
      }
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

  complete(
    taskId: string,
    verification: { verificationId: string; status: 'PASS' | 'FAIL' | 'UNCERTAIN' },
    criterionEvidence: AcceptanceCriterionEvidence[] = []
  ): TaskState {
    if (verification.status !== 'PASS') {
      throw new Error('COMPLETION_REQUIRES_PASS_VERIFICATION');
    }

    return this.mutate(taskId, task => {
      const availableEvidence = new Set(task.evidenceRefs);
      availableEvidence.add(verification.verificationId);

      const normalized: AcceptanceCriterionEvidence[] = [];
      const seenCriteria = new Set<string>();

      for (const entry of criterionEvidence) {
        const criterion = entry.criterion.trim();
        const evidenceRefs = cleanList(entry.evidenceRefs);
        if (!criterion) throw new Error('COMPLETION_CRITERION_REQUIRED');
        if (seenCriteria.has(criterion)) throw new Error('COMPLETION_DUPLICATE_CRITERION');
        if (!task.acceptanceCriteria.includes(criterion)) throw new Error('COMPLETION_UNKNOWN_CRITERION');
        if (evidenceRefs.length === 0) throw new Error('COMPLETION_CRITERION_EVIDENCE_REQUIRED');
        if (evidenceRefs.some(ref => !availableEvidence.has(ref))) {
          throw new Error('COMPLETION_EVIDENCE_NOT_IN_TASK');
        }
        seenCriteria.add(criterion);
        normalized.push({ criterion, evidenceRefs });
      }

      const uncovered = task.acceptanceCriteria.filter(criterion => !seenCriteria.has(criterion));
      if (uncovered.length > 0) throw new Error('COMPLETION_ACCEPTANCE_CRITERIA_UNCOVERED');

      task.status = 'COMPLETE';
      task.acceptanceEvidence = normalized;
      task.completionVerificationId = verification.verificationId;
      if (!task.evidenceRefs.includes(verification.verificationId)) {
        task.evidenceRefs.push(verification.verificationId);
      }
    });
  }
}
