import crypto from 'node:crypto';
import type { BrowserManager } from './browser.js';
import type { VerificationCheck, VerificationResult } from './types.js';

export interface VerifyExpectation {
  urlIncludes?: string;
  titleIncludes?: string;
  textVisible?: string;
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
