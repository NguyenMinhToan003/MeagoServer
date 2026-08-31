import 'reflect-metadata';
import dataSource from './data-source';
import { RoleEntity } from 'src/modules/rbac/role.entity';
import { PermissionEntity } from 'src/modules/rbac/permission.entity';
import { UserEntity } from 'src/modules/users/user.entity';
import { Argon2PasswordHasher } from 'src/common/security/argon2-password-hasher.adapter';
import { DEFAULT_SYSTEM_DATA, DEVELOPMENT_ADMIN_DEFAULTS } from './default-data';

type BootstrapAdmin = {
  email: string;
  displayName: string;
  password: string;
};

function resolveBootstrapAdmin(): BootstrapAdmin {
  const isProduction = process.env.NODE_ENV === 'production';
  const email = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
  const displayName = process.env.BOOTSTRAP_ADMIN_DISPLAY_NAME?.trim();
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;

  if (isProduction && (!email || !password)) {
    throw new Error(
      'BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD are required in production',
    );
  }

  const resolved = {
    email: email ?? DEVELOPMENT_ADMIN_DEFAULTS.email,
    displayName: displayName ?? DEVELOPMENT_ADMIN_DEFAULTS.displayName,
    password: password ?? DEVELOPMENT_ADMIN_DEFAULTS.password,
  };

  if (resolved.password.length < 12) {
    throw new Error('BOOTSTRAP_ADMIN_PASSWORD must contain at least 12 characters');
  }
  return resolved;
}

/**
 * Idempotent bootstrap for mandatory permissions, the administrator role and the first admin.
 * Existing admin passwords are never reset by deployment.
 */
async function seed(): Promise<void> {
  const bootstrapAdmin = resolveBootstrapAdmin();
  const passwordHasher = new Argon2PasswordHasher();
  await dataSource.initialize();

  try {
    const result = await dataSource.transaction(async (manager) => {
      const permissionRepo = manager.getRepository(PermissionEntity);
      const roleRepo = manager.getRepository(RoleEntity);
      const userRepo = manager.getRepository(UserEntity);

      await permissionRepo.upsert(
        DEFAULT_SYSTEM_DATA.permissions.map((name) => ({ name })),
        ['name'],
      );
      const permissions = await permissionRepo.findBy(
        DEFAULT_SYSTEM_DATA.permissions.map((name) => ({ name })),
      );

      const roleDefinition = DEFAULT_SYSTEM_DATA.roles.administrator;
      let administrator = await roleRepo.findOne({ where: { name: roleDefinition.name } });
      administrator ??= roleRepo.create(roleDefinition);
      administrator.description = roleDefinition.description;
      administrator.permissions = permissions;
      administrator = await roleRepo.save(administrator);

      let user = await userRepo.findOne({
        where: { email: bootstrapAdmin.email },
        relations: { roles: true },
      });
      const created = !user;
      if (!user) {
        user = userRepo.create({
          email: bootstrapAdmin.email,
          displayName: bootstrapAdmin.displayName,
          passwordHash: await passwordHasher.hash(bootstrapAdmin.password),
          roles: [],
        });
      }

      if (!user.roles.some((role) => role.id === administrator.id)) {
        user.roles.push(administrator);
      }
      await userRepo.save(user);
      return { created };
    });

    console.log(
      `System data ready. Administrator ${bootstrapAdmin.email} ${result.created ? 'created' : 'already exists'}.`,
    );
  } finally {
    await dataSource.destroy();
  }
}

seed().catch((error: unknown) => {
  console.error('Failed to bootstrap system data', error);
  process.exit(1);
});
