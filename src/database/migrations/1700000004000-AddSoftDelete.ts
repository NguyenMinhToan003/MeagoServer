import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Soft delete cho users/roles/permissions. deletedAt = null nghĩa là còn sống.
 *
 * Unique constraint cũ (UQ_users_email, UQ_roles_name, UQ_permissions_name) vẫn tính
 * cả hàng đã xoá mềm — nếu giữ nguyên, xoá mềm 1 user sẽ khoá vĩnh viễn email đó.
 * Thay bằng partial unique index chỉ áp cho hàng "deletedAt IS NULL".
 */
export class AddSoftDelete1700000004000 implements MigrationInterface {
  name = 'AddSoftDelete1700000004000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ADD "deletedAt" TIMESTAMP WITH TIME ZONE`);
    await queryRunner.query(`ALTER TABLE "roles" ADD "deletedAt" TIMESTAMP WITH TIME ZONE`);
    await queryRunner.query(`ALTER TABLE "permissions" ADD "deletedAt" TIMESTAMP WITH TIME ZONE`);

    await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "UQ_users_email"`);
    await queryRunner.query(`ALTER TABLE "roles" DROP CONSTRAINT "UQ_roles_name"`);
    await queryRunner.query(`ALTER TABLE "permissions" DROP CONSTRAINT "UQ_permissions_name"`);

    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_users_email_active" ON "users" ("email") WHERE "deletedAt" IS NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_roles_name_active" ON "roles" ("name") WHERE "deletedAt" IS NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_permissions_name_active" ON "permissions" ("name") WHERE "deletedAt" IS NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "UQ_permissions_name_active"`);
    await queryRunner.query(`DROP INDEX "UQ_roles_name_active"`);
    await queryRunner.query(`DROP INDEX "UQ_users_email_active"`);

    await queryRunner.query(
      `ALTER TABLE "permissions" ADD CONSTRAINT "UQ_permissions_name" UNIQUE ("name")`,
    );
    await queryRunner.query(`ALTER TABLE "roles" ADD CONSTRAINT "UQ_roles_name" UNIQUE ("name")`);
    await queryRunner.query(`ALTER TABLE "users" ADD CONSTRAINT "UQ_users_email" UNIQUE ("email")`);

    await queryRunner.query(`ALTER TABLE "permissions" DROP COLUMN "deletedAt"`);
    await queryRunner.query(`ALTER TABLE "roles" DROP COLUMN "deletedAt"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "deletedAt"`);
  }
}
