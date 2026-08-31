import { MigrationInterface, QueryRunner } from 'typeorm';

export class NormalizeUserEmail1700000001000 implements MigrationInterface {
  name = 'NormalizeUserEmail1700000001000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`UPDATE "users" SET "email" = lower(btrim("email"))`);
    await queryRunner.query(
      `ALTER TABLE "users" ADD CONSTRAINT "CHK_users_email_normalized" CHECK ("email" = lower(btrim("email")))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "CHK_users_email_normalized"`);
  }
}
