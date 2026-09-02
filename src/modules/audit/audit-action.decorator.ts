import { SetMetadata } from '@nestjs/common';

export const AUDIT_ACTION_KEY = 'audit_action';

export interface AuditActionOptions {
  action: string;
  resourceType?: string;
  /** Dot path read only from the successful handler result, for example `id`. */
  resourceIdPath?: string;
}

export const AuditAction = (options: AuditActionOptions) => SetMetadata(AUDIT_ACTION_KEY, options);
