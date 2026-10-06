import type { RiskClass } from './types.js';

const order: Record<RiskClass, number> = {
  R0: 0,
  R1: 1,
  R2: 2,
  R3: 3,
  R4: 4,
  R5: 5
};

export interface AuthorizationRequest {
  taskId: string;
  intent: string;
  riskClass: RiskClass;
  taskRiskMax?: RiskClass;
  approved?: boolean;
}

export interface AuthorizationResult {
  allowed: boolean;
  reason: string;
}

export class PolicyEngine {
  authorize(req: AuthorizationRequest): AuthorizationResult {
    if (!req.taskId || !req.intent.trim()) {
      return { allowed: false, reason: 'ACTION_INTENT_BINDING_REQUIRED' };
    }

    if (req.taskRiskMax !== undefined) {
      if (!(req.taskRiskMax in order)) {
        return { allowed: false, reason: 'INVALID_TASK_RISK_PROFILE' };
      }
      if (order[req.riskClass] > order[req.taskRiskMax]) {
        return { allowed: false, reason: `TASK_RISK_PROFILE_EXCEEDED_${req.taskRiskMax}` };
      }
    }

    const automaticMax = (process.env.PBO_AUTO_RISK ?? 'R2') as RiskClass;
    if (!(automaticMax in order)) {
      return { allowed: false, reason: 'INVALID_RUNTIME_RISK_POLICY' };
    }

    if (order[req.riskClass] <= order[automaticMax]) {
      return { allowed: true, reason: `AUTO_ALLOWED_THROUGH_${automaticMax}` };
    }

    if (req.approved === true) {
      return { allowed: true, reason: 'EXPLICIT_APPROVAL_SUPPLIED' };
    }

    return { allowed: false, reason: `APPROVAL_REQUIRED_FOR_${req.riskClass}` };
  }
}
