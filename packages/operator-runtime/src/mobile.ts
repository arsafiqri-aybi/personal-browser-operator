import crypto from 'node:crypto';
import type { VerificationCheck, VerificationResult } from './types.js';

export interface MobileElementRef {
  ref: string;
  text: string;
  description: string;
  className: string;
  viewId: string | null;
  clickable: boolean;
  editable: boolean;
  password: boolean;
  bounds: { left: number; top: number; right: number; bottom: number };
}

export interface MobileObservation {
  observationId: string;
  deviceId: string;
  stateVersion: string;
  packageName: string;
  windowClass: string;
  textSnapshot: string;
  interactiveElements: MobileElementRef[];
  trust: 'UNTRUSTED_DEVICE_DATA';
  authority: 'NONE';
  capturedAt: string;
}

interface RelayEnvelope<T> {
  requestId: string;
  ok: boolean;
  result?: T;
  error?: string;
}

export interface MobileVerifyExpectation {
  packageName?: string;
  windowClassIncludes?: string;
  textIncludes?: string;
}

function safeDeviceId(value: string): string {
  if (!/^[A-Za-z0-9._-]{1,80}$/.test(value)) throw new Error('INVALID_DEVICE_ID');
  return value;
}

export class MobileRelayClient {
  private config(): { baseUrl: string; token: string } {
    const baseUrl = (process.env.PBO_MOBILE_RELAY_URL || '').replace(/\/+$/, '');
    const token = process.env.PBO_MOBILE_CONTROL_TOKEN || '';
    if (!baseUrl || !token) throw new Error('MOBILE_RELAY_NOT_CONFIGURED');
    return { baseUrl, token };
  }

  private async request<T>(
    deviceIdRaw: string,
    operation: 'status' | 'command',
    body?: unknown
  ): Promise<T> {
    const deviceId = safeDeviceId(deviceIdRaw);
    const { baseUrl, token } = this.config();
    const response = await fetch(
      `${baseUrl}/v1/device/${encodeURIComponent(deviceId)}/${operation}`,
      {
        method: operation === 'status' ? 'GET' : 'POST',
        headers: {
          authorization: `Bearer ${token}`,
          ...(operation === 'command' ? { 'content-type': 'application/json' } : {})
        },
        body: operation === 'command' ? JSON.stringify(body ?? {}) : undefined
      }
    );

    const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
    if (!response.ok) {
      throw new Error(String(payload.error || `MOBILE_RELAY_HTTP_${response.status}`));
    }
    return payload as T;
  }

  async status(deviceId: string): Promise<{ connected: boolean; connections: number }> {
    return this.request(deviceId, 'status');
  }

  private async command<T>(
    deviceId: string,
    type: string,
    payload: Record<string, unknown>,
    approved = false
  ): Promise<T> {
    const envelope = await this.request<RelayEnvelope<T>>(deviceId, 'command', {
      type,
      payload,
      approved
    });
    if (!envelope.ok) throw new Error(envelope.error || 'MOBILE_DEVICE_COMMAND_FAILED');
    if (envelope.result === undefined) throw new Error('MOBILE_DEVICE_EMPTY_RESULT');
    return envelope.result;
  }

  async observe(deviceId: string): Promise<MobileObservation> {
    return this.command(deviceId, 'observe', {});
  }

  async openUrl(deviceId: string, url: string, approved = false): Promise<unknown> {
    return this.command(deviceId, 'open_url', { url }, approved);
  }

  async interact(
    deviceId: string,
    stateVersion: string,
    ref: string,
    operation: 'click' | 'fill',
    value?: string,
    approved = false
  ): Promise<unknown> {
    return this.command(
      deviceId,
      'interact',
      { stateVersion, ref, operation, ...(value === undefined ? {} : { value }) },
      approved
    );
  }

  async globalAction(
    deviceId: string,
    action: 'BACK' | 'HOME' | 'RECENTS',
    approved = false
  ): Promise<unknown> {
    return this.command(deviceId, 'global_action', { action }, approved);
  }
}

export function verifyMobileObservation(
  taskId: string,
  observation: MobileObservation,
  expected: MobileVerifyExpectation
): VerificationResult {
  const checks: VerificationCheck[] = [];

  if (expected.packageName !== undefined) {
    checks.push({
      kind: 'packageName',
      expected: expected.packageName,
      observed: observation.packageName,
      pass: observation.packageName === expected.packageName
    });
  }

  if (expected.windowClassIncludes !== undefined) {
    checks.push({
      kind: 'windowClassIncludes',
      expected: expected.windowClassIncludes,
      observed: observation.windowClass,
      pass: observation.windowClass.includes(expected.windowClassIncludes)
    });
  }

  if (expected.textIncludes !== undefined) {
    checks.push({
      kind: 'textIncludes',
      expected: expected.textIncludes,
      observed: observation.textSnapshot,
      pass: observation.textSnapshot.includes(expected.textIncludes)
    });
  }

  return {
    verificationId: `VERIFY-${crypto.randomUUID()}`,
    taskId,
    status: checks.length === 0 ? 'UNCERTAIN' : checks.every(check => check.pass) ? 'PASS' : 'FAIL',
    checks,
    verifiedAt: new Date().toISOString()
  };
}
