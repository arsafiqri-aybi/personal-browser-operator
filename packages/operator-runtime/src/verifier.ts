import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { BrowserManager } from './browser.js';
import type { VerificationCheck, VerificationResult } from './types.js';

export interface VerifyExpectation {
  urlIncludes?: string;
  titleIncludes?: string;
  textVisible?: string;
}

function root(): string {
  return process.env.PBO_DATA_DIR || path.resolve('runtime-data');
}

export class VerificationStore {
  private dir: string;

  constructor() {
    this.dir = path.join(root(), 'state', 'verifications');
    fs.mkdirSync(this.dir, { recursive: true, mode: 0o700 });
  }

  save(result: VerificationResult): void {
    const file = path.join(this.dir, result.verificationId + '.json');
    fs.writeFileSync(file, JSON.stringify(result, null, 2), { encoding: 'utf8', mode: 0o600 });
  }

  get(verificationId: string): VerificationResult {
    if (!/^VERIFY-[A-Za-z0-9_-]+$/.test(verificationId)) throw new Error('INVALID_VERIFICATION_ID');
    const file = path.join(this.dir, verificationId + '.json');
    if (!fs.existsSync(file)) throw new Error('VERIFICATION_NOT_FOUND');
    return JSON.parse(fs.readFileSync(file, 'utf8')) as VerificationResult;
  }
}

export async function verify(
  browsers: BrowserManager,
  taskId: string,
  identityId: string,
  expected: VerifyExpectation
): Promise<VerificationResult> {
  const session = browsers.session(identityId);
  const checks: VerificationCheck[] = [];

  if (expected.urlIncludes !== undefined) {
    const observed = session.page.url();
    checks.push({
      kind: 'urlIncludes',
      expected: expected.urlIncludes,
      observed,
      pass: observed.includes(expected.urlIncludes)
    });
  }

  if (expected.titleIncludes !== undefined) {
    const observed = await session.page.title();
    checks.push({
      kind: 'titleIncludes',
      expected: expected.titleIncludes,
      observed,
      pass: observed.includes(expected.titleIncludes)
    });
  }

  if (expected.textVisible !== undefined) {
    const visible = await session.page.getByText(expected.textVisible, { exact: false }).first().isVisible().catch(() => false);
    checks.push({
      kind: 'textVisible',
      expected: expected.textVisible,
      observed: visible,
      pass: visible
    });
  }

  const status =
    checks.length === 0 ? 'UNCERTAIN' :
    checks.every(c => c.pass) ? 'PASS' : 'FAIL';

  return {
    verificationId: `VERIFY-${crypto.randomUUID()}`,
    taskId,
    status,
    checks,
    verifiedAt: new Date().toISOString()
  };
}
