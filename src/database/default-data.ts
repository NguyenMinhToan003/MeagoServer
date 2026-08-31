import { PERMISSIONS } from '@meago/core';

/**
 * Single source of truth for mandatory system data.
 * Credentials never belong here; they must come from environment or a secret manager.
 */
export const DEFAULT_SYSTEM_DATA = {
  permissions: Object.values(PERMISSIONS).flatMap((group) => Object.values(group)),
  roles: {
    administrator: {
      name: 'admin',
      description: 'System administrator with all registered permissions',
    },
  },
} as const;

export const DEVELOPMENT_ADMIN_DEFAULTS = {
  email: 'admin@meago.local',
  displayName: 'Meago Administrator',
  password: 'local-admin-change-me',
} as const;
