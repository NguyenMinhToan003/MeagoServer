import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { AuditEventEntity } from './audit-event.entity';
import type { AuditEventInput } from './core/audit.types';
import { sanitizeAuditMetadata } from './core/audit-sanitizer';

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @InjectRepository(AuditEventEntity) private readonly repository: Repository<AuditEventEntity>,
  ) {}

  /** Use inside the same transaction for audit records that are mandatory. */
  async recordRequired(input: AuditEventInput, manager?: EntityManager): Promise<AuditEventEntity> {
    const repository = manager?.getRepository(AuditEventEntity) ?? this.repository;
    return repository.save(repository.create(this.normalize(input)));
  }

  /** HTTP/security observation must not make the primary request fail. */
  async recordBestEffort(input: AuditEventInput): Promise<void> {
    try {
      await this.recordRequired(input);
    } catch (error) {
      this.logger.error(
        { err: error, action: input.action, requestId: input.requestId },
        'Failed to persist audit event',
      );
    }
  }

  private normalize(input: AuditEventInput): Partial<AuditEventEntity> {
    return {
      ...input,
      actorType: input.actorType ?? (input.actorId ? 'user' : 'anonymous'),
      actorId: input.actorId ?? null,
      resourceType: input.resourceType ?? null,
      resourceId: input.resourceId ?? null,
      reasonCode: input.reasonCode ?? null,
      requestId: input.requestId?.slice(0, 128) ?? null,
      traceId: input.traceId?.slice(0, 64) ?? null,
      httpMethod: input.httpMethod?.slice(0, 10) ?? null,
      routeTemplate: input.routeTemplate?.slice(0, 255) ?? null,
      statusCode: input.statusCode ?? null,
      ip: input.ip ?? null,
      userAgent: input.userAgent?.slice(0, 512) ?? null,
      durationMs: input.durationMs ?? null,
      metadata: sanitizeAuditMetadata(input.metadata),
      occurredAt: input.occurredAt ?? new Date(),
    };
  }
}
