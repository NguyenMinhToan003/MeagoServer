export const AUDIT_OUTCOMES = ['success', 'failure', 'denied'] as const;
export type AuditOutcome = (typeof AUDIT_OUTCOMES)[number];

export const AUDIT_ACTOR_TYPES = ['user', 'system', 'service', 'anonymous'] as const;
export type AuditActorType = (typeof AUDIT_ACTOR_TYPES)[number];

export interface AuditEventInput {
  action: string;
  outcome: AuditOutcome;
  actorType?: AuditActorType;
  actorId?: string | null;
  resourceType?: string | null;
  resourceId?: string | null;
  reasonCode?: string | null;
  requestId?: string | null;
  traceId?: string | null;
  httpMethod?: string | null;
  routeTemplate?: string | null;
  statusCode?: number | null;
  ip?: string | null;
  userAgent?: string | null;
  durationMs?: number | null;
  metadata?: Record<string, unknown> | null;
  occurredAt?: Date;
}

export const AUDIT_PERMISSIONS = {
  READ: 'audit.events.read',
} as const;
