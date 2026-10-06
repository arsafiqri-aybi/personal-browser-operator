export type RiskClass = 'R0' | 'R1' | 'R2' | 'R3' | 'R4' | 'R5';

export type TaskStatus =
  | 'ACTIVE'
  | 'BLOCKED'
  | 'WAITING_FOR_USER'
  | 'FAILED'
  | 'COMPLETE';

export interface TaskState {
  taskId: string;
  revision: number;
  goal: string;
  deliverable: string | null;
  protectedConstraints: string[];
  allowedDomains: string[];
  riskProfile: RiskClass;
  acceptanceCriteria: string[];
  status: TaskStatus;
  createdAt: string;
  updatedAt: string;
  browserIdentity: string | null;
  currentSubgoal: string | null;
  completedSubgoals: string[];
  blockedSubgoals: string[];
  evidenceRefs: string[];
  uncertainties: string[];
  completionVerificationId: string | null;
}

export interface ElementRef {
  ref: string;
  role: string;
  name: string;
  tag: string;
  placeholder: string | null;
  type: string | null;
}

export interface BrowserObservation {
  observationId: string;
  identityId: string;
  stateVersion: string;
  url: string;
  title: string;
  ariaSnapshot: string;
  interactiveElements: ElementRef[];
  trust: 'UNTRUSTED_WEB_DATA';
  authority: 'NONE';
  injectionSignals: string[];
  capturedAt: string;
}

export interface VerificationCheck {
  kind: string;
  expected: unknown;
  observed: unknown;
  pass: boolean;
}

export interface VerificationResult {
  verificationId: string;
  taskId: string;
  status: 'PASS' | 'FAIL' | 'UNCERTAIN';
  checks: VerificationCheck[];
  verifiedAt: string;
}

export type RecoveryCategory =
  | 'TARGET_NOT_FOUND'
  | 'STALE_STATE'
  | 'NAVIGATION_CHANGED'
  | 'AUTH_REQUIRED'
  | 'HUMAN_CHALLENGE'
  | 'TIMEOUT'
  | 'NETWORK_FAILURE'
  | 'SITE_ERROR'
  | 'POLICY_DENIED'
  | 'VERIFICATION_FAILED'
  | 'PARTIAL_EFFECT'
  | 'AMBIGUOUS_STATE'
  | 'UNEXPECTED_DIALOG'
  | 'RATE_LIMITED'
  | 'UNKNOWN_FAILURE';

export interface RecoveryDecision {
  recoveryId: string;
  category: RecoveryCategory;
  mustReobserve: boolean;
  mustVerifyBeforeRetry: boolean;
  safeToBlindRetry: false;
  suggestedNextStep: string;
  createdAt: string;
}

export interface AuditEvent {
  eventId: string;
  eventType: string;
  taskId: string | null;
  identityId: string | null;
  summary: string;
  evidenceRefs: string[];
  previousHash: string | null;
  eventHash: string;
  timestamp: string;
}
