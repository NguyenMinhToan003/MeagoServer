import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Soft delete cho users/roles/permissions. deletedAt = null nghĩa là còn sống.
 *
 * Unique constraint (UQ_users_email, UQ_roles_name, UQ_permissions_name) giữ nguyên trên
 * toàn bảng theo chủ đích: email/tên đã dùng — kể cả bởi hàng đã xoá mềm — không được
 * tái sử dụng. Đây là quyết định nghiệp vụ, không phải sơ suất.
 */
export class AddSoftDelete1700000004000 implements MigrationInterface {
  name = 'AddSoftDelete1700000004000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ADD "deletedAt" TIMESTAMP WITH TIME ZONE`);
    await queryRunner.query(`ALTER TABLE "roles" ADD "deletedAt" TIMESTAMP WITH TIME ZONE`);
    await queryRunner.query(`ALTER TABLE "permissions" ADD "deletedAt" TIMESTAMP WITH TIME ZONE`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "permissions" DROP COLUMN "deletedAt"`);
    await queryRunner.query(`ALTER TABLE "roles" DROP COLUMN "deletedAt"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "deletedAt"`);
  }
}
