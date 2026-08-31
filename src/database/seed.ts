import 'reflect-metadata';
import * as bcrypt from 'bcrypt';
import dataSource from './data-source';
import { RoleEntity } from 'src/modules/rbac/role.entity';
import { PermissionEntity } from 'src/modules/rbac/permission.entity';
import { UserEntity } from 'src/modules/users/user.entity';
import { PERMISSIONS } from '@meago/core';

/**
 * Seed tối thiểu: permissions gốc + role "admin" full quyền + user admin.
 * Chạy: npm run seed  (idempotent — chạy lại không tạo trùng)
 */
const permissionNames = Object.values(PERMISSIONS).flatMap((group) => Object.values(group));

async function seed() {
  await dataSource.initialize();
  const permRepo = dataSource.getRepository(PermissionEntity);
  const roleRepo = dataSource.getRepository(RoleEntity);
  const userRepo = dataSource.getRepository(UserEntity);

  const perms: PermissionEntity[] = [];
  for (const name of permissionNames) {
    let p = await permRepo.findOneBy({ name });
    if (!p) p = await permRepo.save(permRepo.create({ name }));
    perms.push(p);
  }

  let admin = await roleRepo.findOne({ where: { name: 'admin' } });
  if (!admin) admin = roleRepo.create({ name: 'admin', description: 'Full access' });
  admin.permissions = perms;
  admin = await roleRepo.save(admin);

  const email = process.env.SEED_ADMIN_EMAIL ?? 'admin@meago.local';
  let user = await userRepo.findOne({ where: { email }, relations: { roles: true } });
  if (!user) {
    user = userRepo.create({
      email,
      displayName: 'Admin',
      passwordHash: await bcrypt.hash(process.env.SEED_ADMIN_PASSWORD ?? 'admin12345', 10),
    });
  }
  user.roles = [admin];
  await userRepo.save(user);

  console.log(`Seed done. Admin: ${email}`);
  await dataSource.destroy();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
