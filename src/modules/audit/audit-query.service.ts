import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { isUUID } from 'class-validator';
import { AuditEventEntity } from './audit-event.entity';
import { AuditEventQueryDto } from './audit.dto';

interface AuditCursor {
  occurredAt: string;
  id: string;
}

@Injectable()
export class AuditQueryService {
  constructor(
    @InjectRepository(AuditEventEntity) private readonly repository: Repository<AuditEventEntity>,
  ) {}

  async findOne(id: string): Promise<AuditEventEntity> {
    const event = await this.repository.findOneBy({ id });
    if (!event) throw new NotFoundException('Audit event not found');
    return event;
  }

  async findMany(query: AuditEventQueryDto) {
    const limit = query.limit ?? 20;
    if (query.from && query.to && Date.parse(query.from) > Date.parse(query.to)) {
      throw new BadRequestException('Audit date range is invalid');
    }
    const builder = this.repository.createQueryBuilder('audit');

    if (query.actorId) builder.andWhere('audit.actorId = :actorId', { actorId: query.actorId });
    if (query.action) builder.andWhere('audit.action = :action', { action: query.action });
    if (query.resourceType)
      builder.andWhere('audit.resourceType = :resourceType', { resourceType: query.resourceType });
    if (query.resourceId)
      builder.andWhere('audit.resourceId = :resourceId', { resourceId: query.resourceId });
    if (query.outcome) builder.andWhere('audit.outcome = :outcome', { outcome: query.outcome });
    if (query.from) builder.andWhere('audit.occurredAt >= :from', { from: query.from });
    if (query.to) builder.andWhere('audit.occurredAt <= :to', { to: query.to });

    if (query.cursor) {
      const cursor = this.decodeCursor(query.cursor);
      builder.andWhere('(audit.occurredAt, audit.id) < (:occurredAt, :id)', cursor);
    }

    const rows = await builder
      .orderBy('audit.occurredAt', 'DESC')
      .addOrderBy('audit.id', 'DESC')
      .take(limit + 1)
      .getMany();
    const hasNextPage = rows.length > limit;
    const items = hasNextPage ? rows.slice(0, limit) : rows;
    const last = items[items.length - 1];
    return {
      items,
      nextCursor: hasNextPage && last ? this.encodeCursor(last) : null,
    };
  }

  private encodeCursor(event: AuditEventEntity): string {
    return Buffer.from(
      JSON.stringify({ occurredAt: event.occurredAt.toISOString(), id: event.id }),
      'utf8',
    ).toString('base64url');
  }

  private decodeCursor(value: string): AuditCursor {
    try {
      const parsed = JSON.parse(
        Buffer.from(value, 'base64url').toString('utf8'),
      ) as Partial<AuditCursor>;
      if (
        !parsed.occurredAt ||
        Number.isNaN(Date.parse(parsed.occurredAt)) ||
        !parsed.id ||
        !isUUID(parsed.id, '4')
      )
        throw new Error();
      return { occurredAt: parsed.occurredAt, id: parsed.id };
    } catch {
      throw new BadRequestException('Invalid audit cursor');
    }
  }
}
