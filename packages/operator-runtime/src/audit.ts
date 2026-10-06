import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { AuditEvent } from './types.js';

function root(): string {
  return process.env.PBO_DATA_DIR || path.resolve('runtime-data');
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return '{' + Object.keys(record).sort().map(k => JSON.stringify(k) + ':' + canonical(record[k])).join(',') + '}';
  }
  return JSON.stringify(value);
}

function hash(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function safeScope(value: string): string {
  return value.replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 160);
}

export class AuditLedger {
  private dir: string;

  constructor() {
    this.dir = path.join(root(), 'audit');
    fs.mkdirSync(this.dir, { recursive: true, mode: 0o700 });
  }

  private file(taskId: string | null): string {
    return path.join(this.dir, safeScope(taskId ?? 'system') + '.ndjson');
  }

  private previousHash(file: string): string | null {
    if (!fs.existsSync(file)) return null;
    const lines = fs.readFileSync(file, 'utf8').trim().split(/\r?\n/).filter(Boolean);
    if (lines.length === 0) return null;
    try {
      return (JSON.parse(lines[lines.length - 1]!) as AuditEvent).eventHash;
    } catch {
      throw new Error('AUDIT_CHAIN_CORRUPT');
    }
  }

  append(input: {
    eventType: string;
    taskId?: string | null;
    identityId?: string | null;
    summary: string;
    evidenceRefs?: string[];
  }): AuditEvent {
    const file = this.file(input.taskId ?? null);
    const previousHash = this.previousHash(file);
    const base = {
      eventId: `AUDIT-${crypto.randomUUID()}`,
      eventType: input.eventType,
      taskId: input.taskId ?? null,
      identityId: input.identityId ?? null,
      summary: input.summary.slice(0, 500),
      evidenceRefs: input.evidenceRefs ?? [],
      previousHash,
      timestamp: new Date().toISOString()
    };
    const eventHash = hash(canonical(base));
    const event: AuditEvent = { ...base, eventHash };
    fs.appendFileSync(file, JSON.stringify(event) + '\n', { encoding: 'utf8', mode: 0o600 });
    return event;
  }

  tail(taskId: string | null, limit = 50): AuditEvent[] {
    const file = this.file(taskId);
    if (!fs.existsSync(file)) return [];
    return fs.readFileSync(file, 'utf8')
      .trim()
      .split(/\r?\n/)
      .filter(Boolean)
      .slice(-Math.max(1, Math.min(limit, 200)))
      .map(line => JSON.parse(line) as AuditEvent);
  }
}
