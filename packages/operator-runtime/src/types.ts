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
  status: TaskStatus;
  createdAt: string;
  updatedAt: string;
  browserIdentity: string | null;
  evidenceRefs: string[];
  uncertainties: string[];
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
