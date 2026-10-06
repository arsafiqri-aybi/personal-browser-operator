import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export type EffectStatus =
  | 'EXECUTING'
  | 'EXECUTED_UNVERIFIED'
  | 'VERIFIED_PASS'
  | 'VERIFIED_FAIL'
  | 'FAILED_SAFE'
  | 'UNKNOWN_EFFECT';

export interface EffectRecord {
  actionId: string;
  taskId: string;
  identityId: string;
  intent: string;
  operation: string;
  status: EffectStatus;
  error: string | null;
  verificationId: string | null;
  createdAt: string;
  updatedAt: string;
}

function root(): string {
  return process.env.PBO_DATA_DIR || path.resolve('runtime-data');
}

function safeActionId(actionId: string): string {
  if (!/^ACT-[A-Za-z0-9_-]+$/.test(actionId)) throw new Error('INVALID_ACTION_ID');
  return actionId;
}

export class EffectStore {
  private dir: string;

  constructor() {
    this.dir = path.join(root(), 'state', 'effects');
    fs.mkdirSync(this.dir, { recursive: true, mode: 0o700 });
  }

  private file(actionId: string): string {
    return path.join(this.dir, safeActionId(actionId) + '.json');
  }

  get(actionId: string): EffectRecord | null {
    const file = this.file(actionId);
    if (!fs.existsSync(file)) return null;
    return JSON.parse(fs.readFileSync(file, 'utf8')) as EffectRecord;
  }

  private persist(record: EffectRecord): EffectRecord {
    const file = this.file(record.actionId);
    const temp = file + '.' + crypto.randomUUID() + '.tmp';
    fs.writeFileSync(temp, JSON.stringify(record, null, 2), { encoding: 'utf8', mode: 0o600 });
    fs.renameSync(temp, file);
    return structuredClone(record);
  }

  begin(input: {
    actionId: string;
    taskId: string;
    identityId: string;
    intent: string;
    operation: string;
  }): { duplicate: boolean; record: EffectRecord } {
    const existing = this.get(input.actionId);
    if (existing) {
      const same =
        existing.taskId === input.taskId &&
        existing.identityId === input.identityId &&
        existing.intent === input.intent &&
        existing.operation === input.operation;
      if (!same) throw new Error('ACTION_ID_COLLISION');
      return { duplicate: true, record: existing };
    }

    const now = new Date().toISOString();
    const record: EffectRecord = {
      ...input,
      status: 'EXECUTING',
      error: null,
      verificationId: null,
      createdAt: now,
      updatedAt: now
    };
    return { duplicate: false, record: this.persist(record) };
  }

  executed(actionId: string): EffectRecord {
    const record = this.require(actionId);
    record.status = 'EXECUTED_UNVERIFIED';
    record.error = null;
    record.updatedAt = new Date().toISOString();
    return this.persist(record);
  }

  failed(actionId: string, error: string, unknownEffect: boolean): EffectRecord {
    const record = this.require(actionId);
    record.status = unknownEffect ? 'UNKNOWN_EFFECT' : 'FAILED_SAFE';
    record.error = error.slice(0, 1000);
    record.updatedAt = new Date().toISOString();
    return this.persist(record);
  }

  verified(actionId: string, verificationId: string, passed: boolean): EffectRecord {
    const record = this.require(actionId);
    record.status = passed ? 'VERIFIED_PASS' : 'VERIFIED_FAIL';
    record.verificationId = verificationId;
    record.updatedAt = new Date().toISOString();
    return this.persist(record);
  }

  private require(actionId: string): EffectRecord {
    const record = this.get(actionId);
    if (!record) throw new Error('EFFECT_NOT_FOUND');
    return record;
  }
}

export function duplicateEffectResponse(record: EffectRecord): {
  status: 'DUPLICATE_ACTION_SUPPRESSED';
  effect: EffectRecord;
  requiresReconciliation: boolean;
} {
  return {
    status: 'DUPLICATE_ACTION_SUPPRESSED',
    effect: record,
    requiresReconciliation: record.status !== 'VERIFIED_PASS'
  };
}
