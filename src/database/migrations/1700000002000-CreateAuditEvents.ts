import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAuditEvents1700000002000 implements MigrationInterface {
  name = 'CreateAuditEvents1700000002000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "audit_events" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "occurredAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "actorType" character varying(20) NOT NULL,
        "actorId" uuid,
        "action" character varying(150) NOT NULL,
        "resourceType" character varying(100),
        "resourceId" character varying(150),
        "outcome" character varying(20) NOT NULL,
        "reasonCode" character varying(100),
        "requestId" character varying(128),
        "traceId" character varying(64),
        "httpMethod" character varying(10),
        "routeTemplate" character varying(255),
        "statusCode" smallint,
        "ip" inet,
        "userAgent" character varying(512),
        "durationMs" integer,
        "metadata" jsonb,
        CONSTRAINT "PK_audit_events" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_audit_events_actor_type" CHECK ("actorType" IN ('user', 'system', 'service', 'anonymous')),
        CONSTRAINT "CHK_audit_events_outcome" CHECK ("outcome" IN ('success', 'failure', 'denied')),
        CONSTRAINT "CHK_audit_events_duration" CHECK ("durationMs" IS NULL OR "durationMs" >= 0),
        CONSTRAINT "CHK_audit_events_action" CHECK ("action" ~ '^[a-z0-9][a-z0-9_.-]*$')
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_audit_events_actor_time_id" ON "audit_events" ("actorId", "occurredAt" DESC, "id" DESC)`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_audit_events_resource_time_id" ON "audit_events" ("resourceType", "resourceId", "occurredAt" DESC, "id" DESC)`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_audit_events_action_time_id" ON "audit_events" ("action", "occurredAt" DESC, "id" DESC)`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_audit_events_request_id" ON "audit_events" ("requestId")`,
    );
    await queryRunner.query(`
      CREATE FUNCTION prevent_audit_event_mutation() RETURNS trigger AS $$
      BEGIN
        RAISE EXCEPTION 'audit_events is append-only';
      END;
      $$ LANGUAGE plpgsql
    `);
    await queryRunner.query(`
      CREATE TRIGGER "TRG_audit_events_append_only"
      BEFORE UPDATE OR DELETE ON "audit_events"
      FOR EACH ROW EXECUTE FUNCTION prevent_audit_event_mutation()
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TRIGGER "TRG_audit_events_append_only" ON "audit_events"`);
    await queryRunner.query(`DROP FUNCTION prevent_audit_event_mutation()`);
    await queryRunner.query(`DROP TABLE "audit_events"`);
  }
}
