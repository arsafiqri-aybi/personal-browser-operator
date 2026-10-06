import type { BrowserObservation } from './types.js';

const SIGNALS: Array<[RegExp, string]> = [
  [/ignore\s+(all\s+)?previous\s+instructions/i, 'PROMPT_OVERRIDE_LANGUAGE'],
  [/system\s+(message|prompt)/i, 'SYSTEM_PROMPT_REFERENCE'],
  [/(send|upload|reveal|expose).{0,80}(cookie|token|password|secret|credential)/i, 'SECRET_EXFILTRATION_REQUEST'],
  [/(disable|bypass).{0,60}(security|policy|safety|verification)/i, 'CONTROL_BYPASS_REQUEST'],
  [/(act|behave).{0,40}(as|like).{0,20}(admin|system|developer)/i, 'AUTHORITY_IMPERSONATION']
];

export function markUntrustedObservation(
  observation: Omit<BrowserObservation, 'trust' | 'authority' | 'injectionSignals'>
): BrowserObservation {
  const searchable = [
    observation.ariaSnapshot,
    ...observation.interactiveElements.map(x => x.name)
  ].join('\n').slice(0, 120_000);

  const injectionSignals = SIGNALS
    .filter(([pattern]) => pattern.test(searchable))
    .map(([, id]) => id);

  return {
    ...observation,
    trust: 'UNTRUSTED_WEB_DATA',
    authority: 'NONE',
    injectionSignals
  };
}
