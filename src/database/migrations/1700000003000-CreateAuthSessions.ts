import { MigrationInterface, QueryRunner } from 'typeorm';

/** Stateful session store cho AUTH_MODE=session; độc lập với refresh_sessions của JWT mode. */
export class CreateAuthSessions1700000003000 implements MigrationInterface {
  name = 'CreateAuthSessions1700000003000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "auth_sessions" (
        "id" character varying(64) NOT NULL,
        "subjectId" uuid NOT NULL,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL,
        "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL,
        "absoluteExpiresAt" TIMESTAMP WITH TIME ZONE NOT NULL,
        "lastSeenAt" TIMESTAMP WITH TIME ZONE NOT NULL,
        "revokedAt" TIMESTAMP WITH TIME ZONE,
        "replacedBy" character varying(64),
        "ip" character varying,
        "userAgent" character varying(512),
        "data" jsonb,
        CONSTRAINT "PK_auth_sessions" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_auth_sessions_expiry" CHECK ("expiresAt" <= "absoluteExpiresAt")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_auth_sessions_subjectId" ON "auth_sessions" ("subjectId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_auth_sessions_subjectId"`);
    await queryRunner.query(`DROP TABLE "auth_sessions"`);
  }
}
