import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import type { AuditActorType, AuditOutcome } from './core/audit.types';

@Entity('audit_events')
@Index('IDX_audit_events_actor_time_id', ['actorId', 'occurredAt', 'id'])
@Index('IDX_audit_events_resource_time_id', ['resourceType', 'resourceId', 'occurredAt', 'id'])
@Index('IDX_audit_events_action_time_id', ['action', 'occurredAt', 'id'])
export class AuditEventEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  occurredAt: Date;

  @Column({ type: 'varchar', length: 20 })
  actorType: AuditActorType;

  @Column({ type: 'uuid', nullable: true })
  actorId: string | null;

  @Column({ type: 'varchar', length: 150 })
  action: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  resourceType: string | null;

  @Column({ type: 'varchar', length: 150, nullable: true })
  resourceId: string | null;

  @Column({ type: 'varchar', length: 20 })
  outcome: AuditOutcome;

  @Column({ type: 'varchar', length: 100, nullable: true })
  reasonCode: string | null;

  @Column({ type: 'varchar', length: 128, nullable: true })
  @Index('IDX_audit_events_request_id')
  requestId: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  traceId: string | null;

  @Column({ type: 'varchar', length: 10, nullable: true })
  httpMethod: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  routeTemplate: string | null;

  @Column({ type: 'smallint', nullable: true })
  statusCode: number | null;

  @Column({ type: 'inet', nullable: true })
  ip: string | null;

  @Column({ type: 'varchar', length: 512, nullable: true })
  userAgent: string | null;

  @Column({ type: 'integer', nullable: true })
  durationMs: number | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;
}
